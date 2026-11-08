<?php

declare(strict_types=1);

namespace App\Auth;

use App\Database\Connection;

final class Schema
{
    private static bool $ready = false;

    public static function ensure(): void
    {
        if (self::$ready) {
            return;
        }

        $pdo = Connection::pdo();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS customers (
                id CHAR(36) NOT NULL PRIMARY KEY,
                name VARCHAR(80) NOT NULL,
                email VARCHAR(190) NOT NULL,
                phone VARCHAR(15) NULL,
                password_hash VARCHAR(255) NOT NULL,
                email_verified_at DATETIME NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY customers_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS auth_tokens (
                id CHAR(36) NOT NULL PRIMARY KEY,
                customer_id CHAR(36) NOT NULL,
                token_hash CHAR(64) NOT NULL,
                purpose VARCHAR(16) NOT NULL,
                attempts SMALLINT NOT NULL DEFAULT 0,
                expires_at DATETIME NOT NULL,
                used_at DATETIME NULL,
                created_at DATETIME NOT NULL,
                UNIQUE KEY auth_tokens_hash (token_hash),
                KEY auth_tokens_customer (customer_id, purpose),
                CONSTRAINT auth_tokens_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS signup_challenges (
                id CHAR(36) NOT NULL PRIMARY KEY,
                email VARCHAR(190) NOT NULL,
                code_hash CHAR(64) NOT NULL,
                proof_hash CHAR(64) NULL,
                attempts SMALLINT NOT NULL DEFAULT 0,
                expires_at DATETIME NOT NULL,
                verified_at DATETIME NULL,
                consumed_at DATETIME NULL,
                created_at DATETIME NOT NULL,
                KEY signup_challenges_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS customer_addresses (
                id CHAR(36) NOT NULL PRIMARY KEY,
                customer_id CHAR(36) NOT NULL,
                line1 VARCHAR(160) NOT NULL,
                line2 VARCHAR(160) NOT NULL DEFAULT "",
                landmark VARCHAR(160) NOT NULL DEFAULT "",
                city VARCHAR(80) NOT NULL,
                state VARCHAR(80) NOT NULL,
                pin CHAR(6) NOT NULL,
                latitude DECIMAL(10,7) NOT NULL,
                longitude DECIMAL(10,7) NOT NULL,
                address_type VARCHAR(16) NOT NULL,
                contact_name VARCHAR(80) NOT NULL,
                contact_phone VARCHAR(15) NOT NULL,
                is_default TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                KEY customer_addresses_customer (customer_id),
                CONSTRAINT customer_addresses_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        self::$ready = true;
    }
}
