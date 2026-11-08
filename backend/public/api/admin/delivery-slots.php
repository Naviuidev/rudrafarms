<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\DeliverySlotConfig;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        Json::send(DeliverySlotConfig::view());
    }

    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST.'], 405);
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? '');
    if ($action === 'save-settings') {
        Json::send(DeliverySlotConfig::saveSettings($body));
    }
    if ($action === 'save-slot') {
        Json::send(DeliverySlotConfig::saveSlot($body));
    }
    if ($action === 'delete-slot') {
        Json::send(DeliverySlotConfig::deleteSlot((string) ($body['id'] ?? '')));
    }

    Json::send(['message' => 'Unknown delivery slot action.'], 422);
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Delivery slots could not be saved.'], 500);
}
