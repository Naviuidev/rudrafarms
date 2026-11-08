<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Admin\StoreHours;
use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Use GET.'], 405);
}

try {
    Json::send(['hours' => StoreHours::get()]);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Store hours could not be loaded.'], 500);
}
