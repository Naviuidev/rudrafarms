<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;
use App\Order\Schema;
use App\Subscription\SubscriptionSchema;
use PDO;

final class AdminOrdersService
{
    /**
     * @return array{order: array<string, mixed>}|null
     */
    public static function detail(string $orderId): ?array
    {
        AdminSchema::ensure();
        Schema::ensure();
        $orderId = trim($orderId);
        if ($orderId === '') {
            return null;
        }

        $pdo = Connection::pdo();
        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        $hasPay = is_array($cols) && in_array('payment_status', $cols, true);

        $st = $pdo->prepare(
            'SELECT o.*,
                    c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
             FROM orders o
             INNER JOIN customers c ON c.id = o.customer_id
             WHERE o.id = ?
             LIMIT 1',
        );
        $st->execute([$orderId]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        $items = $pdo->prepare(
            'SELECT product_id, variant_id, name, unit, qty, price, line_total, tax FROM order_items WHERE order_id = ? ORDER BY name',
        );
        $items->execute([$orderId]);
        $itemRows = $items->fetchAll(PDO::FETCH_ASSOC);
        $lines = [];
        foreach (is_array($itemRows) ? $itemRows : [] as $it) {
            if (!is_array($it)) {
                continue;
            }
            $lines[] = [
                'productId' => (string) $it['product_id'],
                'variantId' => (string) $it['variant_id'],
                'name' => (string) $it['name'],
                'unit' => (string) $it['unit'],
                'qty' => (int) $it['qty'],
                'price' => (int) $it['price'],
                'lineTotal' => (int) $it['line_total'],
                'tax' => (int) $it['tax'],
            ];
        }

        $addr = json_decode((string) ($row['address_json'] ?? ''), true);

        $subscriptionId = isset($row['subscription_id']) && $row['subscription_id'] ? (string) $row['subscription_id'] : '';
        $cycleId = isset($row['subscription_cycle_id']) && $row['subscription_cycle_id'] ? (string) $row['subscription_cycle_id'] : '';
        $subscriptionMeta = self::subscriptionContext($pdo, $subscriptionId, $cycleId);

        return [
            'order' => [
                'id' => (string) $row['id'],
                'orderNumber' => (string) $row['order_number'],
                'customerId' => (string) $row['customer_id'],
                'customerName' => (string) ($row['customer_name'] ?? ''),
                'customerEmail' => (string) ($row['customer_email'] ?? ''),
                'customerPhone' => (string) ($row['customer_phone'] ?? ''),
                'status' => (string) $row['status'],
                'paymentStatus' => $hasPay ? (string) ($row['payment_status'] ?? '') : '',
                'fulfillmentStatus' => array_key_exists('fulfillment_status', $row) ? (string) $row['fulfillment_status'] : '',
                'deliveryType' => (string) $row['delivery_type'],
                'slotKey' => (string) $row['slot_key'],
                'slotLabel' => (string) ($row['slot_label'] ?? ''),
                'slotDate' => $row['slot_date'] ? (string) $row['slot_date'] : '',
                'couponCode' => (string) ($row['coupon_code'] ?? ''),
                'couponId' => isset($row['coupon_id']) && $row['coupon_id'] ? (string) $row['coupon_id'] : '',
                'subtotal' => (int) $row['subtotal'],
                'discount' => (int) $row['discount'],
                'deliveryFee' => (int) $row['delivery_fee'],
                'tax' => (int) $row['tax'],
                'payable' => (int) $row['payable'],
                'deliveryNote' => (string) ($row['delivery_note'] ?? ''),
                'address' => is_array($addr) ? $addr : [],
                'razorpayOrderId' => (string) ($row['razorpay_order_id'] ?? ''),
                'razorpayPaymentId' => (string) ($row['razorpay_payment_id'] ?? ''),
                'subscriptionId' => $subscriptionId,
                'subscriptionCycleId' => $cycleId,
                'subscription' => $subscriptionMeta['subscription'],
                'subscriptionCycle' => $subscriptionMeta['cycle'],
                'paidAt' => !empty($row['paid_at']) ? (string) $row['paid_at'] : '',
                'createdAt' => (string) $row['created_at'],
                'cancellationRequested' => !empty($row['cancellation_requested']),
                'cancellationReason' => (string) ($row['cancellation_reason'] ?? ''),
                'refundStatus' => (string) ($row['refund_status'] ?? ''),
                'assignment' => self::assignmentForOrder($pdo, $orderId),
                'items' => $lines,
                'deliveryDays' => self::deliveryDays(
                    $pdo,
                    (string) $row['delivery_type'],
                    (string) $row['status'],
                    $row['slot_date'] ? (string) $row['slot_date'] : '',
                    $subscriptionId,
                    $subscriptionMeta['cycle'],
                ),
            ],
        ];
    }

    /**
     * Move a paid order through the shop floor. Cancelling or failing a paid order returns stock.
     *
     * @return array{order: array<string, mixed>}
     */
    public static function updateStatus(string $orderId, string $status, string $note = '', bool $mirrorAssignment = true): array
    {
        AdminSchema::ensure();
        $orderId = trim($orderId);
        $status = strtolower(trim($status));
        $note = trim($note);
        $allowed = ['confirmed', 'preparing', 'assigned', 'out_for_delivery', 'delivered', 'cancelled', 'failed'];
        if ($orderId === '' || !in_array($status, $allowed, true)) {
            throw new \InvalidArgumentException('Choose a valid order status.');
        }

        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('SELECT * FROM orders WHERE id = ? FOR UPDATE');
            $st->execute([$orderId]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                throw new \InvalidArgumentException('Order not found.');
            }

            $current = (string) $row['status'];
            if (in_array($current, ['cancelled', 'failed'], true) && $current !== $status) {
                throw new \InvalidArgumentException('This order is already closed.');
            }
            if ($current === 'pending_payment' && !in_array($status, ['cancelled', 'failed'], true)) {
                throw new \InvalidArgumentException('Wait for payment before moving this order forward. You can still cancel it.');
            }

            if ($current !== $status) {
                $sets = ['status = ?', 'updated_at = ?'];
                $params = [$status, Support::now()];
                if (array_key_exists('fulfillment_status', $row)) {
                    $sets[] = 'fulfillment_status = ?';
                    $params[] = $status;
                }
                if (in_array($status, ['cancelled', 'failed'], true) && array_key_exists('cancellation_requested', $row)) {
                    $sets[] = 'cancellation_requested = 1';
                }
                $paid = self::orderWasPaid($row);
                if ($paid && in_array($status, ['cancelled', 'failed'], true) && array_key_exists('refund_status', $row) && (string) ($row['refund_status'] ?? '') === '') {
                    $sets[] = 'refund_status = ?';
                    $params[] = 'refund_pending';
                }
                $params[] = $orderId;
                $pdo->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

                if ($paid && in_array($status, ['cancelled', 'failed'], true)) {
                    self::restoreStock($pdo, $orderId, (string) $row['order_number']);
                }
                if ($mirrorAssignment) {
                    self::mirrorAssignment($pdo, $orderId, $status, $note);
                }
            }

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        $detail = self::detail($orderId);
        if ($detail === null) {
            throw new \InvalidArgumentException('Order not found.');
        }

        return $detail;
    }

    /**
     * Apply a shop-floor status to one subscription day. Quick orders still update the order itself.
     *
     * @return array{order: array<string, mixed>}
     */
    public static function updateDeliveryDay(string $orderId, string $date, string $status, string $note = ''): array
    {
        AdminSchema::ensure();
        Schema::ensure();
        SubscriptionSchema::ensure();
        $orderId = trim($orderId);
        $date = substr(trim($date), 0, 10);
        $status = strtolower(trim($status));
        $allowed = ['confirmed', 'preparing', 'assigned', 'out_for_delivery', 'delivered', 'cancelled', 'failed'];
        if ($orderId === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !in_array($status, $allowed, true)) {
            throw new \InvalidArgumentException('Choose a delivery date and a valid status.');
        }

        $pdo = Connection::pdo();
        $st = $pdo->prepare('SELECT delivery_type, subscription_id, subscription_cycle_id FROM orders WHERE id = ? LIMIT 1');
        $st->execute([$orderId]);
        $order = $st->fetch(PDO::FETCH_ASSOC);
        if (!is_array($order)) {
            throw new \InvalidArgumentException('Order not found.');
        }
        if ((string) $order['delivery_type'] !== 'subscription' || empty($order['subscription_id']) || empty($order['subscription_cycle_id'])) {
            return self::updateStatus($orderId, $status, $note);
        }

        $subscriptionId = (string) $order['subscription_id'];
        $cycleId = (string) $order['subscription_cycle_id'];
        $cycle = $pdo->prepare('SELECT period_start, period_end FROM subscription_cycles WHERE id = ? AND subscription_id = ? LIMIT 1');
        $cycle->execute([$cycleId, $subscriptionId]);
        $period = $cycle->fetch(PDO::FETCH_ASSOC);
        if (!is_array($period) || $date < (string) $period['period_start'] || $date > (string) $period['period_end']) {
            throw new \InvalidArgumentException('Choose a date inside this billing period.');
        }

        $pdo->prepare('DELETE FROM subscription_skips WHERE subscription_id = ? AND delivery_date = ?')->execute([$subscriptionId, $date]);

        $existing = $pdo->prepare('SELECT id FROM subscription_deliveries WHERE subscription_id = ? AND delivery_date = ? LIMIT 1');
        $existing->execute([$subscriptionId, $date]);
        $deliveryId = $existing->fetchColumn();
        if (is_string($deliveryId) && $deliveryId !== '') {
            $pdo->prepare('UPDATE subscription_deliveries SET status = ? WHERE id = ?')->execute([$status, $deliveryId]);
        } else {
            $pdo->prepare(
                'INSERT INTO subscription_deliveries (id, subscription_id, cycle_id, delivery_date, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)',
            )->execute([Support::uuid(), $subscriptionId, $cycleId, $date, $status, Support::now()]);
        }

        self::syncLinkedAssignment($pdo, $subscriptionId, $date, $status, $note);

        $detail = self::detail($orderId);
        if ($detail === null) {
            throw new \InvalidArgumentException('Order not found.');
        }

        return $detail;
    }

    private static function syncLinkedAssignment(PDO $pdo, string $subscriptionId, string $date, string $status, string $note): void
    {
        $assignmentStatus = match ($status) {
            'preparing' => 'processing',
            'confirmed', 'assigned' => 'assigned',
            'out_for_delivery' => 'out_for_delivery',
            'delivered' => 'delivered',
            'failed' => 'failed',
            'cancelled' => 'cancelled',
            default => '',
        };
        if ($assignmentStatus === '') {
            return;
        }

        $find = $pdo->prepare(
            'SELECT da.id FROM delivery_assignments da
             INNER JOIN subscription_deliveries sd ON sd.id = da.subscription_delivery_id
             WHERE sd.subscription_id = ? AND sd.delivery_date = ?
             LIMIT 1',
        );
        $find->execute([$subscriptionId, $date]);
        $assignmentId = $find->fetchColumn();
        if (!is_string($assignmentId) || $assignmentId === '') {
            return;
        }

        $pdo->prepare('UPDATE delivery_assignments SET status = ?, notes = ?, updated_at = ? WHERE id = ?')
            ->execute([$assignmentStatus, $note, Support::now(), $assignmentId]);
        $pdo->prepare(
            'INSERT INTO delivery_status_history (id, assignment_id, status, notes, failure_reason, proof_ref, updated_by, created_at)
             VALUES (?, ?, ?, ?, "", "", "admin", ?)',
        )->execute([Support::uuid(), $assignmentId, $assignmentStatus, $note, Support::now()]);
    }

    public static function syncFromDelivery(string $orderId, string $deliveryStatus, string $note = ''): void
    {
        $orderStatus = match ($deliveryStatus) {
            'assigned', 'rescheduled' => 'assigned',
            'processing' => 'preparing',
            'out_for_delivery' => 'out_for_delivery',
            'delivered' => 'delivered',
            'failed' => 'failed',
            'cancelled' => 'cancelled',
            default => '',
        };
        if ($orderId === '' || $orderStatus === '') {
            return;
        }

        try {
            self::updateStatus($orderId, $orderStatus, $note, false);
        } catch (\InvalidArgumentException) {
            // Unpaid or already closed orders keep the delivery row without changing the ledger.
        }
    }

    /** @param array<string, mixed> $row */
    private static function orderWasPaid(array $row): bool
    {
        if (!empty($row['paid_at'])) {
            return true;
        }

        return array_key_exists('payment_status', $row) && (string) $row['payment_status'] === 'paid';
    }

    private static function restoreStock(PDO $pdo, string $orderId, string $orderNumber): void
    {
        $items = $pdo->prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ?');
        $items->execute([$orderId]);
        $rows = $items->fetchAll(PDO::FETCH_ASSOC);
        $now = Support::now();
        foreach (is_array($rows) ? $rows : [] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $qty = (int) $item['qty'];
            $variantId = (string) $item['variant_id'];
            if ($qty < 1 || $variantId === '') {
                continue;
            }
            $lock = $pdo->prepare('SELECT stock FROM product_variants WHERE id = ? FOR UPDATE');
            $lock->execute([$variantId]);
            $stock = $lock->fetchColumn();
            if ($stock === false) {
                continue;
            }
            $pdo->prepare('UPDATE product_variants SET stock = ? WHERE id = ?')->execute([(int) $stock + $qty, $variantId]);
            $pdo->prepare(
                'INSERT INTO stock_movements (id, variant_id, delta, reason, reference, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            )->execute([Support::uuid(), $variantId, $qty, 'order cancelled', $orderNumber, $now]);
        }
    }

    private static function mirrorAssignment(PDO $pdo, string $orderId, string $orderStatus, string $note): void
    {
        $deliveryStatus = match ($orderStatus) {
            'preparing' => 'processing',
            'assigned' => 'assigned',
            'out_for_delivery' => 'out_for_delivery',
            'delivered' => 'delivered',
            'cancelled' => 'cancelled',
            'failed' => 'failed',
            default => '',
        };
        if ($deliveryStatus === '') {
            return;
        }

        $st = $pdo->prepare('SELECT id, status FROM delivery_assignments WHERE order_id = ? LIMIT 1 FOR UPDATE');
        $st->execute([$orderId]);
        $assignment = $st->fetch(PDO::FETCH_ASSOC);
        if (!is_array($assignment)) {
            return;
        }
        if ((string) $assignment['status'] === $deliveryStatus && $note === '') {
            return;
        }

        $now = Support::now();
        $pdo->prepare('UPDATE delivery_assignments SET status = ?, notes = CASE WHEN ? = "" THEN notes ELSE ? END, updated_at = ? WHERE id = ?')
            ->execute([$deliveryStatus, $note, $note, $now, (string) $assignment['id']]);
        $pdo->prepare(
            'INSERT INTO delivery_status_history (id, assignment_id, status, notes, failure_reason, proof_ref, updated_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )->execute([
            Support::uuid(),
            (string) $assignment['id'],
            $deliveryStatus,
            $note,
            '',
            '',
            'admin',
            $now,
        ]);
    }

    /** @return array<string, mixed>|null */
    private static function assignmentForOrder(PDO $pdo, string $orderId): ?array
    {
        try {
            $st = $pdo->prepare(
                'SELECT da.id, da.status, da.personnel_id, da.notes, dp.name AS personnel_name
                 FROM delivery_assignments da
                 LEFT JOIN delivery_personnel dp ON dp.id = da.personnel_id
                 WHERE da.order_id = ?
                 LIMIT 1',
            );
            $st->execute([$orderId]);
        } catch (\Throwable) {
            return null;
        }
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        return [
            'id' => (string) $row['id'],
            'status' => (string) $row['status'],
            'personnelId' => $row['personnel_id'] ? (string) $row['personnel_id'] : '',
            'personnelName' => (string) ($row['personnel_name'] ?? ''),
            'notes' => (string) ($row['notes'] ?? ''),
        ];
    }

    /**
     * @return array{subscription: array<string, mixed>|null, cycle: array<string, mixed>|null}
     */
    private static function subscriptionContext(PDO $pdo, string $subscriptionId, string $cycleId): array
    {
        $out = ['subscription' => null, 'cycle' => null];
        if ($subscriptionId === '') {
            return $out;
        }

        SubscriptionSchema::ensure();

        $st = $pdo->prepare(
            'SELECT id, plan_id, status, schedule_key, start_date, created_at FROM subscriptions WHERE id = ? LIMIT 1',
        );
        $st->execute([$subscriptionId]);
        $srow = $st->fetch(PDO::FETCH_ASSOC);
        if (is_array($srow)) {
            $out['subscription'] = [
                'id' => (string) $srow['id'],
                'planId' => $srow['plan_id'] ? (string) $srow['plan_id'] : '',
                'status' => (string) $srow['status'],
                'scheduleKey' => (string) ($srow['schedule_key'] ?? ''),
                'startDate' => (string) ($srow['start_date'] ?? ''),
                'createdAt' => (string) ($srow['created_at'] ?? ''),
            ];
        }

        if ($cycleId !== '') {
            $cst = $pdo->prepare(
                'SELECT id, period_start, period_end, billable_delivery_days, status, amount_paise, razorpay_order_id, paid_at
                 FROM subscription_cycles WHERE id = ? LIMIT 1',
            );
            $cst->execute([$cycleId]);
            $crow = $cst->fetch(PDO::FETCH_ASSOC);
            if (is_array($crow)) {
                $out['cycle'] = [
                    'id' => (string) $crow['id'],
                    'periodStart' => (string) ($crow['period_start'] ?? ''),
                    'periodEnd' => (string) ($crow['period_end'] ?? ''),
                    'billableDeliveryDays' => (int) ($crow['billable_delivery_days'] ?? 0),
                    'status' => (string) ($crow['status'] ?? ''),
                    'amountPaise' => (int) ($crow['amount_paise'] ?? 0),
                    'razorpayOrderId' => (string) ($crow['razorpay_order_id'] ?? ''),
                    'paidAt' => !empty($crow['paid_at']) ? (string) $crow['paid_at'] : '',
                ];
            }
        }

        return $out;
    }

    /**
     * One card per day in a subscription cycle, or the single slot on a quick order.
     *
     * @param array<string, mixed>|null $cycle
     * @return list<array{date: string, tone: string, label: string}>
     */
    private static function deliveryDays(PDO $pdo, string $deliveryType, string $orderStatus, string $slotDate, string $subscriptionId, ?array $cycle): array
    {
        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d');

        if ($deliveryType !== 'subscription' || $subscriptionId === '' || !is_array($cycle)) {
            $date = substr($slotDate, 0, 10);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                return [];
            }
            $tone = $orderStatus === 'delivered' ? 'delivered' : ($date > $today ? 'upcoming' : 'pending');

            return [self::dayCard($date, $tone)];
        }

        $start = (string) ($cycle['periodStart'] ?? '');
        $end = (string) ($cycle['periodEnd'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end) || $start > $end) {
            return [];
        }

        SubscriptionSchema::ensure();

        $skipRows = $pdo->prepare('SELECT delivery_date FROM subscription_skips WHERE subscription_id = ?');
        $skipRows->execute([$subscriptionId]);
        $skips = array_fill_keys(array_map('strval', $skipRows->fetchAll(PDO::FETCH_COLUMN) ?: []), true);

        $pauseRows = $pdo->prepare('SELECT start_date, end_date FROM subscription_pauses WHERE subscription_id = ?');
        $pauseRows->execute([$subscriptionId]);
        $pauses = [];
        foreach ($pauseRows->fetchAll(PDO::FETCH_ASSOC) ?: [] as $pause) {
            if (!is_array($pause)) {
                continue;
            }
            $pauses[] = [(string) $pause['start_date'], (string) $pause['end_date']];
        }

        $deliveryRows = $pdo->prepare(
            'SELECT delivery_date, status FROM subscription_deliveries WHERE subscription_id = ? AND cycle_id = ?',
        );
        $deliveryRows->execute([$subscriptionId, (string) ($cycle['id'] ?? '')]);
        $statuses = [];
        foreach ($deliveryRows->fetchAll(PDO::FETCH_ASSOC) ?: [] as $delivery) {
            if (is_array($delivery)) {
                $statuses[(string) $delivery['delivery_date']] = (string) $delivery['status'];
            }
        }

        $zone = new \DateTimeZone('Asia/Kolkata');
        $cursor = new \DateTimeImmutable($start, $zone);
        $last = new \DateTimeImmutable($end, $zone);
        $days = [];
        while ($cursor <= $last) {
            $date = $cursor->format('Y-m-d');
            $paused = false;
            foreach ($pauses as [$pauseStart, $pauseEnd]) {
                if ($date >= $pauseStart && $date <= $pauseEnd) {
                    $paused = true;
                    break;
                }
            }
            $deliveryStatus = $statuses[$date] ?? '';
            $explicit = ['confirmed', 'preparing', 'assigned', 'out_for_delivery', 'cancelled', 'failed'];
            $label = '';
            if ($deliveryStatus === 'delivered') {
                $tone = 'delivered';
            } elseif (in_array($deliveryStatus, $explicit, true)) {
                $tone = $date > $today ? 'upcoming' : 'pending';
                $label = self::statusLabel($deliveryStatus);
            } elseif (isset($skips[$date])) {
                $tone = 'skipped';
            } elseif ($paused) {
                $tone = 'paused';
            } elseif ($date > $today) {
                $tone = 'upcoming';
            } else {
                $tone = 'pending';
            }
            $days[] = self::dayCard($date, $tone, $label);
            $cursor = $cursor->modify('+1 day');
        }

        return $days;
    }

    /** @return array{date: string, tone: string, label: string} */
    private static function dayCard(string $date, string $tone, string $label = ''): array
    {
        $labels = [
            'delivered' => 'Delivered',
            'upcoming' => 'Upcoming',
            'skipped' => 'Skipped',
            'paused' => 'Paused',
            'pending' => 'Yet to be delivered',
        ];

        return [
            'date' => $date,
            'tone' => $tone,
            'label' => $label !== '' ? $label : ($labels[$tone] ?? 'Yet to be delivered'),
        ];
    }

    private static function statusLabel(string $status): string
    {
        $text = str_replace('_', ' ', trim($status));
        if ($text === '') {
            return 'Yet to be delivered';
        }

        return strtoupper($text[0]) . substr($text, 1);
    }

    /**
     * @param array<string, mixed> $filters same shape as listOrders
     *
     * @return list<array<string, string>>
     */
    public static function csvRows(array $filters = []): array
    {
        $orders = self::listOrders(array_merge($filters, ['limit' => (int) ($filters['limit'] ?? 500)]));

        $header = [
            'orderNumber',
            'orderId',
            'customerName',
            'customerEmail',
            'status',
            'paymentStatus',
            'deliveryType',
            'subtotal',
            'discount',
            'tax',
            'deliveryFee',
            'payable',
            'razorpayOrderId',
            'razorpayPaymentId',
            'paidAt',
            'createdAt',
        ];

        $rows = [$header];
        foreach ($orders as $o) {
            $rows[] = [
                'orderNumber' => (string) ($o['orderNumber'] ?? ''),
                'orderId' => (string) ($o['id'] ?? ''),
                'customerName' => (string) ($o['customerName'] ?? ''),
                'customerEmail' => (string) ($o['customerEmail'] ?? ''),
                'status' => (string) ($o['status'] ?? ''),
                'paymentStatus' => (string) ($o['paymentStatus'] ?? ''),
                'deliveryType' => (string) ($o['deliveryType'] ?? ''),
                'subtotal' => (string) ($o['subtotal'] ?? '0'),
                'discount' => (string) ($o['discount'] ?? '0'),
                'tax' => (string) ($o['tax'] ?? '0'),
                'deliveryFee' => (string) ($o['deliveryFee'] ?? '0'),
                'payable' => (string) ($o['payable'] ?? '0'),
                'razorpayOrderId' => (string) ($o['razorpayOrderId'] ?? ''),
                'razorpayPaymentId' => (string) ($o['razorpayPaymentId'] ?? ''),
                'paidAt' => (string) ($o['paidAt'] ?? ''),
                'createdAt' => (string) ($o['createdAt'] ?? ''),
            ];
        }

        return $rows;
    }

    /**
     * @param array{
     *   from?: string,
     *   to?: string,
     *   status?: string,
     *   paymentStatus?: string,
     *   deliveryType?: string,
     *   search?: string,
     *   customerId?: string,
     *   limit?: int
     * } $filters
     *
     * @return list<array<string, mixed>>
     */
    public static function listOrders(array $filters = []): array
    {
        AdminSchema::ensure();
        Schema::ensure();
        $pdo = Connection::pdo();
        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        $hasPay = is_array($cols) && in_array('payment_status', $cols, true);

        $from = trim((string) ($filters['from'] ?? ''));
        $to = trim((string) ($filters['to'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));
        $paymentStatus = trim((string) ($filters['paymentStatus'] ?? ''));
        $deliveryType = trim((string) ($filters['deliveryType'] ?? ''));
        $search = trim((string) ($filters['search'] ?? ''));
        $customerIdFilter = trim((string) ($filters['customerId'] ?? ''));
        $bucket = trim((string) ($filters['bucket'] ?? ''));
        $limit = max(1, min(2000, (int) ($filters['limit'] ?? 80)));

        $where = ['1=1'];
        $params = [];

        if ($customerIdFilter !== '') {
            $where[] = 'o.customer_id = ?';
            $params[] = $customerIdFilter;
        }

        if ($from !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
            $where[] = 'DATE(o.created_at) >= ?';
            $params[] = $from;
        }
        if ($to !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            $where[] = 'DATE(o.created_at) <= ?';
            $params[] = $to;
        }
        if ($bucket === 'cancelled') {
            $where[] = '(o.status = "cancelled" OR o.cancellation_requested = 1)';
        } elseif ($bucket === 'pending') {
            $where[] = 'o.status = "pending_payment"';
        } elseif ($bucket === 'confirmed') {
            $where[] = 'o.status IN ("confirmed", "preparing", "assigned", "out_for_delivery", "delivered")';
        } elseif ($status !== '') {
            $where[] = 'o.status = ?';
            $params[] = $status;
        }
        if ($hasPay && $paymentStatus !== '') {
            $where[] = 'o.payment_status = ?';
            $params[] = $paymentStatus;
        }
        if ($deliveryType !== '') {
            $where[] = 'o.delivery_type = ?';
            $params[] = $deliveryType;
        }
        if ($search !== '') {
            $where[] = '(o.order_number LIKE ? OR c.email LIKE ? OR c.name LIKE ?)';
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $paySelect = $hasPay ? 'o.payment_status' : '"" AS payment_status';
        $sql = "SELECT o.id, o.order_number, o.customer_id, o.status, {$paySelect},
                       o.delivery_type, o.slot_key, o.slot_label, o.slot_date, o.subtotal, o.discount,
                       o.delivery_fee, o.tax, o.payable, o.razorpay_order_id, o.razorpay_payment_id,
                       o.cancellation_requested, o.cancellation_reason, o.paid_at, o.created_at,
                       c.name AS customer_name, c.email AS customer_email
                FROM orders o
                INNER JOIN customers c ON c.id = o.customer_id
                WHERE " . implode(' AND ', $where) . '
                ORDER BY o.created_at DESC
                LIMIT ' . (int) $limit;

        $st = $pdo->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        return array_map(
            static fn (array $row): array => self::presentOrder($row, $hasPay),
            is_array($rows) ? $rows : [],
        );
    }

    /** @param array<string, mixed> $row */
    private static function presentOrder(array $row, bool $hasPay): array
    {
        return [
            'id' => (string) $row['id'],
            'orderNumber' => (string) $row['order_number'],
            'customerId' => (string) $row['customer_id'],
            'customerName' => (string) ($row['customer_name'] ?? ''),
            'customerEmail' => (string) ($row['customer_email'] ?? ''),
            'status' => (string) $row['status'],
            'paymentStatus' => $hasPay ? (string) ($row['payment_status'] ?? '') : '',
            'deliveryType' => (string) $row['delivery_type'],
            'slotKey' => (string) $row['slot_key'],
            'slotLabel' => (string) ($row['slot_label'] ?? ''),
            'slotDate' => $row['slot_date'] ? (string) $row['slot_date'] : '',
            'cancellationRequested' => !empty($row['cancellation_requested']),
            'cancellationReason' => (string) ($row['cancellation_reason'] ?? ''),
            'subtotal' => (int) $row['subtotal'],
            'discount' => (int) $row['discount'],
            'deliveryFee' => (int) $row['delivery_fee'],
            'tax' => (int) $row['tax'],
            'payable' => (int) $row['payable'],
            'razorpayOrderId' => (string) ($row['razorpay_order_id'] ?? ''),
            'razorpayPaymentId' => (string) ($row['razorpay_payment_id'] ?? ''),
            'paidAt' => !empty($row['paid_at']) ? (string) $row['paid_at'] : '',
            'createdAt' => (string) $row['created_at'],
        ];
    }
}
