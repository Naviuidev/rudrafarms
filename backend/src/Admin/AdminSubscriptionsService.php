<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;
use App\Subscription\SubscriptionSchema;
use PDO;

final class AdminSubscriptionsService
{
    /** @var list<string> */
    private static array $statuses = ['active', 'paused', 'cancelled', 'expired', 'pending_payment'];

    /**
     * @param array{status?: string, search?: string, limit?: int} $filters
     *
     * @return list<array<string, mixed>>
     */
    public static function list(array $filters = []): array
    {
        AdminSchema::ensure();
        SubscriptionSchema::ensure();
        $pdo = Connection::pdo();

        $status = trim((string) ($filters['status'] ?? ''));
        $search = trim((string) ($filters['search'] ?? ''));
        $limit = max(1, min(200, (int) ($filters['limit'] ?? 80)));

        $where = ['1=1'];
        $params = [];
        if ($status !== '' && in_array($status, self::$statuses, true)) {
            $where[] = 's.status = ?';
            $params[] = $status;
        }
        if ($search !== '') {
            $where[] = '(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $sql = 'SELECT s.id, s.customer_id, s.plan_id, s.status, s.schedule_key, s.start_date, s.updated_at,
                       c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                       p.name AS plan_name
                FROM subscriptions s
                INNER JOIN customers c ON c.id = s.customer_id
                LEFT JOIN subscription_plans p ON p.id = s.plan_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY s.updated_at DESC
                LIMIT ' . (int) $limit;

        $st = $pdo->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        $rows = is_array($rows) ? $rows : [];
        $skips = self::skipsFor($pdo, array_map(
            static fn (array $row): string => (string) $row['id'],
            array_values(array_filter($rows, 'is_array')),
        ));

        return array_map(
            static fn (array $row): array => self::present($row, $skips[(string) $row['id']] ?? []),
            $rows,
        );
    }

    /** @return list<array<string, mixed>> */
    public static function upcomingRenewals(int $days = 7): array
    {
        AdminSchema::ensure();
        SubscriptionSchema::ensure();
        $days = max(1, min(30, $days));
        $tz = new \DateTimeZone('Asia/Kolkata');
        $today = (new \DateTimeImmutable('now', $tz))->format('Y-m-d');

        $st = Connection::pdo()->prepare(
            'SELECT sc.id AS cycle_id, sc.subscription_id, sc.period_end, sc.status AS cycle_status, sc.amount_paise,
                    s.status AS subscription_status, s.schedule_key,
                    c.id AS customer_id, c.name AS customer_name, c.email AS customer_email
             FROM subscription_cycles sc
             INNER JOIN subscriptions s ON s.id = sc.subscription_id
             INNER JOIN customers c ON c.id = s.customer_id
             WHERE sc.status = "paid_active"
               AND sc.period_end BETWEEN ? AND DATE_ADD(?, INTERVAL ' . (int) $days . ' DAY)
             ORDER BY sc.period_end ASC
             LIMIT 80',
        );
        $st->execute([$today, $today]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'cycleId' => (string) $row['cycle_id'],
            'subscriptionId' => (string) $row['subscription_id'],
            'periodEnd' => (string) $row['period_end'],
            'cycleStatus' => (string) $row['cycle_status'],
            'amountPaise' => (int) $row['amount_paise'],
            'subscriptionStatus' => (string) $row['subscription_status'],
            'scheduleKey' => (string) $row['schedule_key'],
            'customerId' => (string) $row['customer_id'],
            'customerName' => (string) $row['customer_name'],
            'customerEmail' => (string) $row['customer_email'],
        ], is_array($rows) ? $rows : []);
    }

    public static function setStatus(string $id, string $status): void
    {
        AdminSchema::ensure();
        SubscriptionSchema::ensure();
        $id = trim($id);
        $status = strtolower(trim($status));
        if ($id === '' || !in_array($status, ['active', 'paused', 'cancelled', 'expired'], true)) {
            throw new \InvalidArgumentException('Choose a valid subscription status.');
        }

        $updated = Connection::pdo()->prepare(
            'UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?',
        );
        $updated->execute([$status, Support::now(), $id]);
        if ($updated->rowCount() !== 1) {
            throw new \InvalidArgumentException('Subscription not found.');
        }
    }

    /**
     * @param list<string> $ids
     * @return array<string, list<string>>
     */
    private static function skipsFor(PDO $pdo, array $ids): array
    {
        $ids = array_values(array_filter($ids, static fn (string $id): bool => $id !== ''));
        if ($ids === []) {
            return [];
        }

        $marks = implode(',', array_fill(0, count($ids), '?'));
        $st = $pdo->prepare(
            "SELECT subscription_id, delivery_date FROM subscription_skips WHERE subscription_id IN ($marks) ORDER BY delivery_date",
        );
        $st->execute($ids);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $out[(string) $row['subscription_id']][] = (string) $row['delivery_date'];
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $row
     * @param list<string> $skips
     */
    private static function present(array $row, array $skips = []): array
    {
        return [
            'id' => (string) $row['id'],
            'customerId' => (string) $row['customer_id'],
            'customerName' => (string) ($row['customer_name'] ?? ''),
            'customerEmail' => (string) ($row['customer_email'] ?? ''),
            'customerPhone' => (string) ($row['customer_phone'] ?? ''),
            'planId' => $row['plan_id'] ? (string) $row['plan_id'] : '',
            'planName' => (string) ($row['plan_name'] ?? 'Custom'),
            'status' => (string) $row['status'],
            'scheduleKey' => (string) $row['schedule_key'],
            'startDate' => (string) $row['start_date'],
            'updatedAt' => (string) $row['updated_at'],
            'skips' => $skips,
        ];
    }
}
