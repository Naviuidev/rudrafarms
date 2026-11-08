<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\InventoryService;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $filters = [
            'variantId' => (string) ($_GET['variantId'] ?? ''),
            'limit' => (int) ($_GET['limit'] ?? 50),
        ];
        Json::send(['movements' => InventoryService::movements($filters)]);
    }

    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST.'], 405);
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? 'adjust');

    if ($action !== 'adjust') {
        Json::send(['message' => 'Unknown action.'], 422);
    }

    $variantId = trim((string) ($body['variantId'] ?? ''));
    $delta = (int) ($body['delta'] ?? 0);
    $reason = trim((string) ($body['reason'] ?? ''));
    $reference = trim((string) ($body['reference'] ?? ''));

    Json::send(InventoryService::adjust($variantId, $delta, $reason, $reference));
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Inventory could not be updated.'], 500);
}
