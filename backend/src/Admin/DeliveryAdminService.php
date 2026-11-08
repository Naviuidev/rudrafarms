<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;
use App\Subscription\SubscriptionSchema;
use PDO;

final class DeliveryAdminService
{
    private static array $statuses = [
        'pending_assignment',
        'assigned',
        'processing',
        'out_for_delivery',
        'delivered',
        'failed',
        'rescheduled',
        'cancelled',
    ];

    /** @return list<array<string, mixed>> */
    public static function listPersonnel(): array
    {
        AdminSchema::ensure();
        $rows = Connection::pdo()->query(
            'SELECT * FROM delivery_personnel ORDER BY name',
        )->fetchAll(PDO::FETCH_ASSOC);

        return array_map(self::presentPersonnel(...), is_array($rows) ? $rows : []);
    }

    /** @param array<string, mixed> $input */
    public static function savePersonnel(array $input): array
    {
        AdminSchema::ensure();
        $id = trim((string) ($input['id'] ?? ''));
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Enter a name.');
        }
        $phone = trim((string) ($input['phone'] ?? ''));
        $address = trim((string) ($input['address'] ?? ''));
        $vehicle = trim((string) ($input['vehicle'] ?? ''));
        $active = filter_var($input['active'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        $pdo = Connection::pdo();
        $now = Support::now();
        if ($id === '') {
            $id = Support::uuid();
            $pdo->prepare(
                'INSERT INTO delivery_personnel (id, name, phone, address, vehicle, active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            )->execute([$id, $name, $phone, $address, $vehicle, $active, $now, $now]);
        } else {
            $pdo->prepare(
                'UPDATE delivery_personnel SET name = ?, phone = ?, address = ?, vehicle = ?, active = ?, updated_at = ? WHERE id = ?',
            )->execute([$name, $phone, $address, $vehicle, $active, $now, $id]);
        }

        return self::listPersonnel();
    }

    /**
     * @param array{
     *   from?: string,
     *   to?: string,
     *   personnelId?: string,
     *   status?: string,
     * } $filters
     *
     * @return list<array<string, mixed>>
     */
    public static function listAssignments(array $filters = []): array
    {
        AdminSchema::ensure();
        $pdo = Connection::pdo();
        $from = trim((string) ($filters['from'] ?? ''));
        $to = trim((string) ($filters['to'] ?? ''));
        $personnelId = trim((string) ($filters['personnelId'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));

        $where = ['1=1'];
        $params = [];
        if ($from !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
            $where[] = 'DATE(da.updated_at) >= ?';
            $params[] = $from;
        }
        if ($to !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            $where[] = 'DATE(da.updated_at) <= ?';
            $params[] = $to;
        }
        if ($personnelId !== '') {
            $where[] = 'da.personnel_id = ?';
            $params[] = $personnelId;
        }
        if ($status !== '') {
            $where[] = 'da.status = ?';
            $params[] = $status;
        }

        $sql = 'SELECT da.*, dp.name AS personnel_name,
                       o.order_number, o.delivery_type,
                       sd.delivery_date AS subscription_delivery_date
                FROM delivery_assignments da
                LEFT JOIN delivery_personnel dp ON dp.id = da.personnel_id
                LEFT JOIN orders o ON o.id = da.order_id
                LEFT JOIN subscription_deliveries sd ON sd.id = da.subscription_delivery_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY da.updated_at DESC
                LIMIT 200';
        $st = $pdo->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        return array_map(self::presentAssignment(...), is_array($rows) ? $rows : []);
    }

    /**
     * @param array<string, mixed> $input
     * assignment id optional (create new row targeting one of orderId / subscriptionDeliveryId)
     */
    public static function upsertAssignment(array $input): array
    {
        AdminSchema::ensure();
        $id = trim((string) ($input['id'] ?? ''));
        $orderId = trim((string) ($input['orderId'] ?? ''));
        $subDelId = trim((string) ($input['subscriptionDeliveryId'] ?? ''));
        $personnelId = trim((string) ($input['personnelId'] ?? ''));
        $status = strtolower(trim((string) ($input['status'] ?? 'pending_assignment')));
        if (!in_array($status, self::$statuses, true)) {
            throw new \InvalidArgumentException('Invalid delivery status.');
        }
        $notes = trim((string) ($input['notes'] ?? ''));
        $pdo = Connection::pdo();
        $now = Support::now();

        $pdo->beginTransaction();
        try {
            if ($id === '') {
                if ($orderId === '' && $subDelId === '') {
                    throw new \InvalidArgumentException('Link to an order or a subscription delivery.');
                }
                if ($orderId !== '' && $subDelId !== '') {
                    throw new \InvalidArgumentException('Choose either an order or a subscription delivery.');
                }
                $id = Support::uuid();
                $personnelDb = $personnelId !== '' ? $personnelId : null;
                $pdo->prepare(
                    'INSERT INTO delivery_assignments (id, personnel_id, order_id, subscription_delivery_id, status, notes, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                )->execute([
                    $id,
                    $personnelDb,
                    $orderId !== '' ? $orderId : null,
                    $subDelId !== '' ? $subDelId : null,
                    $status,
                    $notes,
                    $now,
                    $now,
                ]);
                self::appendHistory($pdo, $id, $status, $notes, '', '', 'admin');
            } else {
                $rowStmt = $pdo->prepare(
                    'SELECT status, order_id, subscription_delivery_id FROM delivery_assignments WHERE id = ? FOR UPDATE',
                );
                $rowStmt->execute([$id]);
                $existing = $rowStmt->fetch(PDO::FETCH_ASSOC);
                if (!is_array($existing)) {
                    throw new \InvalidArgumentException('Assignment not found.');
                }
                $oldStatus = (string) $existing['status'];
                if ($orderId === '') {
                    $orderId = $existing['order_id'] ? (string) $existing['order_id'] : '';
                }
                if ($subDelId === '') {
                    $subDelId = $existing['subscription_delivery_id'] ? (string) $existing['subscription_delivery_id'] : '';
                }
                if ($orderId === '' && $subDelId === '') {
                    throw new \InvalidArgumentException('Assignment must reference an order or subscription delivery.');
                }
                if ($orderId !== '' && $subDelId !== '') {
                    throw new \InvalidArgumentException('Choose either an order or a subscription delivery.');
                }
                $personnelDb = $personnelId !== '' ? $personnelId : null;
                $pdo->prepare(
                    'UPDATE delivery_assignments SET personnel_id = ?, order_id = ?, subscription_delivery_id = ?, status = ?, notes = ?, updated_at = ?
                     WHERE id = ?',
                )->execute([
                    $personnelDb,
                    $orderId !== '' ? $orderId : null,
                    $subDelId !== '' ? $subDelId : null,
                    $status,
                    $notes,
                    $now,
                    $id,
                ]);
                if ($oldStatus !== $status || $notes !== '') {
                    self::appendHistory($pdo, $id, $status, $notes, (string) ($input['failureReason'] ?? ''), (string) ($input['proofRef'] ?? ''), 'admin');
                }
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        if ($orderId !== '') {
            AdminOrdersService::syncFromDelivery($orderId, $status, $notes);
        }

        return self::listAssignments([]);
    }

    /**
     * @param array{assignmentId: string, status: string, notes?: string, failureReason?: string, proofRef?: string, updatedBy?: string} $input
     */
    public static function setAssignmentStatus(array $input): array
    {
        AdminSchema::ensure();
        $id = trim((string) ($input['assignmentId'] ?? ''));
        if ($id === '') {
            throw new \InvalidArgumentException('Choose an assignment.');
        }
        $status = strtolower(trim((string) ($input['status'] ?? '')));
        if (!in_array($status, self::$statuses, true)) {
            throw new \InvalidArgumentException('Invalid delivery status.');
        }
        $notes = trim((string) ($input['notes'] ?? ''));
        $failure = trim((string) ($input['failureReason'] ?? ''));
        $proof = trim((string) ($input['proofRef'] ?? ''));
        $by = trim((string) ($input['updatedBy'] ?? 'admin'));
        if ($by === '') {
            $by = 'admin';
        }

        $pdo = Connection::pdo();
        $now = Support::now();
        $pdo->beginTransaction();
        try {
            $upd = $pdo->prepare(
                'UPDATE delivery_assignments SET status = ?, notes = ?, updated_at = ? WHERE id = ?',
            );
            $upd->execute([$status, $notes, $now, $id]);
            if ($upd->rowCount() !== 1) {
                throw new \InvalidArgumentException('Assignment not found.');
            }
            self::appendHistory($pdo, $id, $status, $notes, $failure, $proof, $by);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        $linked = Connection::pdo()->prepare('SELECT order_id, subscription_delivery_id FROM delivery_assignments WHERE id = ?');
        $linked->execute([$id]);
        $link = $linked->fetch(PDO::FETCH_ASSOC);
        if (is_array($link) && !empty($link['order_id'])) {
            AdminOrdersService::syncFromDelivery((string) $link['order_id'], $status, $notes);
        }
        if (is_array($link) && !empty($link['subscription_delivery_id'])) {
            self::syncSubscriptionDay((string) $link['subscription_delivery_id'], $status, $notes);
        }

        return self::listAssignments([]);
    }

    private static function syncSubscriptionDay(string $subscriptionDeliveryId, string $status, string $notes): void
    {
        $orderStatus = match ($status) {
            'processing' => 'preparing',
            'pending_assignment', 'assigned', 'rescheduled' => 'assigned',
            'out_for_delivery' => 'out_for_delivery',
            'delivered' => 'delivered',
            'failed' => 'failed',
            'cancelled' => 'cancelled',
            default => '',
        };
        if ($orderStatus === '') {
            return;
        }

        $st = Connection::pdo()->prepare(
            'SELECT sd.delivery_date, cy.orders_order_id
             FROM subscription_deliveries sd
             INNER JOIN subscription_cycles cy ON cy.id = sd.cycle_id
             WHERE sd.id = ?
             LIMIT 1',
        );
        $st->execute([$subscriptionDeliveryId]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row) || empty($row['orders_order_id']) || empty($row['delivery_date'])) {
            return;
        }

        try {
            AdminOrdersService::updateDeliveryDay((string) $row['orders_order_id'], (string) $row['delivery_date'], $orderStatus, $notes);
        } catch (\InvalidArgumentException) {
            // The billing order can reject a status without losing the delivery assignment.
        }
    }

    /** @return list<array<string, mixed>> */
    public static function statusHistory(string $assignmentId): array
    {
        AdminSchema::ensure();
        $st = Connection::pdo()->prepare(
            'SELECT * FROM delivery_status_history WHERE assignment_id = ? ORDER BY created_at ASC',
        );
        $st->execute([trim($assignmentId)]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'status' => (string) $row['status'],
            'notes' => (string) $row['notes'],
            'failureReason' => (string) $row['failure_reason'],
            'proofRef' => (string) $row['proof_ref'],
            'updatedBy' => (string) $row['updated_by'],
            'createdAt' => (string) $row['created_at'],
        ], is_array($rows) ? $rows : []);
    }

    private static function appendHistory(
        PDO $pdo,
        string $assignmentId,
        string $status,
        string $notes,
        string $failure,
        string $proof,
        string $updatedBy,
    ): void {
        $pdo->prepare(
            'INSERT INTO delivery_status_history (id, assignment_id, status, notes, failure_reason, proof_ref, updated_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )->execute([
            Support::uuid(),
            $assignmentId,
            $status,
            $notes,
            $failure,
            $proof,
            $updatedBy,
            Support::now(),
        ]);
    }

    /** @param array<string, mixed> $row */
    private static function presentPersonnel(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'phone' => (string) $row['phone'],
            'address' => (string) $row['address'],
            'vehicle' => (string) $row['vehicle'],
            'active' => (bool) (int) $row['active'],
        ];
    }

    /** @param array<string, mixed> $row */
    private static function presentAssignment(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'personnelId' => $row['personnel_id'] ? (string) $row['personnel_id'] : '',
            'personnelName' => (string) ($row['personnel_name'] ?? ''),
            'orderId' => $row['order_id'] ? (string) $row['order_id'] : '',
            'orderNumber' => (string) ($row['order_number'] ?? ''),
            'deliveryType' => (string) ($row['delivery_type'] ?? ''),
            'subscriptionDeliveryId' => $row['subscription_delivery_id'] ? (string) $row['subscription_delivery_id'] : '',
            'subscriptionDeliveryDate' => (string) ($row['subscription_delivery_date'] ?? ''),
            'status' => (string) $row['status'],
            'notes' => (string) $row['notes'],
            'updatedAt' => (string) $row['updated_at'],
            'createdAt' => (string) $row['created_at'],
        ];
    }

    /**
     * Paid quick/scheduled orders with no delivery_assignments row yet.
     *
     * @param array{from?: string, to?: string, limit?: int} $filters
     *
     * @return list<array<string, mixed>>
     */
    public static function pendingQuickOrders(array $filters = []): array
    {
        AdminSchema::ensure();
        $pdo = Connection::pdo();
        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        $hasFulfillment = is_array($cols) && in_array('fulfillment_status', $cols, true);

        $from = trim((string) ($filters['from'] ?? ''));
        $to = trim((string) ($filters['to'] ?? ''));
        $limit = max(1, min(150, (int) ($filters['limit'] ?? 80)));

        $where = [
            'o.paid_at IS NOT NULL',
            "o.delivery_type != 'subscription'",
            "o.status NOT IN ('cancelled', 'failed', 'pending_payment')",
            'NOT EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.order_id = o.id)',
        ];
        $params = [];

        if ($hasFulfillment) {
            $where[] = "o.fulfillment_status NOT IN ('delivered', 'cancelled')";
        } else {
            $where[] = "o.status NOT IN ('delivered')";
        }

        if ($from !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
            $where[] = '(o.slot_date IS NULL OR o.slot_date >= ?)';
            $params[] = $from;
        }
        if ($to !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            $where[] = '(o.slot_date IS NULL OR o.slot_date <= ?)';
            $params[] = $to;
        }

        $sql = 'SELECT o.id, o.order_number, o.customer_id, o.status, o.delivery_type, o.slot_key, o.slot_label, o.slot_date,
                       o.payable, o.paid_at, o.created_at,
                       c.name AS customer_name, c.email AS customer_email
                FROM orders o
                INNER JOIN customers c ON c.id = o.customer_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY o.created_at DESC
                LIMIT ' . (int) $limit;

        $st = $pdo->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'orderId' => (string) $row['id'],
            'orderNumber' => (string) $row['order_number'],
            'customerId' => (string) $row['customer_id'],
            'customerName' => (string) ($row['customer_name'] ?? ''),
            'customerEmail' => (string) ($row['customer_email'] ?? ''),
            'status' => (string) $row['status'],
            'deliveryType' => (string) $row['delivery_type'],
            'slotKey' => (string) $row['slot_key'],
            'slotLabel' => (string) ($row['slot_label'] ?? ''),
            'slotDate' => $row['slot_date'] ? (string) $row['slot_date'] : '',
            'payable' => (int) $row['payable'],
            'paidAt' => !empty($row['paid_at']) ? (string) $row['paid_at'] : '',
            'createdAt' => (string) $row['created_at'],
        ], is_array($rows) ? $rows : []);
    }

    /**
     * Scheduled subscription delivery rows with no assignment yet.
     *
     * @param array{from?: string, to?: string, limit?: int} $filters
     *
     * @return list<array<string, mixed>>
     */
    public static function pendingSubscriptionDeliveries(array $filters = []): array
    {
        AdminSchema::ensure();
        SubscriptionSchema::ensure();

        $pdo = Connection::pdo();
        $from = trim((string) ($filters['from'] ?? ''));
        $to = trim((string) ($filters['to'] ?? ''));
        $limit = max(1, min(150, (int) ($filters['limit'] ?? 80)));

        $where = [
            "sd.status = 'scheduled'",
            'NOT EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.subscription_delivery_id = sd.id)',
        ];
        $params = [];

        if ($from !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
            $where[] = 'sd.delivery_date >= ?';
            $params[] = $from;
        }
        if ($to !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            $where[] = 'sd.delivery_date <= ?';
            $params[] = $to;
        }

        $sql = 'SELECT sd.id, sd.subscription_id, sd.cycle_id, sd.delivery_date, sd.status,
                       s.schedule_key, s.customer_id,
                       c.name AS customer_name, c.email AS customer_email
                FROM subscription_deliveries sd
                INNER JOIN subscriptions s ON s.id = sd.subscription_id
                INNER JOIN customers c ON c.id = s.customer_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY sd.delivery_date ASC, sd.created_at ASC
                LIMIT ' . (int) $limit;

        $st = $pdo->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'subscriptionDeliveryId' => (string) $row['id'],
            'subscriptionId' => (string) $row['subscription_id'],
            'cycleId' => (string) $row['cycle_id'],
            'deliveryDate' => (string) $row['delivery_date'],
            'status' => (string) $row['status'],
            'scheduleKey' => (string) ($row['schedule_key'] ?? ''),
            'customerId' => (string) $row['customer_id'],
            'customerName' => (string) ($row['customer_name'] ?? ''),
            'customerEmail' => (string) ($row['customer_email'] ?? ''),
        ], is_array($rows) ? $rows : []);
    }

    /**
     * Subscription drops due on the next calendar day in IST.
     * Skipped and paused dates are not stored as scheduled rows, so they stay off this list.
     *
     * @return array{date: string, label: string, deliveries: list<array<string, mixed>>}
     */
    public static function upcomingSubscriptionDeliveries(): array
    {
        AdminSchema::ensure();
        SubscriptionSchema::ensure();

        $tz = new \DateTimeZone('Asia/Kolkata');
        $tomorrow = new \DateTimeImmutable('tomorrow', $tz);
        $date = $tomorrow->format('Y-m-d');

        $pdo = Connection::pdo();
        $st = $pdo->prepare(
            'SELECT sd.id, sd.subscription_id, sd.delivery_date, sd.status,
                    s.schedule_key, s.customer_id,
                    c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                    p.name AS plan_name,
                    a.line1, a.line2, a.city, a.pin, a.contact_name, a.contact_phone,
                    da.status AS assignment_status, dp.name AS personnel_name
             FROM subscription_deliveries sd
             INNER JOIN subscriptions s ON s.id = sd.subscription_id
             INNER JOIN customers c ON c.id = s.customer_id
             LEFT JOIN subscription_plans p ON p.id = s.plan_id
             LEFT JOIN customer_addresses a ON a.id = s.address_id
             LEFT JOIN delivery_assignments da ON da.subscription_delivery_id = sd.id
             LEFT JOIN delivery_personnel dp ON dp.id = da.personnel_id
             WHERE sd.delivery_date = ? AND sd.status = "scheduled"
             ORDER BY c.name, sd.id',
        );
        $st->execute([$date]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        $rows = is_array($rows) ? $rows : [];

        $ids = [];
        foreach ($rows as $row) {
            if (is_array($row)) {
                $ids[] = (string) $row['subscription_id'];
            }
        }
        $items = self::basketLines($pdo, $ids);

        $deliveries = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $place = array_filter([
                (string) ($row['line1'] ?? ''),
                (string) ($row['line2'] ?? ''),
                (string) ($row['city'] ?? ''),
                (string) ($row['pin'] ?? ''),
            ], static fn (string $part): bool => $part !== '');
            $deliveries[] = [
                'subscriptionDeliveryId' => (string) $row['id'],
                'subscriptionId' => (string) $row['subscription_id'],
                'deliveryDate' => (string) $row['delivery_date'],
                'status' => (string) $row['status'],
                'scheduleKey' => (string) ($row['schedule_key'] ?? ''),
                'planName' => (string) ($row['plan_name'] ?? 'Custom basket'),
                'customerId' => (string) $row['customer_id'],
                'customerName' => (string) ($row['customer_name'] ?? ''),
                'customerEmail' => (string) ($row['customer_email'] ?? ''),
                'customerPhone' => (string) ($row['contact_phone'] ?? '') !== ''
                    ? (string) $row['contact_phone']
                    : (string) ($row['customer_phone'] ?? ''),
                'address' => implode(', ', $place),
                'assignmentStatus' => (string) ($row['assignment_status'] ?? ''),
                'personnelName' => (string) ($row['personnel_name'] ?? ''),
                'items' => $items[(string) $row['subscription_id']] ?? [],
            ];
        }

        return [
            'date' => $date,
            'label' => $tomorrow->format('l, j M Y'),
            'deliveries' => $deliveries,
        ];
    }

    /**
     * @param list<string> $subscriptionIds
     * @return array<string, list<array{name: string, unit: string, dailyQty: int}>>
     */
    private static function basketLines(PDO $pdo, array $subscriptionIds): array
    {
        $subscriptionIds = array_values(array_unique(array_filter($subscriptionIds)));
        if ($subscriptionIds === []) {
            return [];
        }

        $marks = implode(',', array_fill(0, count($subscriptionIds), '?'));
        $st = $pdo->prepare(
            "SELECT l.subscription_id, l.daily_qty, p.name AS product_name, v.label, u.name AS unit_name
             FROM subscription_lines l
             LEFT JOIN product_variants v ON v.id = l.variant_id
             LEFT JOIN products p ON p.id = l.product_id
             LEFT JOIN units u ON u.id = v.unit_id
             WHERE l.subscription_id IN ($marks)
             ORDER BY p.name",
        );
        $st->execute($subscriptionIds);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $unit = trim((string) ($row['label'] ?? ''));
            if ($unit === '') {
                $unit = trim((string) ($row['unit_name'] ?? ''));
            }
            $out[(string) $row['subscription_id']][] = [
                'name' => trim((string) ($row['product_name'] ?? '')) ?: 'Item',
                'unit' => $unit,
                'dailyQty' => (int) $row['daily_qty'],
            ];
        }

        return $out;
    }
}
