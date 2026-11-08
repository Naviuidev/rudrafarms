<?php

declare(strict_types=1);

namespace App\Database;

use PDO;
use RuntimeException;

final class Connection
{
    private static ?PDO $pdo = null;

    private static string $signature = '';

    public static function pdo(): PDO
    {
        $name = trim((string) ($_ENV['DB_NAME'] ?? ''));
        $user = trim((string) ($_ENV['DB_USER'] ?? ''));
        if ($name === '' || $user === '') {
            throw new RuntimeException('The database is not configured.');
        }

        $host = trim((string) ($_ENV['DB_HOST'] ?? '127.0.0.1'));
        $port = trim((string) ($_ENV['DB_PORT'] ?? '3306'));
        $password = (string) ($_ENV['DB_PASSWORD'] ?? '');
        $signature = $host . "\0" . $port . "\0" . $name . "\0" . $user . "\0" . $password;
        if (self::$pdo instanceof PDO && hash_equals(self::$signature, $signature)) {
            return self::$pdo;
        }

        self::$pdo = new PDO(
            "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
            $user,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ],
        );
        self::$signature = $signature;

        return self::$pdo;
    }
}
