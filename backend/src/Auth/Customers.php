<?php

declare(strict_types=1);

namespace App\Auth;

use App\Database\Connection;
use PDO;

final class Customers
{
    /** @return array<string, mixed>|null */
    public static function findByEmail(string $email): ?array
    {
        $statement = Connection::pdo()->prepare('SELECT * FROM customers WHERE email = ? LIMIT 1');
        $statement->execute([strtolower($email)]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null */
    public static function find(string $id): ?array
    {
        $statement = Connection::pdo()->prepare('SELECT * FROM customers WHERE id = ? LIMIT 1');
        $statement->execute([$id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    public static function emailTaken(string $email): bool
    {
        return self::findByEmail($email) !== null;
    }

    /** @param array{name: string, email: string, phone: ?string, password: string, verified: bool} $input */
    public static function create(array $input): string
    {
        $id = Support::uuid();
        $now = Support::now();
        $statement = Connection::pdo()->prepare(
            'INSERT INTO customers (id, name, email, phone, password_hash, email_verified_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        $statement->execute([
            $id,
            $input['name'],
            strtolower($input['email']),
            $input['phone'],
            password_hash($input['password'], PASSWORD_DEFAULT),
            $input['verified'] ? $now : null,
            $now,
            $now,
        ]);

        return $id;
    }

    public static function markVerified(string $id): void
    {
        $now = Support::now();
        $statement = Connection::pdo()->prepare(
            'UPDATE customers SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?',
        );
        $statement->execute([$now, $now, $id]);
    }

    public static function updateProfile(string $id, string $name, ?string $phone): void
    {
        $statement = Connection::pdo()->prepare(
            'UPDATE customers SET name = ?, phone = ?, updated_at = ? WHERE id = ?',
        );
        $statement->execute([$name, $phone, Support::now(), $id]);
    }

    public static function updatePassword(string $id, string $password): void
    {
        $statement = Connection::pdo()->prepare(
            'UPDATE customers SET password_hash = ?, updated_at = ? WHERE id = ?',
        );
        $statement->execute([password_hash($password, PASSWORD_DEFAULT), Support::now(), $id]);
    }

    public static function verifyPassword(string $password, ?array $row): bool
    {
        $hash = is_array($row) ? (string) ($row['password_hash'] ?? '') : Support::DUMMY_HASH;

        return password_verify($password, $hash) && is_array($row);
    }
}
