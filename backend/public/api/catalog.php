<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Catalog\Catalog;
use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Use GET for the catalog.'], 405);
}

try {
    Json::send(Catalog::publicCatalog());
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'The product catalog is unavailable.'], 500);
}
