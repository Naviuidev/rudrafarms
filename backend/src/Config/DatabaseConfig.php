<?php

declare(strict_types=1);

namespace App\Config;

use App\Admin\DeveloperGate;

final class DatabaseConfig
{
    public static function assertPassword(string $password): void
    {
        DeveloperGate::assert('database', $password);
    }

    /** @return array{activeMode: string, local: array<string, mixed>, production: array<string, mixed>} */
    public static function view(): array
    {
        return [
            'activeMode' => Environment::isProduction() ? 'production' : 'local',
            'local' => self::publicProfile('LOCAL_'),
            'production' => self::publicProfile('PROD_'),
        ];
    }

    /** @return array{activeMode: string, local: array<string, mixed>, production: array<string, mixed>} */
    public static function save(string $mode, string $host, string $port, string $name, string $user, string $password, bool $clearPassword): array
    {
        $mode = self::mode($mode);
        $prefix = $mode === 'production' ? 'PROD_' : 'LOCAL_';
        $host = trim($host);
        $port = trim($port);
        $name = trim($name);
        $user = trim($user);
        if ($host === '' || strlen($host) > 253 || preg_match('/\s/', $host) === 1) {
            throw new \InvalidArgumentException('Enter the database host.');
        }
        if (preg_match('/^\d{1,5}$/', $port) !== 1 || (int) $port < 1 || (int) $port > 65535) {
            throw new \InvalidArgumentException('Enter a database port from 1 to 65535.');
        }
        if ($name === '' || strlen($name) > 64) {
            throw new \InvalidArgumentException('Enter the database name.');
        }
        if ($user === '' || strlen($user) > 80) {
            throw new \InvalidArgumentException('Enter the database username.');
        }
        if (str_contains($password, "\n") || str_contains($password, "\r") || strlen($password) > 128) {
            throw new \InvalidArgumentException('Enter a database password without a line break.');
        }

        $existing = (string) ($_ENV[$prefix . 'DB_PASSWORD'] ?? '');
        if ($clearPassword) {
            $password = '';
        } elseif ($password === '') {
            $password = $existing;
        }

        self::writeProfile($prefix, [
            'DB_HOST' => $host,
            'DB_PORT' => $port,
            'DB_NAME' => $name,
            'DB_USER' => $user,
            'DB_PASSWORD' => $password,
        ]);

        $_ENV[$prefix . 'DB_HOST'] = $host;
        $_ENV[$prefix . 'DB_PORT'] = $port;
        $_ENV[$prefix . 'DB_NAME'] = $name;
        $_ENV[$prefix . 'DB_USER'] = $user;
        $_ENV[$prefix . 'DB_PASSWORD'] = $password;

        $active = Environment::isProduction() ? 'production' : 'local';
        if ($mode === $active) {
            $_ENV['DB_HOST'] = $host;
            $_ENV['DB_PORT'] = $port;
            $_ENV['DB_NAME'] = $name;
            $_ENV['DB_USER'] = $user;
            $_ENV['DB_PASSWORD'] = $password;
        }

        return self::view();
    }

    /** @return array{host: string, port: string, name: string, user: string, hasPassword: bool} */
    private static function publicProfile(string $prefix): array
    {
        return [
            'host' => (string) ($_ENV[$prefix . 'DB_HOST'] ?? ''),
            'port' => (string) ($_ENV[$prefix . 'DB_PORT'] ?? '') !== '' ? (string) $_ENV[$prefix . 'DB_PORT'] : '3306',
            'name' => (string) ($_ENV[$prefix . 'DB_NAME'] ?? ''),
            'user' => (string) ($_ENV[$prefix . 'DB_USER'] ?? ''),
            'hasPassword' => (string) ($_ENV[$prefix . 'DB_PASSWORD'] ?? '') !== '',
        ];
    }

    /** @param array<string, string> $values */
    private static function writeProfile(string $prefix, array $values): void
    {
        $path = dirname(__DIR__, 2) . '/.env';
        $contents = is_file($path) ? file_get_contents($path) : false;
        if (!is_string($contents)) {
            throw new \RuntimeException('The environment file could not be read.');
        }

        foreach ($values as $key => $value) {
            $name = $prefix . $key;
            $line = $name . '=' . self::encode($value);
            $pattern = '/^' . preg_quote($name, '/') . '=.*$/m';
            if (preg_match($pattern, $contents) === 1) {
                $replaced = preg_replace_callback($pattern, static fn (): string => $line, $contents, 1);
                if (!is_string($replaced)) {
                    throw new \RuntimeException('The environment file could not be saved.');
                }
                $contents = $replaced;
                continue;
            }
            $contents = rtrim($contents, "\r\n") . "\n" . $line . "\n";
        }

        if (file_put_contents($path, $contents, LOCK_EX) === false) {
            throw new \RuntimeException('The environment file could not be saved.');
        }
    }

    private static function encode(string $value): string
    {
        if ($value === '') {
            return '';
        }
        if (preg_match('/^[A-Za-z0-9_.:@\/-]+$/', $value) === 1) {
            return $value;
        }
        if (!str_contains($value, "'")) {
            return "'" . $value . "'";
        }

        return '"' . str_replace(['\\', '"', '$'], ['\\\\', '\\"', '\\$'], $value) . '"';
    }

    private static function mode(string $mode): string
    {
        $mode = strtolower(trim($mode));
        if (!in_array($mode, ['local', 'production'], true)) {
            throw new \InvalidArgumentException('Choose localhost or production.');
        }

        return $mode;
    }
}
