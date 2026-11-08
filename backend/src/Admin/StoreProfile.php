<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;

final class StoreProfile
{
    /** @return array{storeName: string, supportEmail: string, freeDeliveryMinimum: string} */
    public static function get(): array
    {
        self::ensure();
        $row = Connection::pdo()->query(
            'SELECT store_name, support_email, free_delivery_minimum FROM store_profile WHERE id = 1',
        )->fetch(\PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return [
                'storeName' => 'RudrasFarmFresh',
                'supportEmail' => '',
                'freeDeliveryMinimum' => '',
            ];
        }

        return [
            'storeName' => (string) $row['store_name'],
            'supportEmail' => (string) $row['support_email'],
            'freeDeliveryMinimum' => $row['free_delivery_minimum'] === null ? '' : (string) $row['free_delivery_minimum'],
        ];
    }

    /** @return array{storeName: string, supportEmail: string, freeDeliveryMinimum: string} */
    public static function save(string $storeName, string $supportEmail, string $minimum): array
    {
        self::ensure();
        $storeName = trim($storeName);
        $supportEmail = trim($supportEmail);
        $minimum = trim($minimum);
        if (mb_strlen($storeName) < 3 || mb_strlen($storeName) > 80) {
            throw new \InvalidArgumentException('Enter a store name.');
        }
        if (!filter_var($supportEmail, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Enter a valid support email.');
        }
        $minimumValue = null;
        if ($minimum !== '') {
            if (!preg_match('/^\d+$/', $minimum) || (int) $minimum > 100000) {
                throw new \InvalidArgumentException('Enter the free-delivery minimum in whole rupees.');
            }
            $minimumValue = (int) $minimum;
        }

        Connection::pdo()->prepare(
            'INSERT INTO store_profile (id, store_name, support_email, free_delivery_minimum, updated_at)
             VALUES (1, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE store_name = VALUES(store_name), support_email = VALUES(support_email),
               free_delivery_minimum = VALUES(free_delivery_minimum), updated_at = VALUES(updated_at)',
        )->execute([$storeName, $supportEmail, $minimumValue, Support::now()]);

        return self::get();
    }

    public static function ensure(): void
    {
        Connection::pdo()->exec(
            'CREATE TABLE IF NOT EXISTS store_profile (
                id TINYINT NOT NULL PRIMARY KEY,
                store_name VARCHAR(80) NOT NULL,
                support_email VARCHAR(190) NOT NULL DEFAULT "",
                free_delivery_minimum INT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
    }
}
