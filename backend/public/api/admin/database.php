<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Config\DatabaseConfig;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method !== 'POST') {
        Json::send(['message' => 'Use POST.'], 405);
    }

    $body = Json::body();
    DatabaseConfig::assertPassword((string) ($body['password'] ?? ''));
    $action = (string) ($body['action'] ?? '');

    if ($action === 'unlock') {
        Json::send(['config' => DatabaseConfig::view()]);
    }

    if ($action === 'save') {
        Json::send([
            'config' => DatabaseConfig::save(
                (string) ($body['mode'] ?? ''),
                (string) ($body['host'] ?? ''),
                (string) ($body['port'] ?? ''),
                (string) ($body['name'] ?? ''),
                (string) ($body['user'] ?? ''),
                (string) ($body['dbPassword'] ?? ''),
                filter_var($body['clearPassword'] ?? false, FILTER_VALIDATE_BOOLEAN),
            ),
        ]);
    }

    Json::send(['message' => 'Unknown database action.'], 422);
} catch (InvalidArgumentException $exception) {
    $status = $exception->getCode() === 401 ? 401 : 422;
    Json::send(['message' => $exception->getMessage()], $status);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Database settings could not be saved.'], 500);
}
