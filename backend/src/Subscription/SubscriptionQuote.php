<?php

declare(strict_types=1);

namespace App\Subscription;

use App\Database\Connection;
use PDO;

final class SubscriptionQuote
{
    /**
     * @param list<array{productId: string, variantId: string, dailyQty: int}> $lines
     * @return array{dailySubtotal: int, dailyTax: int, billableDays: int, grossSubtotal: int, subtotal: int, tax: int, payable: int, discount: int, lines: list<array<string, mixed>>}
     */
    public static function cycleTotals(array $lines, string $scheduleKey, int $billableDays, int $discountApplied = 0): array
    {
        /** @var array{taxPercent: array<string, int>} $config */
        $config = require dirname(__DIR__, 2) . '/config/cart.php';

        $multiplier = self::scheduleMultiplier($scheduleKey);
        $dailySubtotal = 0;
        $dailyTax = 0;
        $outLines = [];

        foreach ($lines as $line) {
            $row = self::variantRow((string) $line['productId'], (string) $line['variantId']);
            $price = $row !== null ? (int) round((float) $row['selling_price']) : 0;
            $productId = (string) ($row['product_id'] ?? $line['productId']);
            $qty = max(1, (int) $line['dailyQty']);
            $lineDaily = $price * $qty * $multiplier;
            $rate = (int) ($config['taxPercent'][$productId] ?? 0);
            $taxDaily = (int) round($lineDaily * $rate / 100);
            $dailySubtotal += $lineDaily;
            $dailyTax += $taxDaily;
            $outLines[] = [
                'productId' => $productId,
                'variantId' => (string) $line['variantId'],
                'name' => (string) ($row['name'] ?? 'Product'),
                'unit' => trim((string) ($row['label'] ?? '')) !== '' ? (string) $row['label'] : (string) ($row['unit_name'] ?? ''),
                'dailyQty' => $qty,
                'price' => $price,
                'scheduleMultiplier' => $multiplier,
            ];
        }

        $billableDays = max(0, $billableDays);
        $grossSubtotal = $dailySubtotal * $billableDays;
        $taxBeforeDiscount = $dailyTax * $billableDays;
        $discountApplied = max(0, min((int) $discountApplied, $grossSubtotal));
        $subtotalAfter = $grossSubtotal - $discountApplied;
        $ratio = $grossSubtotal > 0 ? ($subtotalAfter / $grossSubtotal) : 1.0;
        $tax = (int) round($taxBeforeDiscount * $ratio);

        return [
            'dailySubtotal' => $dailySubtotal,
            'dailyTax' => $dailyTax,
            'billableDays' => $billableDays,
            'grossSubtotal' => $grossSubtotal,
            'subtotal' => $subtotalAfter,
            'tax' => $tax,
            'payable' => $subtotalAfter + $tax,
            'discount' => $discountApplied,
            'lines' => $outLines,
        ];
    }

    public static function scheduleMultiplier(string $scheduleKey): int
    {
        $schedules = (array) (require dirname(__DIR__, 2) . '/config/subscription.php')['schedules'];
        foreach ($schedules as $row) {
            if (is_array($row) && ($row['key'] ?? '') === $scheduleKey) {
                return max(1, (int) ($row['multiplier'] ?? 1));
            }
        }

        return 1;
    }

    /** @return array<string, mixed>|null */
    private static function variantRow(string $productId, string $variantId): ?array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT p.name, p.id AS product_id, v.label, v.selling_price, u.name AS unit_name
             FROM product_variants v
             INNER JOIN products p ON p.id = v.product_id
             INNER JOIN units u ON u.id = v.unit_id
             WHERE p.id = ? AND v.id = ? LIMIT 1',
        );
        $statement->execute([$productId, $variantId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Inclusive calendar days from $from through $to, excluding dates in pause ranges and skip set.
     *
     * @param list<array{start: string, end: string}> $pauses 'Y-m-d' strings
     * @param list<string> $skips 'Y-m-d' strings
     */
    public static function countBillableDays(
        \DateTimeImmutable $from,
        \DateTimeImmutable $to,
        array $pauses,
        array $skips,
    ): int {
        if ($from > $to) {
            return 0;
        }

        $skipMap = [];
        foreach ($skips as $s) {
            $skipMap[(string) $s] = true;
        }

        $count = 0;
        $cursor = $from;
        while ($cursor <= $to) {
            $key = $cursor->format('Y-m-d');
            if (isset($skipMap[$key])) {
                $cursor = $cursor->modify('+1 day');

                continue;
            }
            if (self::inPause($cursor, $pauses)) {
                $cursor = $cursor->modify('+1 day');

                continue;
            }
            $count++;
            $cursor = $cursor->modify('+1 day');
        }

        return $count;
    }

    /**
     * @param list<array{start: string, end: string}> $pauses
     */
    public static function inPause(\DateTimeImmutable $day, array $pauses): bool
    {
        $d = $day->format('Y-m-d');
        foreach ($pauses as $pause) {
            $start = (string) ($pause['start'] ?? '');
            $end = (string) ($pause['end'] ?? '');
            if ($start === '' || $end === '') {
                continue;
            }
            if ($d >= $start && $d <= $end) {
                return true;
            }
        }

        return false;
    }

    public static function endOfMonth(\DateTimeImmutable $date): \DateTimeImmutable
    {
        $first = $date->modify('first day of this month');

        return $first->modify('last day of this month');
    }

    public static function startOfMonth(\DateTimeImmutable $date): \DateTimeImmutable
    {
        return $date->modify('first day of this month');
    }
}
