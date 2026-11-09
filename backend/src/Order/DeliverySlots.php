<?php

declare(strict_types=1);

namespace App\Order;

use App\Admin\StoreHours;
use App\Cart\Quote;
use App\Database\Connection;
use DateTimeImmutable;
use DateTimeZone;

final class DeliverySlots
{
    /** @param array<string, mixed> $query @return array<string, mixed> */
    public static function options(array $query): array
    {
        Schema::ensure();
        $items = is_array($query['items'] ?? null) ? $query['items'] : [];
        $quote = Quote::build([
            'items' => $items,
            'coupon' => $query['coupon'] ?? '',
            'latitude' => $query['latitude'] ?? null,
            'longitude' => $query['longitude'] ?? null,
            'pin' => $query['pin'] ?? '',
            'subscriptionSchedule' => $query['subscriptionSchedule'] ?? '',
        ]);
        $orderKind = (string) ($quote['orderKind'] ?? 'quick');

        if ($orderKind === 'mixed') {
            return [
                'orderKind' => 'mixed',
                'available' => false,
                'message' => (string) ($quote['serviceability']['message'] ?? 'Update the cart before checkout.'),
                'slots' => [],
                'schedules' => [],
            ];
        }

        if ($orderKind === 'subscription') {
            return self::subscriptionOptions($quote);
        }

        return self::quickOptions(array_merge($query, ['items' => $items]), $quote);
    }

    /** @param array<string, mixed> $quote @return array<string, mixed> */
    private static function subscriptionOptions(array $quote): array
    {
        /** @var array{schedules: list<array<string, mixed>>} $config */
        $config = require dirname(__DIR__, 2) . '/config/subscription.php';
        $serviceable = (bool) ($quote['serviceable'] ?? false);
        $message = $serviceable
            ? 'Choose when each daily drop should arrive. Subscription orders can be placed any time.'
            : (string) ($quote['serviceability']['message'] ?? 'Subscription delivery is not available for this address.');

        return [
            'orderKind' => 'subscription',
            'available' => $serviceable,
            'message' => $message,
            'operatingHours' => null,
            'slots' => [],
            'schedules' => array_map(static fn (array $schedule): array => [
                'key' => (string) $schedule['key'],
                'label' => (string) $schedule['label'],
                'detail' => (string) $schedule['detail'],
                'multiplier' => (int) ($schedule['multiplier'] ?? 1),
            ], $config['schedules']),
        ];
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $quote @return array<string, mixed> */
    private static function quickOptions(array $query, array $quote): array
    {
        /** @var array<string, mixed> $config */
        $config = self::deliveryConfig();
        if (!(bool) ($quote['serviceable'] ?? false)) {
            $zoneMessage = (string) ($quote['serviceability']['message'] ?? '');
        } else {
            $zoneMessage = '';
        }

        if (!StoreHours::acceptingWebsiteOrders()) {
            return [
                'orderKind' => 'quick',
                'available' => false,
                'message' => 'The store is closed.',
                'operatingHours' => null,
                'slots' => [],
                'schedules' => [],
            ];
        }

        $serviceable = (bool) ($quote['serviceable'] ?? false);
        $message = $serviceable ? '' : ($zoneMessage ?: 'Add a delivery address with a map pin.');

        return [
            'orderKind' => 'quick',
            'available' => $serviceable,
            'message' => $message,
            'operatingHours' => null,
            'slots' => [],
            'schedules' => [],
        ];
    }

    /** @return array<string, mixed> */
    private static function deliveryConfig(): array
    {
        /** @var array<string, mixed> $config */
        $config = require dirname(__DIR__, 2) . '/config/delivery.php';
        $hours = StoreHours::get();
        $config['open'] = $hours['open'];
        $config['close'] = $hours['close'];

        return $config;
    }

    /** @param array<string, mixed> $query @return array{deliveryType: string, slot: array<string, mixed>} */
    public static function resolveQuickCheckout(array $query): array
    {
        $options = self::options($query);
        if (($options['orderKind'] ?? '') !== 'quick') {
            throw new OrderException('This checkout is not a quick order.');
        }
        if (!($options['available'] ?? false)) {
            throw new OrderException((string) ($options['message'] ?: 'Delivery is not available for this address.'));
        }

        $config = self::deliveryConfig();
        $now = new DateTimeImmutable('now', new DateTimeZone((string) $config['timezone']));

        return [
            'deliveryType' => 'express',
            'slot' => self::defaultQuickSlot($now, $config),
        ];
    }

    /** @param array<string, mixed> $config @return array<string, mixed> */
    private static function defaultQuickSlot(DateTimeImmutable $now, array $config): array
    {
        $eta = (int) ($config['etaMinutes']['express'] ?? 90);

        return [
            'key' => 'quick',
            'label' => 'Quick delivery',
            'date' => $now->format('Y-m-d'),
            'etaMinutes' => $eta,
            'deliveryType' => 'express',
        ];
    }

    /** @param array<string, mixed> $config @return list<array<string, mixed>> */
    private static function mergedQuickSlots(array $config, DateTimeImmutable $now): array
    {
        $slots = [];
        $expressCutoff = self::atTime($now, (string) ($config['cutoff']['express'] ?? '18:00'));
        $expressOn = !array_key_exists('expressEnabled', $config) || (bool) $config['expressEnabled'];
        if ($expressOn && $now <= $expressCutoff) {
            $eta = (int) ($config['etaMinutes']['express'] ?? 90);
            $slots[] = [
                'key' => 'express-now',
                'label' => 'Express · ~' . $eta . ' min',
                'date' => $now->format('Y-m-d'),
                'etaMinutes' => $eta,
                'remaining' => null,
                'available' => true,
                'deliveryType' => 'express',
            ];
        }

        $sameDayCutoff = self::atTime($now, (string) ($config['cutoff']['same-day'] ?? '16:00'));
        if ($now <= $sameDayCutoff) {
            foreach (self::daySlots($config, $now, 'same-day', true) as $slot) {
                $slots[] = $slot;
            }
        }

        foreach (self::scheduledSlots($config, $now, 'scheduled') as $slot) {
            $slots[] = $slot;
        }

        return $slots;
    }

    /** @param array<string, mixed> $config @return list<array<string, mixed>> */
    private static function daySlots(array $config, DateTimeImmutable $now, string $type, bool $beforeCutoff): array
    {
        if (!$beforeCutoff) {
            return [];
        }
        $date = $now->format('Y-m-d');
        $slots = [];
        foreach ($config['slots'] as $slot) {
            if (!is_array($slot) || !in_array($type, $slot['types'] ?? [], true)) {
                continue;
            }
            $start = self::atTime($now, (string) $slot['start']);
            if ($now >= $start) {
                continue;
            }
            $remaining = self::remaining($date, (string) $slot['key'], (int) ($slot['capacity'] ?? 0));
            if ($remaining < 1) {
                continue;
            }
            $slots[] = [
                'key' => (string) $slot['key'],
                'label' => (string) $slot['label'],
                'date' => $date,
                'etaMinutes' => (int) ($config['etaMinutes']['same-day'] ?? 240),
                'remaining' => $remaining,
                'available' => true,
                'deliveryType' => $type,
            ];
        }

        return $slots;
    }

    /** @param array<string, mixed> $config @return list<array<string, mixed>> */
    private static function scheduledSlots(array $config, DateTimeImmutable $now, string $type): array
    {
        $days = (int) ($config['scheduledDaysAhead'] ?? 7);
        $slots = [];
        for ($offset = 1; $offset <= $days; $offset++) {
            $day = $now->modify('+' . $offset . ' day');
            $date = $day->format('Y-m-d');
            foreach ($config['slots'] as $slot) {
                if (!is_array($slot) || !in_array($type, $slot['types'] ?? [], true)) {
                    continue;
                }
                $remaining = self::remaining($date, (string) $slot['key'], (int) ($slot['capacity'] ?? 0));
                if ($remaining < 1) {
                    continue;
                }
                $slots[] = [
                    'key' => (string) $slot['key'],
                    'label' => (string) $slot['label'],
                    'date' => $date,
                    'etaMinutes' => 0,
                    'remaining' => $remaining,
                    'available' => true,
                    'deliveryType' => $type,
                ];
            }
        }

        return $slots;
    }

    /** @param array<string, mixed> $query */
    public static function validateAgainstOptions(array $query, string $type, string $slotKey, string $slotDate): array
    {
        $options = self::options($query);
        if (($options['orderKind'] ?? '') !== 'quick') {
            throw new OrderException('That delivery window is not available anymore. Choose another slot.');
        }
        if (!$options['available']) {
            throw new OrderException((string) ($options['message'] ?: 'Delivery is not available for this address.'));
        }
        foreach ($options['slots'] as $slot) {
            if (!is_array($slot)) {
                continue;
            }
            if (($slot['key'] ?? '') === $slotKey && ($slot['date'] ?? '') === $slotDate) {
                return $slot;
            }
        }

        throw new OrderException('That delivery window is not available anymore. Choose another slot.');
    }

    /** @param array<string, mixed> $query @return array<string, mixed> */
    public static function validateSubscriptionSchedule(array $query, string $scheduleKey): array
    {
        $options = self::options($query);
        if (($options['orderKind'] ?? '') !== 'subscription') {
            throw new OrderException('This checkout is not a subscription order.');
        }
        if (!$options['available']) {
            throw new OrderException((string) ($options['message'] ?: 'Subscription delivery is not available for this address.'));
        }
        foreach ($options['schedules'] as $schedule) {
            if (!is_array($schedule)) {
                continue;
            }
            if (($schedule['key'] ?? '') === $scheduleKey) {
                return $schedule;
            }
        }

        throw new OrderException('Choose when the daily drop should arrive.');
    }

    private static function remaining(string $date, string $key, int $capacity): int
    {
        if ($capacity < 1) {
            return 0;
        }
        $statement = Connection::pdo()->prepare(
            'SELECT COUNT(*) FROM orders
             WHERE slot_date = ? AND slot_key = ?
               AND status IN ("paid", "confirmed", "preparing", "out_for_delivery", "delivered")',
        );
        $statement->execute([$date, $key]);
        $used = (int) $statement->fetchColumn();

        return max(0, $capacity - $used);
    }

    private static function atTime(DateTimeImmutable $day, string $time): DateTimeImmutable
    {
        return new DateTimeImmutable($day->format('Y-m-d') . ' ' . $time, $day->getTimezone());
    }
}
