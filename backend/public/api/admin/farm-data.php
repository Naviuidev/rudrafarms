<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\DeveloperGate;
use App\Admin\FarmData;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method !== 'POST') {
        Json::send(['message' => 'Use POST.'], 405);
    }

    $body = Json::body();
    DeveloperGate::assert('data', (string) ($body['password'] ?? ''));
    $action = (string) ($body['action'] ?? '');
    $kind = (string) ($body['kind'] ?? '');

    if ($action === 'list') {
        Json::send(FarmData::list($kind));
    }
    if ($action === 'delete') {
        FarmData::delete($kind, (string) ($body['id'] ?? ''));
        Json::send(FarmData::list($kind));
    }
    if ($action === 'delete-all') {
        FarmData::deleteAll($kind);
        Json::send(FarmData::list($kind));
    }

    Json::send(['message' => 'Unknown data action.'], 422);
} catch (InvalidArgumentException $exception) {
    $status = $exception->getCode() === 401 ? 401 : 422;
    Json::send(['message' => $exception->getMessage()], $status);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Farm data could not be loaded.'], 500);
}
