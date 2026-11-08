<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Http\Json;
use App\Payment\PaymentConfig;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method !== 'POST') {
        Json::send(['message' => 'Use POST.'], 405);
    }

    $body = Json::body();
    PaymentConfig::assertPassword((string) ($body['password'] ?? ''));
    $action = (string) ($body['action'] ?? '');

    if ($action === 'unlock') {
        Json::send(['config' => PaymentConfig::view()]);
    }

    if ($action === 'save') {
        Json::send([
            'config' => PaymentConfig::save(
                (string) ($body['mode'] ?? ''),
                (string) ($body['keyId'] ?? ''),
                (string) ($body['keySecret'] ?? ''),
            ),
        ]);
    }

    Json::send(['message' => 'Unknown payment action.'], 422);
} catch (InvalidArgumentException $exception) {
    $status = $exception->getCode() === 401 ? 401 : 422;
    Json::send(['message' => $exception->getMessage()], $status);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Payment settings could not be saved.'], 500);
}
