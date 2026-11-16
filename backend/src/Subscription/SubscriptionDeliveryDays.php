<?php

declare(strict_types=1);

namespace App\Subscription;

use App\Database\Connection;
use PDO;

final class SubscriptionDeliveryDays
{
    /**
     * @param array<string, mixed> $cycle
     * @return list<array{date: string, tone: string, label: string}>
     */
    public static function forCycle(string $subscriptionId, array $cycle, bool $customerFacing = false): array
    {
        $start = (string) ($cycle['periodStart'] ?? $cycle['period_start'] ?? '');
        $end = (string) ($cycle['periodEnd'] ?? $cycle['period_end'] ?? '');
        $cycleId = (string) ($cycle['id'] ?? '');
        if ($subscriptionId === '' || $cycleId === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end) || $start > $end) {
            return [];
        }

        SubscriptionSchema::ensure();
        $pdo = Connection::pdo();

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
        $deliveryRows->execute([$subscriptionId, $cycleId]);
        $statuses = [];
        foreach ($deliveryRows->fetchAll(PDO::FETCH_ASSOC) ?: [] as $delivery) {
            if (is_array($delivery)) {
                $statuses[(string) $delivery['delivery_date']] = (string) $delivery['status'];
            }
        }

        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
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
            $days[] = self::dayCard($date, $tone, $label, $customerFacing);
            $cursor = $cursor->modify('+1 day');
        }

        return $days;
    }

    /** @param list<array<string, mixed>> $cycles */
    public static function activeCycle(array $cycles): ?array
    {
        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
        foreach ($cycles as $cycle) {
            if (!is_array($cycle)) {
                continue;
            }
            $start = (string) ($cycle['periodStart'] ?? '');
            $end = (string) ($cycle['periodEnd'] ?? '');
            if ($start !== '' && $end !== '' && $today >= $start && $today <= $end) {
                return $cycle;
            }
        }
        foreach ($cycles as $cycle) {
            if (!is_array($cycle)) {
                continue;
            }
            $start = (string) ($cycle['periodStart'] ?? '');
            if ($start !== '' && $today < $start) {
                return $cycle;
            }
        }

        return is_array($cycles[0] ?? null) ? $cycles[0] : null;
    }

    /** @return array{date: string, tone: string, label: string} */
    private static function dayCard(string $date, string $tone, string $label = '', bool $customerFacing = false): array
    {
        $labels = [
            'delivered' => 'Delivered',
            'upcoming' => 'Upcoming',
            'skipped' => $customerFacing ? 'On hold' : 'Skipped',
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
            return '';
        }

        return ucwords($text);
    }
}