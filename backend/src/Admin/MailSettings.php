<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;

final class MailSettings
{
    /** @return array{configured: bool, email: string, fromName: string, host: string, port: int} */
    public static function present(): array
    {
        $row = self::row();

        return [
            'configured' => $row !== null && $row['username'] !== '' && $row['app_password'] !== '' && $row['from_email'] !== '',
            'email' => $row['username'] ?? '',
            'fromName' => $row['from_name'] ?? 'RudrasFarmFresh',
            'host' => $row['host'] ?? 'smtp.gmail.com',
            'port' => (int) ($row['port'] ?? 587),
        ];
    }

    /**
     * Saved Gmail login, including the app password. Empty when nothing is stored.
     *
     * @return array{host: string, port: int, username: string, password: string, fromEmail: string, fromName: string}|null
     */
    public static function credentials(): ?array
    {
        $row = self::row();
        if ($row === null || $row['username'] === '' || $row['app_password'] === '' || $row['from_email'] === '') {
            return null;
        }

        return [
            'host' => $row['host'] !== '' ? $row['host'] : 'smtp.gmail.com',
            'port' => (int) $row['port'] > 0 ? (int) $row['port'] : 587,
            'username' => $row['username'],
            'password' => $row['app_password'],
            'fromEmail' => $row['from_email'],
            'fromName' => $row['from_name'] !== '' ? $row['from_name'] : 'RudrasFarmFresh',
        ];
    }

    /** @return array{configured: bool, email: string, fromName: string, host: string, port: int} */
    public static function save(string $email, string $appPassword, string $fromName): array
    {
        self::ensure();
        $email = strtolower(trim($email));
        $appPassword = preg_replace('/\s+/', '', $appPassword) ?? '';
        $fromName = trim($fromName);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Enter the Gmail address that sends mail.');
        }
        if ($fromName === '') {
            $fromName = StoreProfile::get()['storeName'];
        }
        if (mb_strlen($fromName) > 80) {
            throw new \InvalidArgumentException('Use a shorter from name.');
        }

        $existing = self::row();
        if ($appPassword === '' && $existing !== null && $existing['app_password'] !== '') {
            $appPassword = $existing['app_password'];
        }
        if (strlen($appPassword) < 8 || strlen($appPassword) > 64) {
            throw new \InvalidArgumentException('Enter the 16-character Gmail app password.');
        }

        Connection::pdo()->prepare(
            'INSERT INTO mail_settings (id, host, port, username, app_password, from_email, from_name, updated_at)
             VALUES (1, "smtp.gmail.com", 587, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE username = VALUES(username), app_password = VALUES(app_password),
               from_email = VALUES(from_email), from_name = VALUES(from_name), updated_at = VALUES(updated_at)',
        )->execute([$email, $appPassword, $email, $fromName, Support::now()]);

        return self::present();
    }

    /** @return array{host: string, port: string, username: string, app_password: string, from_email: string, from_name: string}|null */
    private static function row(): ?array
    {
        try {
            self::ensure();
            $row = Connection::pdo()->query(
                'SELECT host, port, username, app_password, from_email, from_name FROM mail_settings WHERE id = 1',
            )->fetch(\PDO::FETCH_ASSOC);
        } catch (\Throwable) {
            return null;
        }

        return is_array($row) ? $row : null;
    }

    public static function ensure(): void
    {
        Connection::pdo()->exec(
            'CREATE TABLE IF NOT EXISTS mail_settings (
                id TINYINT NOT NULL PRIMARY KEY,
                host VARCHAR(120) NOT NULL,
                port SMALLINT NOT NULL,
                username VARCHAR(190) NOT NULL,
                app_password VARCHAR(128) NOT NULL,
                from_email VARCHAR(190) NOT NULL,
                from_name VARCHAR(80) NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
    }
}
