<?php

declare(strict_types=1);

namespace App\Config;

final class Environment
{
    /** @var list<string> */
    private const PROFILE_KEYS = [
        'APP_URL',
        'CUSTOMER_URL',
        'ADMIN_URL',
        'DB_HOST',
        'DB_PORT',
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD',
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USERNAME',
        'SMTP_PASSWORD',
        'SMTP_FROM_EMAIL',
        'SMTP_FROM_NAME',
        'GOOGLE_MAPS_API_KEY',
        'AUTH_OTP_ENABLED',
    ];

    public static function boot(string $root): void
    {
        $envFile = is_file($root . '/.env')
            ? $root . '/.env'
            : (is_file(dirname($root) . '/.env') ? dirname($root) . '/.env' : null);
        if ($envFile !== null) {
            \Dotenv\Dotenv::createImmutable(dirname($envFile))->safeLoad();
        }

        if (trim((string) ($_ENV['APP_ENV'] ?? '')) === '') {
            $fromProcess = getenv('APP_ENV');
            if (is_string($fromProcess) && trim($fromProcess) !== '') {
                self::assign('APP_ENV', trim($fromProcess));
            }
        }

        self::applyProfile();
        self::applyRuntime();
    }

    public static function isProduction(): bool
    {
        return (string) ($_ENV['APP_ENV'] ?? 'local') === 'production';
    }

    public static function isLocal(): bool
    {
        return !self::isProduction();
    }

    public static function applyCors(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (!is_string($origin) || $origin === '') {
            return;
        }

        if (self::originAllowed($origin)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }

    public static function originAllowed(string $origin): bool
    {
        if (preg_match('#^http://(localhost|127\.0\.0\.1):\d+$#', $origin) === 1) {
            return true;
        }

        foreach (['CUSTOMER_URL', 'ADMIN_URL'] as $key) {
            $allowed = rtrim(trim((string) ($_ENV[$key] ?? '')), '/');
            if ($allowed !== '' && $origin === $allowed) {
                return true;
            }
        }

        return false;
    }

    private static function applyProfile(): void
    {
        $prefix = self::isProduction() ? 'PROD_' : 'LOCAL_';
        foreach (self::PROFILE_KEYS as $key) {
            $profileKey = $prefix . $key;
            if (!array_key_exists($profileKey, $_ENV)) {
                continue;
            }
            self::assign($key, (string) $_ENV[$profileKey]);
        }
    }

    private static function assign(string $key, string $value): void
    {
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
        if (!str_contains($value, "\0")) {
            putenv($key . '=' . $value);
        }
    }

    private static function applyRuntime(): void
    {
        if (self::isProduction()) {
            ini_set('display_errors', '0');
            ini_set('display_startup_errors', '0');
            error_reporting(0);
            ini_set('log_errors', '1');
        } else {
            ini_set('display_errors', '1');
            ini_set('display_startup_errors', '1');
            error_reporting(E_ALL);
        }

        date_default_timezone_set('Asia/Kolkata');
    }
}
