<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;
use PDO;

final class StoreHours
{
    /** @return array{open: string, close: string, timezone: string, acceptingWebsiteOrders: bool} */
    public static function get(): array
    {
        self::ensure();
        /** @var array{open: string, close: string, timezone: string} $config */
        $config = require dirname(__DIR__, 2) . '/config/delivery.php';
        $fallback = [
            'open' => (string) $config['open'],
            'close' => (string) $config['close'],
            'timezone' => (string) $config['timezone'],
            'acceptingWebsiteOrders' => true,
        ];

        $row = Connection::pdo()->query(
            'SELECT open_time, close_time, accepting_website_orders FROM store_hours WHERE id = 1',
        )->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return $fallback;
        }

        return [
            'open' => (string) $row['open_time'],
            'close' => (string) $row['close_time'],
            'timezone' => $fallback['timezone'],
            'acceptingWebsiteOrders' => (bool) ($row['accepting_website_orders'] ?? 1),
        ];
    }

    public static function acceptingWebsiteOrders(): bool
    {
        return (bool) (self::get()['acceptingWebsiteOrders'] ?? true);
    }

    /** @return array{open: string, close: string, timezone: string, acceptingWebsiteOrders: bool} */
    public static function setAcceptingWebsiteOrders(bool $accepting): array
    {
        self::ensure();
        $current = self::get();
        $pdo = Connection::pdo();
        $now = Support::now();
        $pdo->prepare(
            'INSERT INTO store_hours (id, open_time, close_time, accepting_website_orders, updated_at)
             VALUES (1, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE accepting_website_orders = VALUES(accepting_website_orders), updated_at = VALUES(updated_at)',
        )->execute([$current['open'], $current['close'], $accepting ? 1 : 0, $now]);

        return self::get();
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
        $accepting = self::acceptingWebsiteOrders() ? 1 : 0;
        $pdo->prepare(
            'INSERT INTO store_hours (id, open_time, close_time, accepting_website_orders, updated_at)
             VALUES (1, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE open_time = VALUES(open_time), close_time = VALUES(close_time), updated_at = VALUES(updated_at)',
        )->execute([$open, $close, $accepting, $now]);

        return self::get();
    }

    public static function ensure(): void
    {
        $pdo = Connection::pdo();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS store_hours (
                id TINYINT NOT NULL PRIMARY KEY,
                open_time CHAR(5) NOT NULL,
                close_time CHAR(5) NOT NULL,
                accepting_website_orders TINYINT(1) NOT NULL DEFAULT 1,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $columns = $pdo->query('SHOW COLUMNS FROM store_hours LIKE \'accepting_website_orders\'')->fetch(PDO::FETCH_ASSOC);
        if (!is_array($columns)) {
            $pdo->exec('ALTER TABLE store_hours ADD COLUMN accepting_website_orders TINYINT(1) NOT NULL DEFAULT 1 AFTER close_time');
        }
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
