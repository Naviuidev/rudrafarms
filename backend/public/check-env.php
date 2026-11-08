<?php

declare(strict_types=1);

/**
 * Environment check — run locally or on the server when auth/catalog return 500.
 * Local: http://127.0.0.1:8000/check-env.php (from backend/: php -S 0.0.0.0:8000 router.php)
 * Delete this file on production after fixing issues.
 */
define('ENV_CHECK', true);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Auth\Schema;
use App\Config\Environment;
use App\Database\Connection;

header('Content-Type: text/plain; charset=UTF-8');

$root = dirname(__DIR__);
Environment::boot($root);

echo 'PHP ' . PHP_VERSION . "\n";
echo 'APP_ENV=' . ($_ENV['APP_ENV'] ?? '(missing)') . ' (production=' . (Environment::isProduction() ? 'yes' : 'no') . ")\n";
echo 'APP_URL=' . ($_ENV['APP_URL'] ?? '(missing)') . "\n";
echo 'CUSTOMER_URL=' . ($_ENV['CUSTOMER_URL'] ?? '(missing)') . "\n";
echo 'ADMIN_URL=' . ($_ENV['ADMIN_URL'] ?? '(missing)') . "\n";
echo "---\n";

echo '1. .env file... ';
echo is_file($root . '/.env') ? "OK\n" : "MISSING — copy backend/.env.example to backend/.env\n";

echo '2. Database... ';
try {
    Connection::pdo()->query('SELECT 1');
    echo "OK ({$_ENV['DB_NAME']} @ {$_ENV['DB_HOST']})\n";
} catch (Throwable $exception) {
    echo 'FAIL: ' . $exception->getMessage() . "\n";
    echo "   Start MySQL and set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in backend/.env\n";
}

echo '3. Auth schema... ';
try {
    Schema::ensure();
    echo "OK\n";
} catch (Throwable $exception) {
    echo 'FAIL: ' . $exception->getMessage() . "\n";
}

echo "---\nDone.\n";
