<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Auth\Accounts;
use App\Auth\AuthException;
use App\Catalog\Catalog;
use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Json::send(['message' => 'Use POST for the wishlist.'], 405);
}

try {
    $customer = Accounts::bearerCustomer();
    $body = Json::body();
    $action = (string) ($body['action'] ?? 'list');
    $productId = trim((string) ($body['productId'] ?? ''));
    $ids = match ($action) {
        'add' => Catalog::addWish((string) $customer['id'], $productId),
        'remove' => Catalog::removeWish((string) $customer['id'], $productId),
        default => Catalog::wishlist((string) $customer['id']),
    };
    Json::send(['productIds' => $ids]);
} catch (AuthException $exception) {
    Json::send(['message' => $exception->getMessage()], $exception->status());
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'The wishlist is unavailable.'], 500);
}
