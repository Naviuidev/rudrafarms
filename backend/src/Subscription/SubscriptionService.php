<?php

declare(strict_types=1);

namespace App\Subscription;

use App\Auth\Support;
use App\Database\Connection;
use App\Location\ServiceArea;
use PDO;

final class SubscriptionService
{
    /** @return list<array<string, mixed>> */
    public static function publicPlans(): array
    {
        SubscriptionSchema::ensure();
        $rows = Connection::pdo()->query(
            'SELECT id, name, description, plan_type AS planType, items_json AS itemsJson
             FROM subscription_plans WHERE active = 1 ORDER BY sort_order, name',
        )->fetchAll(PDO::FETCH_ASSOC);

        return array_map(self::presentPlan(...), is_array($rows) ? $rows : []);
    }

    /** @return list<array<string, mixed>> */
    public static function adminPlans(): array
    {
        SubscriptionSchema::ensure();
        $rows = Connection::pdo()->query(
            'SELECT id, name, description, plan_type AS planType, items_json AS itemsJson, active, sort_order AS sortOrder
             FROM subscription_plans ORDER BY sort_order, name',
        )->fetchAll(PDO::FETCH_ASSOC);

        return array_map(self::presentPlan(...), is_array($rows) ? $rows : []);
    }

    /** @param array<string, mixed> $input */
    public static function savePlan(array $input): array
    {
        SubscriptionSchema::ensure();
        $id = trim((string) ($input['id'] ?? ''));
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new SubscriptionException('Plan name is required.');
        }
        $description = trim((string) ($input['description'] ?? ''));
        $planType = in_array(($input['planType'] ?? 'fixed'), ['fixed', 'custom'], true) ? (string) $input['planType'] : 'fixed';
        $items = $input['items'] ?? [];
        if (!is_array($items) || $items === []) {
            throw new SubscriptionException('Add at least one product line to this plan.');
        }
        $encoded = json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            throw new SubscriptionException('Plan items could not be saved.');
        }
        $active = filter_var($input['active'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        $sortOrder = (int) ($input['sortOrder'] ?? 0);
        $now = Support::now();

        $pdo = Connection::pdo();
        if ($id === '') {
            $id = Support::uuid();
            $pdo->prepare(
                'INSERT INTO subscription_plans (id, name, description, plan_type, items_json, active, sort_order, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )->execute([$id, $name, $description, $planType, $encoded, $active, $sortOrder, $now, $now]);
        } else {
            $updated = $pdo->prepare(
                'UPDATE subscription_plans SET name = ?, description = ?, plan_type = ?, items_json = ?, active = ?, sort_order = ?, updated_at = ?
                 WHERE id = ?',
            );
            $updated->execute([$name, $description, $planType, $encoded, $active, $sortOrder, $now, $id]);
            if ($updated->rowCount() !== 1) {
                throw new SubscriptionException('That plan was not found.', 404);
            }
        }

        $row = self::planRow($id);
        if ($row === null) {
            throw new SubscriptionException('Plan could not be loaded.', 500);
        }

        return self::presentPlan($row);
    }

    public static function deletePlan(string $id): void
    {
        SubscriptionSchema::ensure();
        $id = trim($id);
        if ($id === '') {
            throw new SubscriptionException('Choose a plan to delete.');
        }
        $pdo = Connection::pdo();
        $pdo->prepare('DELETE FROM subscription_plans WHERE id = ?')->execute([$id]);
    }

    /** @return list<array<string, mixed>> */
    public static function listForCustomer(string $customerId): array
    {
        SubscriptionSchema::ensure();
        $statement = Connection::pdo()->prepare(
            'SELECT s.* FROM subscriptions s
             WHERE s.customer_id = ? AND s.status NOT IN ("cancelled", "pending_payment")
             ORDER BY s.updated_at DESC',
        );
        $statement->execute([$customerId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $out[] = self::presentSubscription($row, false);
        }

        return $out;
    }

    /** @return array<string, mixed> */
    public static function detailForCustomer(string $customerId, string $subscriptionId): array
    {
        SubscriptionSchema::ensure();
        $statement = Connection::pdo()->prepare(
            'SELECT * FROM subscriptions WHERE id = ? AND customer_id = ? LIMIT 1',
        );
        $statement->execute([$subscriptionId, $customerId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            throw new SubscriptionException('Subscription not found.', 404);
        }

        return self::presentSubscription($row, true);
    }

    /**
     * @param list<array{productId: string, variantId: string, dailyQty: int}> $lines
     * @return array{lines: list<array{productId: string, variantId: string, dailyQty: int}>, planType: string}
     */
    public static function resolveLines(?string $planId, array $lines): array
    {
        SubscriptionSchema::ensure();
        if ($planId !== null && trim($planId) !== '') {
            $plan = self::planRow(trim($planId));
            if ($plan === null || (int) $plan['active'] !== 1) {
                throw new SubscriptionException('That plan is not available.');
            }
            $decoded = json_decode((string) $plan['items_json'], true);
            if (!is_array($decoded)) {
                throw new SubscriptionException('Plan data is invalid.');
            }
            $resolved = [];
            foreach ($decoded as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $pid = trim((string) ($entry['productId'] ?? ''));
                $vid = trim((string) ($entry['variantId'] ?? ''));
                $dq = (int) ($entry['qty'] ?? $entry['dailyQty'] ?? 1);
                if ($pid === '' || $vid === '') {
                    continue;
                }
                $resolved[] = ['productId' => $pid, 'variantId' => $vid, 'dailyQty' => max(1, $dq)];
            }
            if ($resolved === []) {
                throw new SubscriptionException('This plan has no products configured.');
            }

            return ['lines' => $resolved, 'planType' => (string) $plan['plan_type']];
        }

        if ($lines === []) {
            throw new SubscriptionException('Select a plan or add custom products.');
        }
        $resolved = [];
        foreach ($lines as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $pid = trim((string) ($entry['productId'] ?? ''));
            $vid = trim((string) ($entry['variantId'] ?? ''));
            $dq = (int) ($entry['dailyQty'] ?? $entry['qty'] ?? 1);
            if ($pid === '' || $vid === '') {
                continue;
            }
            $resolved[] = ['productId' => $pid, 'variantId' => $vid, 'dailyQty' => max(1, $dq)];
        }
        if ($resolved === []) {
            throw new SubscriptionException('Add at least one subscription line.');
        }

        return ['lines' => $resolved, 'planType' => 'custom'];
    }

    /**
     * @param array<string, mixed> $presentedAddress from Addresses::getForCustomer
     * @param list<array{productId: string, variantId: string, dailyQty: int}> $lines
     */
    public static function assertServiceable(array $presentedAddress): void
    {
        $lat = (float) $presentedAddress['latitude'];
        $lng = (float) $presentedAddress['longitude'];
        $areas = ServiceArea::load();
        $check = $areas->check($lat, $lng, (string) ($presentedAddress['pin'] ?? ''));
        if (empty($check['subscription'])) {
            throw new SubscriptionException($areas->outsideMessage($check, 'subscription'));
        }
    }

    /** @return array<string, mixed> */
    public static function pausesForSubscription(string $subscriptionId): array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT start_date AS start, end_date AS end FROM subscription_pauses WHERE subscription_id = ? ORDER BY start_date',
        );
        $statement->execute([$subscriptionId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (is_array($row)) {
                $out[] = ['start' => (string) $row['start'], 'end' => (string) $row['end']];
            }
        }

        return $out;
    }

    /** @return list<string> */
    public static function skipsForSubscription(string $subscriptionId): array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT delivery_date FROM subscription_skips WHERE subscription_id = ? ORDER BY delivery_date',
        );
        $statement->execute([$subscriptionId]);
        $rows = $statement->fetchAll(PDO::FETCH_COLUMN);

        return array_map('strval', is_array($rows) ? $rows : []);
    }

    /** @return array<string, mixed>|null */
    public static function planRow(string $id): ?array
    {
        $statement = Connection::pdo()->prepare('SELECT * FROM subscription_plans WHERE id = ? LIMIT 1');
        $statement->execute([$id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $row */
    private static function presentPlan(array $row): array
    {
        $items = json_decode((string) ($row['itemsJson'] ?? $row['items_json'] ?? '[]'), true);

        return [
            'id' => (string) ($row['id'] ?? ''),
            'name' => (string) ($row['name'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'planType' => (string) ($row['planType'] ?? $row['plan_type'] ?? 'fixed'),
            'items' => is_array($items) ? $items : [],
            'active' => isset($row['active']) ? (bool) (int) $row['active'] : true,
            'sortOrder' => (int) ($row['sortOrder'] ?? $row['sort_order'] ?? 0),
        ];
    }

    /** @param array<string, mixed> $row */
    private static function presentSubscription(array $row, bool $withDetails): array
    {
        $id = (string) $row['id'];
        $lines = self::subscriptionLines($id);
        $cycles = self::subscriptionCycles($id);
        $payload = [
            'id' => $id,
            'planId' => $row['plan_id'] ? (string) $row['plan_id'] : '',
            'status' => (string) $row['status'],
            'statusLabel' => self::subscriptionStatusLabel((string) $row['status']),
            'scheduleKey' => (string) $row['schedule_key'],
            'startDate' => (string) $row['start_date'],
            'addressId' => (string) $row['address_id'],
            'lines' => $lines,
            'cycles' => $cycles,
            'createdAt' => (string) $row['created_at'],
            'updatedAt' => (string) $row['updated_at'],
        ];
        if ($withDetails) {
            $payload['pauses'] = self::pausesForSubscription($id);
            $payload['skips'] = self::skipsForSubscription($id);
            $payload['upcomingDeliveries'] = self::upcomingDeliveries($id, 14);
            $payload['pastDeliveries'] = self::pastDeliveries($id, 14);
        }

        return $payload;
    }

    /** @return list<array<string, mixed>> */
    private static function subscriptionLines(string $subscriptionId): array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT l.product_id, l.variant_id, l.daily_qty, l.min_qty, l.max_qty,
                    p.name AS product_name, v.label, u.name AS unit_name
             FROM subscription_lines l
             LEFT JOIN product_variants v ON v.id = l.variant_id
             LEFT JOIN products p ON p.id = l.product_id
             LEFT JOIN units u ON u.id = v.unit_id
             WHERE l.subscription_id = ?
             ORDER BY p.name',
        );
        $statement->execute([$subscriptionId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $unit = trim((string) ($row['label'] ?? ''));
            if ($unit === '') {
                $unit = trim((string) ($row['unit_name'] ?? ''));
            }
            $out[] = [
                'productId' => (string) $row['product_id'],
                'variantId' => (string) $row['variant_id'],
                'name' => trim((string) ($row['product_name'] ?? '')) ?: (string) $row['product_id'],
                'unit' => $unit,
                'dailyQty' => (int) $row['daily_qty'],
                'minQty' => (int) $row['min_qty'],
                'maxQty' => (int) $row['max_qty'],
            ];
        }

        return $out;
    }

    /** @return list<array<string, mixed>> */
    private static function subscriptionCycles(string $subscriptionId): array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT id, period_start, period_end, billable_delivery_days, status, amount_paise, paid_at, orders_order_id
             FROM subscription_cycles WHERE subscription_id = ? ORDER BY period_start DESC',
        );
        $statement->execute([$subscriptionId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $out[] = [
                'id' => (string) $row['id'],
                'periodStart' => (string) $row['period_start'],
                'periodEnd' => (string) $row['period_end'],
                'billableDeliveryDays' => (int) $row['billable_delivery_days'],
                'status' => (string) $row['status'],
                'statusLabel' => self::cycleStatusLabel((string) $row['status']),
                'amountPaise' => (int) $row['amount_paise'],
                'paidAt' => $row['paid_at'] ? (string) $row['paid_at'] : '',
                'orderId' => $row['orders_order_id'] ? (string) $row['orders_order_id'] : '',
            ];
        }

        return $out;
    }

    /** @return list<array<string, mixed>> */
    private static function upcomingDeliveries(string $subscriptionId, int $limit): array
    {
        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
        $statement = Connection::pdo()->prepare(
            'SELECT delivery_date, status FROM subscription_deliveries
             WHERE subscription_id = ? AND delivery_date >= ? ORDER BY delivery_date ASC LIMIT ' . max(1, $limit),
        );
        $statement->execute([$subscriptionId, $today]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $out[] = [
                'date' => (string) $row['delivery_date'],
                'status' => (string) $row['status'],
            ];
        }

        return $out;
    }

    /** @return list<array<string, mixed>> */
    private static function pastDeliveries(string $subscriptionId, int $limit): array
    {
        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
        $statement = Connection::pdo()->prepare(
            'SELECT delivery_date, status FROM subscription_deliveries
             WHERE subscription_id = ? AND delivery_date < ? ORDER BY delivery_date DESC LIMIT ' . max(1, $limit),
        );
        $statement->execute([$subscriptionId, $today]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $out[] = [
                'date' => (string) $row['delivery_date'],
                'status' => (string) $row['status'],
            ];
        }

        return $out;
    }

    private static function subscriptionStatusLabel(string $status): string
    {
        return match ($status) {
            'active' => 'Active',
            'paused' => 'Paused',
            'cancelled' => 'Cancelled',
            'pending_payment' => 'Pending payment',
            'expired' => 'Expired',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    private static function cycleStatusLabel(string $status): string
    {
        return match ($status) {
            'pending_payment' => 'Pending payment',
            'paid_active' => 'Paid',
            'expired' => 'Expired',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }
}
