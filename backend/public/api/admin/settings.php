<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\DeveloperGate;
use App\Admin\MailSettings;
use App\Admin\StoreHours;
use App\Admin\StoreProfile;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        Json::send([
            'hours' => StoreHours::get(),
            'store' => StoreProfile::get(),
        ]);
    }

    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST.'], 405);
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? '');
    if ($action === 'save-hours') {
        Json::send([
            'hours' => StoreHours::save((string) ($body['open'] ?? ''), (string) ($body['close'] ?? '')),
        ]);
    }
    if ($action === 'save-store') {
        Json::send([
            'store' => StoreProfile::save(
                (string) ($body['storeName'] ?? ''),
                (string) ($body['supportEmail'] ?? ''),
                (string) ($body['minimum'] ?? ''),
            ),
        ]);
    }
    if ($action === 'open-mail') {
        DeveloperGate::assert('email', (string) ($body['password'] ?? ''));
        Json::send([
            'mail' => MailSettings::present(),
            'store' => StoreProfile::get(),
        ]);
    }
    if ($action === 'save-mail') {
        DeveloperGate::assert('email', (string) ($body['password'] ?? ''));
        Json::send([
            'mail' => MailSettings::save(
                (string) ($body['email'] ?? ''),
                (string) ($body['appPassword'] ?? ''),
                (string) ($body['fromName'] ?? ''),
            ),
        ]);
    }

    Json::send(['message' => 'Unknown settings action.'], 422);
} catch (InvalidArgumentException $exception) {
    $status = $exception->getCode() === 401 ? 401 : 422;
    Json::send(['message' => $exception->getMessage()], $status);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Settings could not be saved.'], 500);
}
