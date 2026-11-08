<?php

declare(strict_types=1);

namespace App\Admin;

use App\Database\Connection;
use PDO;

final class AdminDashboard
{
    /** @param array{from?: string, to?: string} $filters */
    public static function metrics(array $filters): array
    {
        AdminSchema::ensure();
        $pdo = Connection::pdo();
        $tz = new \DateTimeZone('Asia/Kolkata');
        $today = (new \DateTimeImmutable('now', $tz))->format('Y-m-d');
        $from = trim((string) ($filters['from'] ?? ''));
        $to = trim((string) ($filters['to'] ?? ''));
        if ($from === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
            $from = (new \DateTimeImmutable('first day of this month', $tz))->format('Y-m-d');
        }
        if ($to === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            $to = $today;
        }
        if ($from > $to) {
            [$from, $to] = [$to, $from];
        }

        $revenueTotal = (int) $pdo->query(
            'SELECT COALESCE(SUM(payable), 0) FROM orders WHERE paid_at IS NOT NULL',
        )->fetchColumn();

        $st = $pdo->prepare('SELECT COALESCE(SUM(payable), 0) FROM orders WHERE paid_at IS NOT NULL AND DATE(paid_at) = ?');
        $st->execute([$today]);
        $revenueToday = (int) $st->fetchColumn();

        $st = $pdo->prepare(
            'SELECT COALESCE(SUM(payable), 0) FROM orders WHERE paid_at IS NOT NULL AND DATE(paid_at) BETWEEN ? AND ?',
        );
        $st->execute([$from, $to]);
        $revenueRange = (int) $st->fetchColumn();

        $orderCounts = self::scalarMap($pdo, 'SELECT status, COUNT(*) FROM orders GROUP BY status');

        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM orders WHERE delivery_type != "subscription" AND paid_at IS NOT NULL AND DATE(created_at) = ?',
        );
        $st->execute([$today]);
        $quickToday = (int) $st->fetchColumn();

        $st = $pdo->prepare('SELECT COUNT(*) FROM subscription_deliveries WHERE delivery_date = ?');
        $st->execute([$today]);
        $subDeliveriesToday = (int) $st->fetchColumn();

        $subActive = (int) $pdo->query(
            'SELECT COUNT(*) FROM subscriptions WHERE status = "active"',
        )->fetchColumn();
        $subExpired = (int) $pdo->query(
            'SELECT COUNT(*) FROM subscriptions WHERE status = "expired"',
        )->fetchColumn();

        $st = $pdo->prepare(
            "SELECT COUNT(*) FROM subscription_cycles WHERE status = 'paid_active' AND period_end BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)",
        );
        $st->execute([$today, $today]);
        $renewalsUpcoming = (int) $st->fetchColumn();

        $pendingAssign = self::countPendingAssignments($pdo);

        $lowStock = $pdo->query(
            'SELECT p.id, p.name, v.id AS variantId, v.stock FROM product_variants v INNER JOIN products p ON p.id = v.product_id WHERE v.active = 1 AND p.active = 1 AND v.stock <= 10 ORDER BY v.stock ASC LIMIT 20',
        )->fetchAll(PDO::FETCH_ASSOC);

        $recentOrders = self::recentOrderRows($pdo);

        $salesByDay = $pdo->prepare(
            "SELECT DATE(paid_at) AS d, COALESCE(SUM(payable), 0) AS revenue, COUNT(*) AS order_count
             FROM orders WHERE paid_at IS NOT NULL AND DATE(paid_at) BETWEEN ? AND ?
             GROUP BY DATE(paid_at) ORDER BY d",
        );
        $salesByDay->execute([$from, $to]);
        $salesChart = $salesByDay->fetchAll(PDO::FETCH_ASSOC);

        $subByStatus = self::scalarMap($pdo, 'SELECT status, COUNT(*) FROM subscriptions GROUP BY status');

        return [
            'filters' => ['from' => $from, 'to' => $to],
            'revenueTotal' => $revenueTotal,
            'revenueToday' => $revenueToday,
            'revenueInRange' => $revenueRange,
            'ordersTotal' => (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn(),
            'ordersPendingPayment' => (int) ($orderCounts['pending_payment'] ?? 0),
            'ordersCompleted' => (int) ($orderCounts['delivered'] ?? 0),
            'ordersByStatus' => $orderCounts,
            'subscriptionsActive' => $subActive,
            'subscriptionsExpired' => $subExpired,
            'subscriptionByStatus' => $subByStatus,
            'upcomingRenewals7d' => $renewalsUpcoming,
            'subscriptionDeliveriesToday' => $subDeliveriesToday,
            'quickDeliveriesToday' => $quickToday,
            'pendingDeliveryAssignments' => $pendingAssign,
            'lowStock' => array_map(static fn (array $row): array => [
                'productId' => (string) $row['id'],
                'name' => (string) $row['name'],
                'variantId' => (string) $row['variantId'],
                'stock' => (int) $row['stock'],
            ], is_array($lowStock) ? $lowStock : []),
            'recentOrders' => array_map(self::presentOrderRow(...), $recentOrders),
            'recentPayments' => array_map(self::presentOrderRow(...), array_slice($recentOrders, 0, 10)),
            'salesByDay' => array_map(static fn (array $row): array => [
                'date' => (string) $row['d'],
                'revenue' => (int) $row['revenue'],
                'orders' => (int) $row['order_count'],
            ], is_array($salesChart) ? $salesChart : []),
        ];
    }

    /** @return list<array<string, mixed>> */
    private static function recentOrderRows(PDO $pdo): array
    {
        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        $hasPayment = is_array($cols) && in_array('payment_status', $cols, true);
        $sql = $hasPayment
            ? 'SELECT id, order_number, customer_id, status, payment_status, payable, paid_at, created_at FROM orders ORDER BY created_at DESC LIMIT 15'
            : 'SELECT id, order_number, customer_id, status, payable, paid_at, created_at FROM orders ORDER BY created_at DESC LIMIT 15';
        $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        return is_array($rows) ? $rows : [];
    }

    /** @return array<string, int> */
    private static function scalarMap(PDO $pdo, string $sql): array
    {
        $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_KEY_PAIR);

        return is_array($rows) ? array_map('intval', $rows) : [];
    }

    private static function countPendingAssignments(PDO $pdo): int
    {
        $a = 0;
        try {
            $a = (int) $pdo->query(
                "SELECT COUNT(*) FROM delivery_assignments WHERE status IN ('pending_assignment', 'assigned', 'processing', 'out_for_delivery')",
            )->fetchColumn();
        } catch (\Throwable) {
            $a = 0;
        }

        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        $hasFulfillment = is_array($cols) && in_array('fulfillment_status', $cols, true);

        $unassignedOrders = 0;
        try {
            if ($hasFulfillment) {
                $unassignedOrders = (int) $pdo->query(
                    "SELECT COUNT(*) FROM orders o
                     WHERE o.paid_at IS NOT NULL AND o.delivery_type != 'subscription'
                     AND o.fulfillment_status NOT IN ('delivered', 'cancelled')
                     AND o.status NOT IN ('cancelled', 'failed', 'pending_payment')
                     AND NOT EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.order_id = o.id)",
                )->fetchColumn();
            } else {
                $unassignedOrders = (int) $pdo->query(
                    "SELECT COUNT(*) FROM orders o
                     WHERE o.paid_at IS NOT NULL AND o.delivery_type != 'subscription'
                     AND o.status NOT IN ('delivered', 'cancelled', 'failed', 'pending_payment')
                     AND NOT EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.order_id = o.id)",
                )->fetchColumn();
            }
        } catch (\Throwable) {
            $unassignedOrders = 0;
        }

        $unassignedSub = 0;
        try {
            $unassignedSub = (int) $pdo->query(
                "SELECT COUNT(*) FROM subscription_deliveries sd
                 WHERE sd.status = 'scheduled'
                 AND NOT EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.subscription_delivery_id = sd.id)",
            )->fetchColumn();
        } catch (\Throwable) {
            $unassignedSub = 0;
        }

        return $a + $unassignedOrders + $unassignedSub;
    }

    /** @param array<string, mixed> $row */
    private static function presentOrderRow(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'orderNumber' => (string) $row['order_number'],
            'customerId' => (string) $row['customer_id'],
            'status' => (string) $row['status'],
            'paymentStatus' => isset($row['payment_status']) ? (string) $row['payment_status'] : '',
            'payable' => (int) $row['payable'],
            'paidAt' => !empty($row['paid_at']) ? (string) $row['paid_at'] : '',
            'createdAt' => (string) $row['created_at'],
        ];
    }
}
