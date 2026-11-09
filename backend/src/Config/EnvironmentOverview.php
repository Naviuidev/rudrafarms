<?php

declare(strict_types=1);

namespace App\Config;

use App\Admin\MailSettings;
use App\Database\Connection;
use App\Payment\PaymentConfig;

final class EnvironmentOverview
{
    /** @return array<string, mixed> */
    public static function view(): array
    {
        $activeMode = Environment::isProduction() ? 'production' : 'local';
        $envPath = dirname(__DIR__, 2) . '/.env';

        $database = [
            'connected' => false,
            'host' => (string) ($_ENV['DB_HOST'] ?? ''),
            'name' => (string) ($_ENV['DB_NAME'] ?? ''),
            'user' => (string) ($_ENV['DB_USER'] ?? ''),
            'hasPassword' => (string) ($_ENV['DB_PASSWORD'] ?? '') !== '',
        ];

        try {
            Connection::pdo()->query('SELECT 1');
            $database['connected'] = true;
        } catch (\Throwable) {
            $database['connected'] = false;
        }

        $mailConfigured = false;
        try {
            if ($database['connected']) {
                $mailConfigured = MailSettings::present()['configured'];
            }
        } catch (\Throwable) {
            $mailConfigured = false;
        }

        $payments = [
            'configured' => false,
            'activeMode' => 'sandbox',
        ];
        try {
            if ($database['connected']) {
                $config = PaymentConfig::view();
                $payments['activeMode'] = (string) ($config['activeMode'] ?? 'sandbox');
                $payments['configured'] = !empty($config['sandbox']['hasSecret']) || !empty($config['production']['hasSecret']);
            }
        } catch (\Throwable) {
            $payments['configured'] = false;
        }

        return [
            'activeMode' => $activeMode,
            'urls' => [
                'api' => rtrim((string) ($_ENV['APP_URL'] ?? ''), '/'),
                'customer' => rtrim((string) ($_ENV['CUSTOMER_URL'] ?? ''), '/'),
                'admin' => rtrim((string) ($_ENV['ADMIN_URL'] ?? ''), '/'),
            ],
            'envFile' => [
                'exists' => is_file($envPath),
                'writable' => is_file($envPath) && is_writable($envPath),
                'hint' => 'On Hostinger the API reads backend/.env under apps/rudrafarms (not public_html). Saving database settings from this admin updates that file.',
            ],
            'database' => $database,
            'mailConfigured' => $mailConfigured,
            'payments' => $payments,
            'localDevNote' => 'On your Mac: one .env at the project root (or backend/.env), then ./deploy.sh uploads it. Day-to-day production changes: use the sections on the left.',
        ];
    }
}
