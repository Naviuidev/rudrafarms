<?php

declare(strict_types=1);

namespace App\Payment;

use App\Admin\DeveloperGate;
use App\Auth\Support;
use App\Database\Connection;
use PDO;

final class PaymentConfig
{
    public static function assertPassword(string $password): void
    {
        DeveloperGate::assert('payments', $password);
    }

    /** @return array{activeMode: string, sandbox: array<string, mixed>, production: array<string, mixed>} */
    public static function view(): array
    {
        self::ensure();

        return [
            'activeMode' => self::activeMode(),
            'sandbox' => self::publicMode('sandbox'),
            'production' => self::publicMode('production'),
        ];
    }

    /** @return array{activeMode: string, sandbox: array<string, mixed>, production: array<string, mixed>} */
    public static function save(string $mode, string $keyId, string $keySecret): array
    {
        self::ensure();
        $mode = self::mode($mode);
        $keyId = trim($keyId);
        $keySecret = trim($keySecret);
        $prefix = $mode === 'sandbox' ? 'rzp_test_' : 'rzp_live_';
        if (!str_starts_with($keyId, $prefix)) {
            throw new \InvalidArgumentException(
                $mode === 'sandbox'
                    ? 'A sandbox Key ID starts with rzp_test_.'
                    : 'A production Key ID starts with rzp_live_.',
            );
        }

        $existing = self::stored($mode);
        if ($keySecret === '') {
            if ($existing['key_secret'] !== '') {
                $keySecret = $existing['key_secret'];
            } else {
                $env = self::envPair();
                if ($env !== null && $env['mode'] === $mode && hash_equals($env['keyId'], $keyId)) {
                    $keySecret = $env['keySecret'];
                }
            }
        }
        if ($keySecret === '' || strlen($keySecret) < 8) {
            throw new \InvalidArgumentException('Enter the Razorpay key secret.');
        }

        $pdo = Connection::pdo();
        $now = Support::now();
        $pdo->prepare(
            'INSERT INTO payment_gateway (mode, key_id, key_secret, updated_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE key_id = VALUES(key_id), key_secret = VALUES(key_secret), updated_at = VALUES(updated_at)',
        )->execute([$mode, $keyId, $keySecret, $now]);
        $pdo->prepare(
            'INSERT INTO payment_settings (id, active_mode, updated_at)
             VALUES (1, ?, ?)
             ON DUPLICATE KEY UPDATE active_mode = VALUES(active_mode), updated_at = VALUES(updated_at)',
        )->execute([$mode, $now]);

        return self::view();
    }

    /** @return array{keyId: string, keySecret: string}|null */
    public static function credentials(): ?array
    {
        self::ensure();
        $mode = self::activeMode();
        $stored = self::stored($mode);
        if ($stored['key_id'] !== '' && $stored['key_secret'] !== '') {
            return [
                'keyId' => $stored['key_id'],
                'keySecret' => $stored['key_secret'],
            ];
        }

        $settings = Connection::pdo()->query('SELECT id FROM payment_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        if (is_array($settings)) {
            return null;
        }

        $env = self::envPair();
        if ($env === null || $env['mode'] !== $mode) {
            return null;
        }

        return [
            'keyId' => $env['keyId'],
            'keySecret' => $env['keySecret'],
        ];
    }

    public static function ensure(): void
    {
        $pdo = Connection::pdo();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS payment_gateway (
                mode VARCHAR(16) NOT NULL PRIMARY KEY,
                key_id VARCHAR(80) NOT NULL DEFAULT "",
                key_secret VARCHAR(120) NOT NULL DEFAULT "",
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS payment_settings (
                id TINYINT NOT NULL PRIMARY KEY,
                active_mode VARCHAR(16) NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
    }

    public static function activeMode(): string
    {
        self::ensure();
        $row = Connection::pdo()->query('SELECT active_mode FROM payment_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        if (is_array($row) && in_array((string) $row['active_mode'], ['sandbox', 'production'], true)) {
            return (string) $row['active_mode'];
        }

        $env = self::envPair();

        return $env['mode'] ?? 'sandbox';
    }

    /** @return array{keyId: string, hasSecret: bool, source: string} */
    private static function publicMode(string $mode): array
    {
        $stored = self::stored($mode);
        if ($stored['key_id'] !== '' && $stored['key_secret'] !== '') {
            return [
                'keyId' => $stored['key_id'],
                'hasSecret' => true,
                'source' => 'saved',
            ];
        }

        $env = self::envPair();
        if ($env !== null && $env['mode'] === $mode) {
            return [
                'keyId' => $env['keyId'],
                'hasSecret' => true,
                'source' => 'env',
            ];
        }

        return [
            'keyId' => '',
            'hasSecret' => false,
            'source' => '',
        ];
    }

    /** @return array{key_id: string, key_secret: string} */
    private static function stored(string $mode): array
    {
        $stmt = Connection::pdo()->prepare('SELECT key_id, key_secret FROM payment_gateway WHERE mode = ?');
        $stmt->execute([$mode]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return ['key_id' => '', 'key_secret' => ''];
        }

        return [
            'key_id' => (string) $row['key_id'],
            'key_secret' => (string) $row['key_secret'],
        ];
    }

    /** @return array{mode: string, keyId: string, keySecret: string}|null */
    private static function envPair(): ?array
    {
        $key = trim((string) ($_ENV['RAZORPAY_KEY_ID'] ?? ''));
        $secret = trim((string) ($_ENV['RAZORPAY_KEY_SECRET'] ?? ''));
        if ($key === '' || $secret === '') {
            return null;
        }
        if (str_starts_with($key, 'rzp_live_')) {
            $mode = 'production';
        } elseif (str_starts_with($key, 'rzp_test_')) {
            $mode = 'sandbox';
        } else {
            return null;
        }

        return [
            'mode' => $mode,
            'keyId' => $key,
            'keySecret' => $secret,
        ];
    }

    private static function mode(string $mode): string
    {
        $mode = strtolower(trim($mode));
        if (!in_array($mode, ['sandbox', 'production'], true)) {
            throw new \InvalidArgumentException('Choose sandbox or production.');
        }

        return $mode;
    }
}
