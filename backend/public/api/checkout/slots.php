<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Http\Json;
use App\Order\DeliverySlots;
use App\Order\OrderException;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Method not allowed.'], 405);
}

try {
    $items = [];
    if (isset($_GET['items']) && is_string($_GET['items'])) {
        $decoded = json_decode($_GET['items'], true);
        if (is_array($decoded)) {
            $items = $decoded;
        }
    }
    Json::send(DeliverySlots::options([
        'deliveryType' => $_GET['deliveryType'] ?? $_GET['type'] ?? '',
        'latitude' => $_GET['latitude'] ?? null,
        'longitude' => $_GET['longitude'] ?? null,
        'pin' => $_GET['pin'] ?? '',
        'coupon' => $_GET['coupon'] ?? '',
        'items' => $items,
    ]));
} catch (OrderException $exception) {
    Json::send(['message' => $exception->getMessage(), 'errors' => $exception->errors()], $exception->status());
} catch (Throwable) {
    Json::send(['message' => 'Delivery slots could not be loaded.'], 500);
}
