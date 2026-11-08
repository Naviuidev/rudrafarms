<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Environment;

$root = dirname(__DIR__);

Environment::boot($root);

header('Content-Type: application/json');

echo json_encode([
    'app' => 'RudrasFarmFresh API',
    'env' => $_ENV['APP_ENV'] ?? 'local',
    'status' => 'ok',
], JSON_UNESCAPED_SLASHES);
