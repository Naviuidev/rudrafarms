<?php

declare(strict_types=1);

namespace App\Auth;

use App\Database\Connection;

final class Tokens
{
    public static function issue(string $customerId, string $purpose, int $seconds): string
    {
        self::purge($customerId, $purpose);
        $token = bin2hex(random_bytes(32));
        $statement = Connection::pdo()->prepare(
            'INSERT INTO auth_tokens (id, customer_id, token_hash, purpose, attempts, expires_at, created_at)
             VALUES (?, ?, ?, ?, 0, ?, ?)',
        );
        $statement->execute([
            Support::uuid(),
            $customerId,
            Support::hashToken($token),
            $purpose,
            Support::plus($seconds),
            Support::now(),
        ]);

        return $token;
    }

    /** @return array{id: string, code: string} */
    public static function issueOtp(string $customerId): array
    {
        self::purge($customerId, 'otp');
        $id = Support::uuid();
        $code = (string) random_int(100000, 999999);
        $statement = Connection::pdo()->prepare(
            'INSERT INTO auth_tokens (id, customer_id, token_hash, purpose, attempts, expires_at, created_at)
             VALUES (?, ?, ?, "otp", 0, ?, ?)',
        );
        $statement->execute([
            $id,
            $customerId,
            Support::hashToken($code),
            Support::plus(600),
            Support::now(),
        ]);

        return ['id' => $id, 'code' => $code];
    }

    /** @return array<string, mixed>|null */
    public static function consume(string $token, string $purpose): ?array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT * FROM auth_tokens
             WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
             LIMIT 1',
        );
        $statement->execute([Support::hashToken($token), $purpose]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            return null;
        }

        $mark = Connection::pdo()->prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL');
        $mark->execute([Support::now(), $row['id']]);
        if ($mark->rowCount() !== 1) {
            return null;
        }

        return $row;
    }

    public static function sessionCustomer(string $token): ?array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT c.* FROM auth_tokens t
             INNER JOIN customers c ON c.id = t.customer_id
             WHERE t.token_hash = ? AND t.purpose = "session" AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()
             LIMIT 1',
        );
        $statement->execute([Support::hashToken($token)]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null */
    public static function confirmOtp(string $id, string $code): ?array
    {
        $pdo = Connection::pdo();
        $statement = $pdo->prepare(
            'SELECT * FROM auth_tokens
             WHERE id = ? AND purpose = "otp" AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
             LIMIT 1',
        );
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            return null;
        }

        if (!hash_equals((string) $row['token_hash'], Support::hashToken($code))) {
            $attempts = (int) $row['attempts'] + 1;
            if ($attempts >= 5) {
                $pdo->prepare('UPDATE auth_tokens SET used_at = ?, attempts = ? WHERE id = ?')
                    ->execute([Support::now(), $attempts, $id]);
            } else {
                $pdo->prepare('UPDATE auth_tokens SET attempts = ? WHERE id = ?')->execute([$attempts, $id]);
            }

            return null;
        }

        $pdo->prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?')->execute([Support::now(), $id]);

        return Customers::find((string) $row['customer_id']);
    }

    public static function revoke(string $customerId, string $purpose): void
    {
        $statement = Connection::pdo()->prepare(
            'UPDATE auth_tokens SET used_at = ? WHERE customer_id = ? AND purpose = ? AND used_at IS NULL',
        );
        $statement->execute([Support::now(), $customerId, $purpose]);
    }

    public static function revokeSession(string $token): void
    {
        $statement = Connection::pdo()->prepare(
            'UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND purpose = "session" AND used_at IS NULL',
        );
        $statement->execute([Support::now(), Support::hashToken($token)]);
    }

    private static function purge(string $customerId, string $purpose): void
    {
        $statement = Connection::pdo()->prepare(
            'DELETE FROM auth_tokens WHERE customer_id = ? AND purpose = ? AND (used_at IS NOT NULL OR expires_at <= UTC_TIMESTAMP())',
        );
        $statement->execute([$customerId, $purpose]);
    }
}
