<?php

declare(strict_types=1);

namespace App\Auth;

final class Support
{
    public const DUMMY_HASH = '$2y$10$OkwA.n2duFhh/X9knpPNTej3sRZaR2kw4PEUD.M1sYh5Hs84EUlXi';

    public static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }

    public static function plus(int $seconds): string
    {
        return gmdate('Y-m-d H:i:s', time() + $seconds);
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function local(): bool
    {
        return (string) ($_ENV['APP_ENV'] ?? 'local') !== 'production';
    }

    public static function customerUrl(): string
    {
        $url = trim((string) ($_ENV['CUSTOMER_URL'] ?? 'http://localhost:5173'));

        return rtrim($url !== '' ? $url : 'http://localhost:5173', '/');
    }

    public static function otpEnabled(): bool
    {
        if (filter_var($_ENV['AUTH_OTP_ENABLED'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return true;
        }

        return Mail::configured();
    }

    /** @param array<string, mixed> $row */
    public static function customer(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'phone' => $row['phone'] !== null && $row['phone'] !== '' ? (string) $row['phone'] : '',
            'emailVerified' => $row['email_verified_at'] !== null && $row['email_verified_at'] !== '',
        ];
    }

    public static function password(string $password): void
    {
        if (strlen($password) < 8 || strlen($password) > 72) {
            throw new AuthException('Use a password between 8 and 72 characters.', 422, [
                'password' => 'Use a password between 8 and 72 characters.',
            ]);
        }
    }
}
