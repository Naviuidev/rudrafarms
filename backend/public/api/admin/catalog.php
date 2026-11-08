<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Catalog\Catalog;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        Json::send(Catalog::adminCatalog());
    }
    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST for the catalog.'], 405);
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? '');
    $payload = match ($action) {
        'save-unit' => Catalog::saveUnit(is_array($body['unit'] ?? null) ? $body['unit'] : []),
        'delete-unit' => Catalog::deleteUnit(trim((string) ($body['id'] ?? ''))),
        'save-category' => Catalog::saveCategory(is_array($body['category'] ?? null) ? $body['category'] : []),
        'delete-category' => Catalog::deleteCategory(trim((string) ($body['id'] ?? ''))),
        'save-subcategory' => Catalog::saveSubcategory(is_array($body['subcategory'] ?? null) ? $body['subcategory'] : []),
        'delete-subcategory' => Catalog::deleteSubcategory(trim((string) ($body['id'] ?? ''))),
        'save-product' => Catalog::saveProduct(is_array($body['product'] ?? null) ? $body['product'] : []),
        'delete-product' => Catalog::deleteProduct(trim((string) ($body['id'] ?? ''))),
        default => null,
    };
    if ($payload === null) {
        Json::send(['message' => 'Choose a catalog action.'], 422);
    }
    Json::send($payload);
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'The catalog could not be saved.'], 500);
}
