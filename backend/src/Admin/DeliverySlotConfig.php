<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;
use PDO;

final class DeliverySlotConfig
{
    public static function ensure(): void
    {
        $pdo = Connection::pdo();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS delivery_slot_settings (
                id TINYINT NOT NULL PRIMARY KEY,
                express_enabled TINYINT NOT NULL DEFAULT 1,
                express_cutoff CHAR(5) NOT NULL,
                express_eta SMALLINT NOT NULL,
                same_day_cutoff CHAR(5) NOT NULL,
                scheduled_days TINYINT NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS delivery_slots (
                id CHAR(36) NOT NULL PRIMARY KEY,
                slot_key VARCHAR(40) NOT NULL,
                label VARCHAR(80) NOT NULL,
                start_time CHAR(5) NOT NULL,
                end_time CHAR(5) NOT NULL,
                capacity INT NOT NULL,
                same_day TINYINT NOT NULL DEFAULT 1,
                scheduled TINYINT NOT NULL DEFAULT 1,
                active TINYINT NOT NULL DEFAULT 1,
                sort_order INT NOT NULL DEFAULT 0,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY delivery_slots_key (slot_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $existing = $pdo->query('SELECT id FROM delivery_slot_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        if (is_array($existing)) {
            return;
        }

        /** @var array<string, mixed> $config */
        $config = require dirname(__DIR__, 2) . '/config/delivery.php';
        $now = Support::now();
        $pdo->prepare(
            'INSERT INTO delivery_slot_settings
                (id, express_enabled, express_cutoff, express_eta, same_day_cutoff, scheduled_days, updated_at)
             VALUES (1, 1, ?, ?, ?, ?, ?)',
        )->execute([
            self::clock((string) ($config['cutoff']['express'] ?? '18:00'), 'Express cutoff'),
            max(15, (int) ($config['etaMinutes']['express'] ?? 90)),
            self::clock((string) ($config['cutoff']['same-day'] ?? '16:00'), 'Same-day cutoff'),
            max(1, (int) ($config['scheduledDaysAhead'] ?? 7)),
            $now,
        ]);

        $order = 0;
        $insert = $pdo->prepare(
            'INSERT INTO delivery_slots
                (id, slot_key, label, start_time, end_time, capacity, same_day, scheduled, active, sort_order, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        );
        foreach ($config['slots'] ?? [] as $slot) {
            if (!is_array($slot)) {
                continue;
            }
            $types = is_array($slot['types'] ?? null) ? $slot['types'] : [];
            $insert->execute([
                Support::uuid(),
                (string) $slot['key'],
                (string) $slot['label'],
                self::clock((string) $slot['start'], 'Start'),
                self::clock((string) $slot['end'], 'End'),
                max(1, (int) ($slot['capacity'] ?? 1)),
                in_array('same-day', $types, true) ? 1 : 0,
                in_array('scheduled', $types, true) ? 1 : 0,
                $order,
                $now,
            ]);
            $order++;
        }
    }

    /** @return array{settings: array<string, mixed>, slots: list<array<string, mixed>>} */
    public static function view(): array
    {
        self::ensure();

        return [
            'settings' => self::settings(),
            'slots' => self::rows(false),
        ];
    }

    /** @return array<string, mixed> */
    public static function forCheckout(): array
    {
        $view = self::view();
        $settings = $view['settings'];
        $slots = [];
        foreach ($view['slots'] as $slot) {
            if (!$slot['active']) {
                continue;
            }
            $types = [];
            if ($slot['sameDay']) {
                $types[] = 'same-day';
            }
            if ($slot['scheduled']) {
                $types[] = 'scheduled';
            }
            if ($types === []) {
                continue;
            }
            $slots[] = [
                'key' => $slot['key'],
                'label' => $slot['label'],
                'start' => $slot['start'],
                'end' => $slot['end'],
                'capacity' => $slot['capacity'],
                'types' => $types,
            ];
        }

        return [
            'expressEnabled' => (bool) $settings['expressEnabled'],
            'expressCutoff' => (string) $settings['expressCutoff'],
            'expressEta' => (int) $settings['expressEta'],
            'sameDayCutoff' => (string) $settings['sameDayCutoff'],
            'scheduledDays' => (int) $settings['scheduledDays'],
            'slots' => $slots,
        ];
    }

    /** @param array<string, mixed> $input @return array{settings: array<string, mixed>, slots: list<array<string, mixed>>} */
    public static function saveSettings(array $input): array
    {
        self::ensure();
        $expressCutoff = self::clock((string) ($input['expressCutoff'] ?? ''), 'Express cutoff');
        $sameDayCutoff = self::clock((string) ($input['sameDayCutoff'] ?? ''), 'Same-day cutoff');
        $eta = (int) ($input['expressEta'] ?? 0);
        $days = (int) ($input['scheduledDays'] ?? 0);
        if ($eta < 15 || $eta > 360) {
            throw new \InvalidArgumentException('Express ETA needs to be between 15 and 360 minutes.');
        }
        if ($days < 1 || $days > 21) {
            throw new \InvalidArgumentException('Scheduled days need to be between 1 and 21.');
        }

        Connection::pdo()->prepare(
            'UPDATE delivery_slot_settings
             SET express_enabled = ?, express_cutoff = ?, express_eta = ?, same_day_cutoff = ?, scheduled_days = ?, updated_at = ?
             WHERE id = 1',
        )->execute([
            self::flag($input['expressEnabled'] ?? false) ? 1 : 0,
            $expressCutoff,
            $eta,
            $sameDayCutoff,
            $days,
            Support::now(),
        ]);

        return self::view();
    }

    /** @param array<string, mixed> $input @return array{settings: array<string, mixed>, slots: list<array<string, mixed>>} */
    public static function saveSlot(array $input): array
    {
        self::ensure();
        $label = trim((string) ($input['label'] ?? ''));
        if ($label === '' || strlen($label) > 80) {
            throw new \InvalidArgumentException('Enter a slot label, up to 80 characters.');
        }
        $start = self::clock((string) ($input['start'] ?? ''), 'Start');
        $end = self::clock((string) ($input['end'] ?? ''), 'End');
        if ($start >= $end) {
            throw new \InvalidArgumentException('The slot start has to be earlier than the end.');
        }
        $capacity = (int) ($input['capacity'] ?? 0);
        if ($capacity < 1 || $capacity > 500) {
            throw new \InvalidArgumentException('Capacity needs to be between 1 and 500.');
        }
        $sameDay = self::flag($input['sameDay'] ?? false);
        $scheduled = self::flag($input['scheduled'] ?? false);
        if (!$sameDay && !$scheduled) {
            throw new \InvalidArgumentException('Choose same-day, scheduled, or both.');
        }
        $active = self::flag($input['active'] ?? true);
        $id = trim((string) ($input['id'] ?? ''));
        $pdo = Connection::pdo();
        $now = Support::now();

        if ($id !== '') {
            $current = $pdo->prepare('SELECT id FROM delivery_slots WHERE id = ?');
            $current->execute([$id]);
            if ($current->fetch(PDO::FETCH_ASSOC) === false) {
                throw new \InvalidArgumentException('That delivery slot was not found.');
            }
            $pdo->prepare(
                'UPDATE delivery_slots
                 SET label = ?, start_time = ?, end_time = ?, capacity = ?, same_day = ?, scheduled = ?, active = ?, updated_at = ?
                 WHERE id = ?',
            )->execute([$label, $start, $end, $capacity, $sameDay ? 1 : 0, $scheduled ? 1 : 0, $active ? 1 : 0, $now, $id]);
        } else {
            $pdo->prepare(
                'INSERT INTO delivery_slots
                    (id, slot_key, label, start_time, end_time, capacity, same_day, scheduled, active, sort_order, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )->execute([
                Support::uuid(),
                self::uniqueKey($label, $start),
                $label,
                $start,
                $end,
                $capacity,
                $sameDay ? 1 : 0,
                $scheduled ? 1 : 0,
                $active ? 1 : 0,
                self::nextSort(),
                $now,
            ]);
        }

        return self::view();
    }

    /** @return array{settings: array<string, mixed>, slots: list<array<string, mixed>>} */
    public static function deleteSlot(string $id): array
    {
        self::ensure();
        $id = trim($id);
        if ($id === '') {
            throw new \InvalidArgumentException('Choose a delivery slot to remove.');
        }
        Connection::pdo()->prepare('DELETE FROM delivery_slots WHERE id = ?')->execute([$id]);

        return self::view();
    }

    /** @return array<string, mixed> */
    private static function settings(): array
    {
        $row = Connection::pdo()->query(
            'SELECT express_enabled, express_cutoff, express_eta, same_day_cutoff, scheduled_days FROM delivery_slot_settings WHERE id = 1',
        )->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            throw new \RuntimeException('Delivery slot settings are missing.');
        }

        return [
            'expressEnabled' => (int) $row['express_enabled'] === 1,
            'expressCutoff' => (string) $row['express_cutoff'],
            'expressEta' => (int) $row['express_eta'],
            'sameDayCutoff' => (string) $row['same_day_cutoff'],
            'scheduledDays' => (int) $row['scheduled_days'],
        ];
    }

    /** @return list<array<string, mixed>> */
    private static function rows(bool $activeOnly): array
    {
        $sql = 'SELECT id, slot_key, label, start_time, end_time, capacity, same_day, scheduled, active, sort_order
                FROM delivery_slots';
        if ($activeOnly) {
            $sql .= ' WHERE active = 1';
        }
        $sql .= ' ORDER BY sort_order ASC, start_time ASC';
        $rows = Connection::pdo()->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        $slots = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $slots[] = [
                'id' => (string) $row['id'],
                'key' => (string) $row['slot_key'],
                'label' => (string) $row['label'],
                'start' => (string) $row['start_time'],
                'end' => (string) $row['end_time'],
                'capacity' => (int) $row['capacity'],
                'sameDay' => (int) $row['same_day'] === 1,
                'scheduled' => (int) $row['scheduled'] === 1,
                'active' => (int) $row['active'] === 1,
            ];
        }

        return $slots;
    }

    private static function nextSort(): int
    {
        $value = Connection::pdo()->query('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM delivery_slots')->fetchColumn();

        return (int) $value;
    }

    private static function uniqueKey(string $label, string $start): string
    {
        $base = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $label));
        $base = trim($base, '-');
        if ($base === '') {
            $base = 'slot';
        }
        $key = substr($base, 0, 28) . '-' . str_replace(':', '', $start);
        $pdo = Connection::pdo();
        $check = $pdo->prepare('SELECT id FROM delivery_slots WHERE slot_key = ?');
        $candidate = $key;
        $suffix = 2;
        while (true) {
            $check->execute([$candidate]);
            if ($check->fetch(PDO::FETCH_ASSOC) === false) {
                return $candidate;
            }
            $candidate = substr($key, 0, 34) . '-' . $suffix;
            $suffix++;
        }
    }

    private static function clock(string $value, string $label): string
    {
        $value = trim($value);
        if (!preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $value, $match)) {
            throw new \InvalidArgumentException($label . ' needs a valid hour and minute.');
        }

        return $match[1] . ':' . $match[2];
    }

    private static function flag(mixed $value): bool
    {
        return $value === true || $value === 1 || $value === '1' || $value === 'true' || $value === 'on';
    }
}
