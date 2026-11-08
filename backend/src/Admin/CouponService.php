<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;
use PDO;

final class CouponService
{
    /** @return list<array<string, mixed>> */
    public static function listAll(): array
    {
        AdminSchema::ensure();
        $rows = Connection::pdo()->query('SELECT * FROM coupons ORDER BY code')->fetchAll(PDO::FETCH_ASSOC);

        return array_map(self::present(...), is_array($rows) ? $rows : []);
    }

    /** @param array<string, mixed> $input */
    public static function save(array $input): array
    {
        AdminSchema::ensure();
        $id = trim((string) ($input['id'] ?? ''));
        $code = strtoupper(trim((string) ($input['code'] ?? '')));
        if ($code === '' || strlen($code) > 32) {
            throw new \InvalidArgumentException('Enter a coupon code.');
        }
        $type = strtolower((string) ($input['discountType'] ?? $input['type'] ?? 'percent'));
        if (!in_array($type, ['percent', 'flat'], true)) {
            throw new \InvalidArgumentException('Discount type must be percent or flat.');
        }
        $value = (int) ($input['discountValue'] ?? $input['value'] ?? 0);
        if ($value < 1) {
            throw new \InvalidArgumentException('Enter a discount value.');
        }
        $maxDiscount = (int) ($input['maxDiscount'] ?? $input['max'] ?? 0);
        $minimum = (int) ($input['minimumOrder'] ?? $input['minimum'] ?? 0);
        $usageTotal = $input['usageLimitTotal'] ?? null;
        $usagePer = $input['usageLimitPerCustomer'] ?? null;
        $allowQuick = filter_var($input['allowQuick'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        $allowSub = filter_var($input['allowSubscription'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        $active = filter_var($input['active'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        $starts = trim((string) ($input['startsAt'] ?? ''));
        $ends = trim((string) ($input['endsAt'] ?? ''));
        $startsAt = $starts !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $starts) ? $starts : null;
        $endsAt = $ends !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $ends) ? $ends : null;

        $pdo = Connection::pdo();
        $now = Support::now();

        if ($id === '') {
            $id = Support::uuid();
            $pdo->prepare(
                'INSERT INTO coupons (id, code, discount_type, discount_value, max_discount, minimum_order, usage_limit_total, usage_limit_per_customer, allow_quick, allow_subscription, active, starts_at, ends_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )->execute([
                $id,
                $code,
                $type,
                $value,
                $maxDiscount,
                $minimum,
                $usageTotal !== null && $usageTotal !== '' ? (int) $usageTotal : null,
                $usagePer !== null && $usagePer !== '' ? (int) $usagePer : null,
                $allowQuick,
                $allowSub,
                $active,
                $startsAt,
                $endsAt,
                $now,
                $now,
            ]);
        } else {
            $pdo->prepare(
                'UPDATE coupons SET code = ?, discount_type = ?, discount_value = ?, max_discount = ?, minimum_order = ?, usage_limit_total = ?, usage_limit_per_customer = ?, allow_quick = ?, allow_subscription = ?, active = ?, starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ?',
            )->execute([
                $code,
                $type,
                $value,
                $maxDiscount,
                $minimum,
                $usageTotal !== null && $usageTotal !== '' ? (int) $usageTotal : null,
                $usagePer !== null && $usagePer !== '' ? (int) $usagePer : null,
                $allowQuick,
                $allowSub,
                $active,
                $startsAt,
                $endsAt,
                $now,
                $id,
            ]);
        }

        return self::listAll();
    }

    public static function delete(string $id): void
    {
        AdminSchema::ensure();
        Connection::pdo()->prepare('DELETE FROM coupons WHERE id = ?')->execute([trim($id)]);
    }

    /**
     * @return array{code: string, applied: bool, discount: int, message: string, couponId?: string}
     */
    public static function apply(
        string $code,
        int $subtotal,
        string $orderKind,
        ?string $customerId,
    ): array {
        if ($code === '') {
            return ['code' => '', 'applied' => false, 'discount' => 0, 'message' => ''];
        }

        $key = strtoupper(trim($code));

        $db = self::fetchActive($key);
        if ($db !== null) {
            if ($orderKind === 'quick' && !(int) $db['allow_quick']) {
                return ['code' => $key, 'applied' => false, 'discount' => 0, 'message' => 'This coupon is not valid for quick delivery.'];
            }
            if ($orderKind === 'subscription' && !(int) $db['allow_subscription']) {
                return ['code' => $key, 'applied' => false, 'discount' => 0, 'message' => 'This coupon is not valid for subscriptions.'];
            }
            $minimum = (int) $db['minimum_order'];
            if ($subtotal < $minimum) {
                return [
                    'code' => $key,
                    'applied' => false,
                    'discount' => 0,
                    'message' => 'Add items worth ₹' . $minimum . ' to use this coupon.',
                ];
            }

            $discount = ($db['discount_type'] ?? '') === 'percent'
                ? (int) round($subtotal * (int) $db['discount_value'] / 100)
                : (int) $db['discount_value'];
            $max = (int) ($db['max_discount'] ?? 0);
            if ($max > 0) {
                $discount = min($discount, $max);
            }
            $discount = min(max(0, $discount), $subtotal);

            return [
                'code' => $key,
                'applied' => true,
                'discount' => $discount,
                'message' => 'Coupon applied.',
                'couponId' => (string) $db['id'],
            ];
        }

        /** @var array{coupons: array<string, array<string, mixed>>} $config */
        $config = require dirname(__DIR__, 2) . '/config/cart.php';
        $coupon = $config['coupons'][$key] ?? null;
        if (!is_array($coupon)) {
            return ['code' => $key, 'applied' => false, 'discount' => 0, 'message' => 'That coupon is not valid.'];
        }
        $minimum = (int) ($coupon['minimum'] ?? 0);
        if ($subtotal < $minimum) {
            return [
                'code' => $key,
                'applied' => false,
                'discount' => 0,
                'message' => 'Add items worth ₹' . $minimum . ' to use this coupon.',
            ];
        }
        $discount = ($coupon['type'] ?? '') === 'percent'
            ? (int) round($subtotal * (int) $coupon['value'] / 100)
            : (int) $coupon['value'];
        if (isset($coupon['max'])) {
            $discount = min($discount, (int) $coupon['max']);
        }
        $discount = min(max(0, $discount), $subtotal);

        return ['code' => $key, 'applied' => true, 'discount' => $discount, 'message' => 'Coupon applied.'];
    }

    /** @return array<string, mixed>|null */
    private static function fetchActive(string $code): ?array
    {
        try {
            AdminSchema::ensure();
        } catch (\Throwable) {
            return null;
        }
        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
        $stmt = Connection::pdo()->prepare(
            'SELECT * FROM coupons WHERE UPPER(code) = ? AND active = 1
             AND (starts_at IS NULL OR starts_at <= ?)
             AND (ends_at IS NULL OR ends_at >= ?)
             LIMIT 1',
        );
        $stmt->execute([$code, $today, $today]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    public static function validateUsage(string $couponId, ?string $customerId): void
    {
        AdminSchema::ensure();
        $pdo = Connection::pdo();
        $stmt = $pdo->prepare('SELECT * FROM coupons WHERE id = ? LIMIT 1');
        $stmt->execute([$couponId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Coupon is not valid.');
        }
        $limitTotal = $row['usage_limit_total'] ?? null;
        if ($limitTotal !== null && (int) $limitTotal > 0) {
            $stc = $pdo->prepare('SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = ?');
            $stc->execute([$couponId]);
            $used = (int) $stc->fetchColumn();
            if ($used >= (int) $limitTotal) {
                throw new \InvalidArgumentException('This coupon has reached its usage limit.');
            }
        }
        $limitPer = $row['usage_limit_per_customer'] ?? null;
        if ($customerId !== null && $customerId !== '' && $limitPer !== null && (int) $limitPer > 0) {
            $st = $pdo->prepare('SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = ? AND customer_id = ?');
            $st->execute([$couponId, $customerId]);
            if ((int) $st->fetchColumn() >= (int) $limitPer) {
                throw new \InvalidArgumentException('You have already used this coupon the maximum number of times.');
            }
        }
    }

    public static function recordRedemption(string $couponId, string $customerId, string $orderId, int $amountSaved): void
    {
        AdminSchema::ensure();
        Connection::pdo()->prepare(
            'INSERT INTO coupon_redemptions (id, coupon_id, customer_id, order_id, amount_saved, created_at)
             VALUES (?, ?, ?, ?, ?, ?)',
        )->execute([Support::uuid(), $couponId, $customerId, $orderId, $amountSaved, Support::now()]);
    }

    /** @param array<string, mixed> $row */
    private static function present(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'code' => (string) $row['code'],
            'discountType' => (string) $row['discount_type'],
            'discountValue' => (int) $row['discount_value'],
            'maxDiscount' => (int) $row['max_discount'],
            'minimumOrder' => (int) $row['minimum_order'],
            'usageLimitTotal' => $row['usage_limit_total'] !== null ? (int) $row['usage_limit_total'] : null,
            'usageLimitPerCustomer' => $row['usage_limit_per_customer'] !== null ? (int) $row['usage_limit_per_customer'] : null,
            'allowQuick' => (bool) (int) $row['allow_quick'],
            'allowSubscription' => (bool) (int) $row['allow_subscription'],
            'active' => (bool) (int) $row['active'],
            'startsAt' => $row['starts_at'] ? (string) $row['starts_at'] : '',
            'endsAt' => $row['ends_at'] ? (string) $row['ends_at'] : '',
        ];
    }
}
