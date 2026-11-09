<?php

declare(strict_types=1);

namespace App\Order;

use App\Admin\CouponService;
use App\Auth\Addresses;
use App\Auth\Support;
use App\Cart\Quote;
use App\Database\Connection;
use App\Admin\StoreHours;
use App\Payment\RazorpayGateway;
use App\Subscription\SubscriptionCheckout;
use PDO;

final class Checkout
{
    /** @param array<string, mixed> $customer @param array<string, mixed> $input @return array<string, mixed> */
    public static function place(array $customer, array $input): array
    {
        Schema::ensure();
        if (!StoreHours::acceptingWebsiteOrders()) {
            throw new OrderException('The store is closed.');
        }
        $customerId = (string) $customer['id'];
        $addressId = trim((string) ($input['addressId'] ?? ''));
        $notes = trim((string) ($input['notes'] ?? ''));
        if (strlen($notes) > 240) {
            throw new OrderException('Keep the delivery note under 240 characters.');
        }
        $reorderOfOrderId = trim((string) ($input['reorderOfOrderId'] ?? ''));

        $presented = Addresses::getForCustomer($customerId, $addressId);
        if ($presented === null) {
            throw new OrderException('Choose a delivery address.');
        }

        $quoteInput = [
            'items' => is_array($input['items'] ?? null) ? $input['items'] : [],
            'coupon' => $input['coupon'] ?? '',
            'customerId' => $customerId,
            'latitude' => $presented['latitude'],
            'longitude' => $presented['longitude'],
            'pin' => $presented['pin'],
            'subscriptionSchedule' => '',
        ];
        $quote = Quote::build($quoteInput);
        $couponId = trim((string) ($quote['coupon']['couponId'] ?? ''));
        if ($quote['coupon']['applied'] && $couponId !== '') {
            CouponService::validateUsage($couponId, $customerId);
        }
        if (!$quote['serviceable']) {
            throw new OrderException((string) ($quote['serviceability']['message'] ?: 'Update the cart before checkout.'));
        }

        $orderKind = (string) ($quote['orderKind'] ?? 'quick');
        if ($orderKind === 'subscription') {
            throw new OrderException('Monthly subscriptions are paid from the Subscriptions page. Open Subscriptions, pick a plan, and complete payment there.');
        }

        $resolved = DeliverySlots::resolveQuickCheckout($quoteInput);
        $type = $resolved['deliveryType'];
        $slot = $resolved['slot'];

        $lines = array_values(array_filter($quote['items'], static fn (array $line): bool => $line['ok']));
        if ($lines === []) {
            throw new OrderException('Add at least one product to checkout.');
        }

        $orderId = Support::uuid();
        $number = self::orderNumber();
        $now = Support::now();
        $payable = (int) $quote['payable'];
        $payablePaise = $payable * 100;
        $payment = RazorpayGateway::createOrder($payablePaise, $number);

        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
            $hasExt = is_array($cols) && in_array('payment_status', $cols, true);
            $hasCouponCol = is_array($cols) && in_array('coupon_id', $cols, true);
            $couponIdDb = $couponId !== '' ? $couponId : null;
            if ($hasExt) {
                if ($hasCouponCol && $reorderOfOrderId !== '') {
                    $pdo->prepare(
                        'INSERT INTO orders
                         (id, order_number, customer_id, status, payment_status, fulfillment_status, delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                          address_id, address_json, coupon_code, coupon_id, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                          razorpay_order_id, reorder_of_order_id, created_at, updated_at)
                         VALUES (?, ?, ?, "pending_payment", "pending", "pending", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    )->execute([
                        $orderId,
                        $number,
                        $customerId,
                        $type,
                        (string) $slot['key'],
                        (string) $slot['label'],
                        $slot['date'] !== '' ? $slot['date'] : null,
                        (int) ($slot['etaMinutes'] ?? 0),
                        $addressId,
                        json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        (string) ($quote['coupon']['code'] ?? ''),
                        $couponIdDb,
                        (int) $quote['subtotal'],
                        (int) $quote['discount'],
                        (int) $quote['deliveryFee'],
                        (int) $quote['tax'],
                        $payable,
                        $notes,
                        $payment['orderId'],
                        $reorderOfOrderId,
                        $now,
                        $now,
                    ]);
                } elseif ($hasCouponCol) {
                    $pdo->prepare(
                        'INSERT INTO orders
                         (id, order_number, customer_id, status, payment_status, fulfillment_status, delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                          address_id, address_json, coupon_code, coupon_id, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                          razorpay_order_id, created_at, updated_at)
                         VALUES (?, ?, ?, "pending_payment", "pending", "pending", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    )->execute([
                        $orderId,
                        $number,
                        $customerId,
                        $type,
                        (string) $slot['key'],
                        (string) $slot['label'],
                        $slot['date'] !== '' ? $slot['date'] : null,
                        (int) ($slot['etaMinutes'] ?? 0),
                        $addressId,
                        json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        (string) ($quote['coupon']['code'] ?? ''),
                        $couponIdDb,
                        (int) $quote['subtotal'],
                        (int) $quote['discount'],
                        (int) $quote['deliveryFee'],
                        (int) $quote['tax'],
                        $payable,
                        $notes,
                        $payment['orderId'],
                        $now,
                        $now,
                    ]);
                } elseif ($reorderOfOrderId !== '') {
                    $pdo->prepare(
                        'INSERT INTO orders
                         (id, order_number, customer_id, status, payment_status, fulfillment_status, delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                          address_id, address_json, coupon_code, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                          razorpay_order_id, reorder_of_order_id, created_at, updated_at)
                         VALUES (?, ?, ?, "pending_payment", "pending", "pending", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    )->execute([
                        $orderId,
                        $number,
                        $customerId,
                        $type,
                        (string) $slot['key'],
                        (string) $slot['label'],
                        $slot['date'] !== '' ? $slot['date'] : null,
                        (int) ($slot['etaMinutes'] ?? 0),
                        $addressId,
                        json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        (string) ($quote['coupon']['code'] ?? ''),
                        (int) $quote['subtotal'],
                        (int) $quote['discount'],
                        (int) $quote['deliveryFee'],
                        (int) $quote['tax'],
                        $payable,
                        $notes,
                        $payment['orderId'],
                        $reorderOfOrderId,
                        $now,
                        $now,
                    ]);
                } else {
                    $pdo->prepare(
                        'INSERT INTO orders
                         (id, order_number, customer_id, status, payment_status, fulfillment_status, delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                          address_id, address_json, coupon_code, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                          razorpay_order_id, created_at, updated_at)
                         VALUES (?, ?, ?, "pending_payment", "pending", "pending", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    )->execute([
                        $orderId,
                        $number,
                        $customerId,
                        $type,
                        (string) $slot['key'],
                        (string) $slot['label'],
                        $slot['date'] !== '' ? $slot['date'] : null,
                        (int) ($slot['etaMinutes'] ?? 0),
                        $addressId,
                        json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        (string) ($quote['coupon']['code'] ?? ''),
                        (int) $quote['subtotal'],
                        (int) $quote['discount'],
                        (int) $quote['deliveryFee'],
                        (int) $quote['tax'],
                        $payable,
                        $notes,
                        $payment['orderId'],
                        $now,
                        $now,
                    ]);
                }
            } elseif ($hasCouponCol) {
                $pdo->prepare(
                    'INSERT INTO orders
                     (id, order_number, customer_id, status, delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                      address_id, address_json, coupon_code, coupon_id, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                      razorpay_order_id, created_at, updated_at)
                     VALUES (?, ?, ?, "pending_payment", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )->execute([
                    $orderId,
                    $number,
                    $customerId,
                    $type,
                    (string) $slot['key'],
                    (string) $slot['label'],
                    $slot['date'] !== '' ? $slot['date'] : null,
                    (int) ($slot['etaMinutes'] ?? 0),
                    $addressId,
                    json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    (string) ($quote['coupon']['code'] ?? ''),
                    $couponIdDb,
                    (int) $quote['subtotal'],
                    (int) $quote['discount'],
                    (int) $quote['deliveryFee'],
                    (int) $quote['tax'],
                    $payable,
                    $notes,
                    $payment['orderId'],
                    $now,
                    $now,
                ]);
            } else {
                $pdo->prepare(
                    'INSERT INTO orders
                     (id, order_number, customer_id, status, delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                      address_id, address_json, coupon_code, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                      razorpay_order_id, created_at, updated_at)
                     VALUES (?, ?, ?, "pending_payment", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )->execute([
                    $orderId,
                    $number,
                    $customerId,
                    $type,
                    (string) $slot['key'],
                    (string) $slot['label'],
                    $slot['date'] !== '' ? $slot['date'] : null,
                    (int) ($slot['etaMinutes'] ?? 0),
                    $addressId,
                    json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    (string) ($quote['coupon']['code'] ?? ''),
                    (int) $quote['subtotal'],
                    (int) $quote['discount'],
                    (int) $quote['deliveryFee'],
                    (int) $quote['tax'],
                    $payable,
                    $notes,
                    $payment['orderId'],
                    $now,
                    $now,
                ]);
            }

            $itemInsert = $pdo->prepare(
                'INSERT INTO order_items (id, order_id, product_id, variant_id, name, unit, qty, price, line_total, tax)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            );
            foreach ($lines as $line) {
                $itemInsert->execute([
                    Support::uuid(),
                    $orderId,
                    (string) $line['productId'],
                    (string) $line['variantId'],
                    (string) $line['name'],
                    (string) $line['unit'],
                    (int) $line['qty'],
                    (int) $line['price'],
                    (int) $line['lineTotal'],
                    (int) $line['tax'],
                ]);
            }
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        return [
            'order' => self::find($customerId, $orderId),
            'razorpay' => $payment,
            'quote' => [
                'subtotal' => $quote['subtotal'],
                'discount' => $quote['discount'],
                'deliveryFee' => $quote['deliveryFee'],
                'tax' => $quote['tax'],
                'payable' => $quote['payable'],
            ],
        ];
    }

    /** @param array<string, mixed> $customer @param array<string, mixed> $input @return array<string, mixed> */
    public static function verify(array $customer, array $input): array
    {
        Schema::ensure();
        $customerId = (string) $customer['id'];
        $orderId = trim((string) ($input['orderId'] ?? ''));
        $order = self::row($customerId, $orderId);
        if ($order === null) {
            throw new OrderException('That order was not found.', 404);
        }
        if ((string) $order['status'] !== 'pending_payment') {
            return ['order' => self::present($order)];
        }

        $mock = filter_var($input['mock'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $sync = filter_var($input['sync'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $paymentId = trim((string) ($input['razorpayPaymentId'] ?? $input['paymentId'] ?? ''));
        $signature = trim((string) ($input['razorpaySignature'] ?? $input['signature'] ?? ''));

        if ($mock) {
            if (!RazorpayGateway::mockAllowed()) {
                throw new OrderException('Test payment is only available in local preview.', 403);
            }
            $paymentId = 'mock_pay_' . bin2hex(random_bytes(6));
        } elseif ($paymentId !== '' && $signature !== '') {
            RazorpayGateway::verify((string) $order['razorpay_order_id'], $paymentId, $signature);
        } elseif ($sync) {
            try {
                $paymentId = RazorpayGateway::capturedPaymentId(
                    (string) $order['razorpay_order_id'],
                    (int) $order['payable'] * 100,
                ) ?? '';
            } catch (\Throwable) {
                $paymentId = '';
            }
            if ($paymentId === '') {
                return ['pending' => true, 'order' => self::present($order)];
            }
        } else {
            throw new OrderException('The payment confirmation was incomplete.');
        }

        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            $orderForType = $pdo->prepare('SELECT delivery_type FROM orders WHERE id = ? LIMIT 1');
            $orderForType->execute([$orderId]);
            $dtype = (string) $orderForType->fetchColumn();
            if ($dtype !== 'subscription') {
                self::reserveStock($orderId);
            }
            $now = Support::now();
            $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
            $hasExt = is_array($cols) && in_array('payment_status', $cols, true);
            if ($hasExt) {
                $updated = $pdo->prepare(
                    'UPDATE orders SET status = "confirmed", payment_status = "paid", fulfillment_status = "confirmed",
                     razorpay_payment_id = ?, paid_at = ?, updated_at = ?
                     WHERE id = ? AND customer_id = ? AND status = "pending_payment"',
                );
            } else {
                $updated = $pdo->prepare(
                    'UPDATE orders SET status = "confirmed", razorpay_payment_id = ?, paid_at = ?, updated_at = ?
                     WHERE id = ? AND customer_id = ? AND status = "pending_payment"',
                );
            }
            $updated->execute([$paymentId, $now, $now, $orderId, $customerId]);
            if ($updated->rowCount() !== 1) {
                throw new OrderException('This payment could not be confirmed.');
            }

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        try {
            $couponStmt = Connection::pdo()->prepare(
                'SELECT coupon_id, discount FROM orders WHERE id = ? AND customer_id = ? LIMIT 1',
            );
            $couponStmt->execute([$orderId, $customerId]);
            $couponRow = $couponStmt->fetch(PDO::FETCH_ASSOC);
            if (is_array($couponRow) && !empty($couponRow['coupon_id']) && (int) ($couponRow['discount'] ?? 0) > 0) {
                CouponService::recordRedemption(
                    (string) $couponRow['coupon_id'],
                    $customerId,
                    $orderId,
                    (int) $couponRow['discount'],
                );
            }
        } catch (\Throwable) {
            error_log('Coupon redemption failed for order ' . $orderId);
        }

        try {
            SubscriptionCheckout::activatePaidCycle($orderId);
        } catch (\Throwable) {
            // Scheduler/backfill can repair subscription state if needed
        }

        $fresh = self::row($customerId, $orderId);
        if ($fresh === null) {
            throw new OrderException('That order was not found.', 404);
        }

        return ['order' => self::present($fresh)];
    }

    /** @return list<array<string, mixed>> */
    public static function list(string $customerId): array
    {
        Schema::ensure();
        $statement = Connection::pdo()->prepare(
            'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 40',
        );
        $statement->execute([$customerId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

        return array_map(self::present(...), is_array($rows) ? $rows : []);
    }

    /** @return array<string, mixed> */
    public static function detail(string $customerId, string $orderId): array
    {
        Schema::ensure();
        $order = self::row($customerId, $orderId);
        if ($order === null) {
            throw new OrderException('That order was not found.', 404);
        }

        return self::present($order, true);
    }

    /** @return array<string, mixed>|null */
    public static function rowById(string $customerId, string $orderId): ?array
    {
        return self::row($customerId, $orderId);
    }

    /** @return array<string, mixed>|null */
    private static function row(string $customerId, string $orderId): ?array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT * FROM orders WHERE id = ? AND customer_id = ? LIMIT 1',
        );
        $statement->execute([$orderId, $customerId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null */
    private static function find(string $customerId, string $orderId): ?array
    {
        $row = self::row($customerId, $orderId);

        return $row ? self::present($row, true) : null;
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    public static function presentRow(array $row, bool $withItems = false): array
    {
        return self::present($row, $withItems);
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private static function present(array $row, bool $withItems = false): array
    {
        $address = json_decode((string) $row['address_json'], true);
        $payload = [
            'id' => (string) $row['id'],
            'orderNumber' => (string) $row['order_number'],
            'status' => (string) $row['status'],
            'statusLabel' => self::statusLabel((string) $row['status']),
            'paymentStatus' => isset($row['payment_status']) ? (string) $row['payment_status'] : self::inferPaymentStatus((string) $row['status']),
            'paymentStatusLabel' => self::paymentStatusLabel(isset($row['payment_status']) ? (string) $row['payment_status'] : self::inferPaymentStatus((string) $row['status'])),
            'fulfillmentStatus' => isset($row['fulfillment_status']) ? (string) $row['fulfillment_status'] : self::inferFulfillmentStatus((string) $row['status']),
            'fulfillmentStatusLabel' => self::fulfillmentStatusLabel(isset($row['fulfillment_status']) ? (string) $row['fulfillment_status'] : self::inferFulfillmentStatus((string) $row['status'])),
            'cancellationRequested' => isset($row['cancellation_requested']) ? (bool) (int) $row['cancellation_requested'] : false,
            'cancellationReason' => (string) ($row['cancellation_reason'] ?? ''),
            'refundStatus' => isset($row['refund_status']) ? (string) $row['refund_status'] : '',
            'subscriptionId' => isset($row['subscription_id']) && $row['subscription_id'] ? (string) $row['subscription_id'] : '',
            'subscriptionCycleId' => isset($row['subscription_cycle_id']) && $row['subscription_cycle_id'] ? (string) $row['subscription_cycle_id'] : '',
            'reorderOfOrderId' => isset($row['reorder_of_order_id']) && $row['reorder_of_order_id'] ? (string) $row['reorder_of_order_id'] : '',
            'deliveryType' => (string) $row['delivery_type'],
            'slotKey' => (string) $row['slot_key'],
            'slotLabel' => (string) $row['slot_label'],
            'slotDate' => $row['slot_date'] ? (string) $row['slot_date'] : '',
            'etaMinutes' => (int) $row['eta_minutes'],
            'couponCode' => (string) $row['coupon_code'],
            'couponId' => isset($row['coupon_id']) && $row['coupon_id'] ? (string) $row['coupon_id'] : '',
            'subtotal' => (int) $row['subtotal'],
            'discount' => (int) $row['discount'],
            'deliveryFee' => (int) $row['delivery_fee'],
            'tax' => (int) $row['tax'],
            'payable' => (int) $row['payable'],
            'deliveryNote' => (string) $row['delivery_note'],
            'address' => is_array($address) ? $address : [],
            'paidAt' => $row['paid_at'] ? (string) $row['paid_at'] : '',
            'createdAt' => (string) $row['created_at'],
        ];
        if ($withItems) {
            $statement = Connection::pdo()->prepare(
                'SELECT product_id, variant_id, name, unit, qty, price, line_total, tax
                 FROM order_items WHERE order_id = ? ORDER BY name',
            );
            $statement->execute([(string) $row['id']]);
            $items = $statement->fetchAll(PDO::FETCH_ASSOC);
            $payload['items'] = array_map(static fn (array $item): array => [
                'productId' => (string) $item['product_id'],
                'variantId' => (string) $item['variant_id'],
                'name' => (string) $item['name'],
                'unit' => (string) $item['unit'],
                'qty' => (int) $item['qty'],
                'price' => (int) $item['price'],
                'lineTotal' => (int) $item['line_total'],
                'tax' => (int) $item['tax'],
            ], is_array($items) ? $items : []);
        }

        return $payload;
    }

    private static function statusLabel(string $status): string
    {
        return match ($status) {
            'pending_payment' => 'Pending payment',
            'paid' => 'Paid',
            'confirmed' => 'Confirmed',
            'preparing' => 'Processing',
            'assigned' => 'Assigned',
            'out_for_delivery' => 'Out for delivery',
            'delivered' => 'Delivered',
            'cancelled' => 'Cancelled',
            'failed' => 'Failed',
            'refund_initiated' => 'Refund initiated',
            'refunded' => 'Refunded',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    private static function inferPaymentStatus(string $status): string
    {
        return match ($status) {
            'pending_payment' => 'pending',
            'cancelled', 'failed' => 'failed',
            default => 'paid',
        };
    }

    private static function paymentStatusLabel(string $status): string
    {
        return match ($status) {
            'pending' => 'Pending',
            'paid' => 'Paid',
            'failed' => 'Failed',
            'refunded' => 'Refunded',
            'refund_pending' => 'Refund pending',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    private static function inferFulfillmentStatus(string $status): string
    {
        return match ($status) {
            'pending_payment' => 'pending',
            'confirmed' => 'confirmed',
            'preparing' => 'processing',
            'assigned' => 'assigned',
            'out_for_delivery' => 'out_for_delivery',
            'delivered' => 'delivered',
            'cancelled', 'refunded', 'refund_initiated' => 'cancelled',
            default => 'pending',
        };
    }

    private static function fulfillmentStatusLabel(string $status): string
    {
        return match ($status) {
            'pending' => 'Pending',
            'confirmed' => 'Confirmed',
            'processing' => 'Processing',
            'assigned' => 'Assigned',
            'out_for_delivery' => 'Out for delivery',
            'delivered' => 'Delivered',
            'cancelled' => 'Cancelled',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    public static function orderNumber(): string
    {
        return self::orderNumberForInsert(Connection::pdo());
    }

    public static function orderNumberForInsert(PDO $pdo): string
    {
        $date = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Ymd');
        $statement = $pdo->prepare(
            'SELECT COUNT(*) FROM orders WHERE order_number LIKE ?',
        );
        $statement->execute(['RF-' . $date . '-%']);
        $count = (int) $statement->fetchColumn() + 1;

        return 'RF-' . $date . '-' . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }

    private static function reserveStock(string $orderId): void
    {
        $statement = Connection::pdo()->prepare(
            'SELECT variant_id, qty FROM order_items WHERE order_id = ?',
        );
        $statement->execute([$orderId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $update = Connection::pdo()->prepare(
            'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?',
        );
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $qty = (int) $row['qty'];
            $update->execute([$qty, (string) $row['variant_id'], $qty]);
            if ($update->rowCount() !== 1) {
                throw new OrderException('An item went out of stock before payment finished.');
            }
        }
    }
}
