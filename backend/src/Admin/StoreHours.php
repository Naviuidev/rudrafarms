<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;
use PDO;

final class StoreHours
{
    /** @return array{open: string, close: string, timezone: string} */
    public static function get(): array
    {
        self::ensure();
        /** @var array{open: string, close: string, timezone: string} $config */
        $config = require dirname(__DIR__, 2) . '/config/delivery.php';
        $fallback = [
            'open' => (string) $config['open'],
            'close' => (string) $config['close'],
            'timezone' => (string) $config['timezone'],
        ];

        $row = Connection::pdo()->query('SELECT open_time, close_time FROM store_hours WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return $fallback;
        }

        return [
            'open' => (string) $row['open_time'],
            'close' => (string) $row['close_time'],
            'timezone' => $fallback['timezone'],
        ];
    }

    /** @return array{open: string, close: string, timezone: string} */
    public static function save(string $open, string $close): array
    {
        self::ensure();
        $open = self::normalize($open, 'Open');
        $close = self::normalize($close, 'Close');
        if ($open >= $close) {
            throw new \InvalidArgumentException('Open time has to be earlier than close time.');
        }

        $pdo = Connection::pdo();
        $now = Support::now();
        $pdo->prepare(
            'INSERT INTO store_hours (id, open_time, close_time, updated_at)
             VALUES (1, ?, ?, ?)
             ON DUPLICATE KEY UPDATE open_time = VALUES(open_time), close_time = VALUES(close_time), updated_at = VALUES(updated_at)',
        )->execute([$open, $close, $now]);

        return self::get();
    }

    public static function ensure(): void
    {
        Connection::pdo()->exec(
            'CREATE TABLE IF NOT EXISTS store_hours (
                id TINYINT NOT NULL PRIMARY KEY,
                open_time CHAR(5) NOT NULL,
                close_time CHAR(5) NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
    }

    private static function normalize(string $value, string $label): string
    {
        $value = trim($value);
        if (!preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $value, $match)) {
            throw new \InvalidArgumentException($label . ' time needs a valid hour and minute.');
        }

        return $match[1] . ':' . $match[2];
    }
}
