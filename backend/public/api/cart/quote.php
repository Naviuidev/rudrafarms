<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Cart\Quote;
use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Json::send(['message' => 'Use POST to price the cart.'], 405);
}

try {
    Json::send(Quote::build(Json::body()));
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'The cart could not be priced.'], 500);
}
