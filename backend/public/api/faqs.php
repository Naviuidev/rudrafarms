<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Design\FaqStore;
use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Use GET for FAQs.'], 405);
}

try {
    Json::send(['faqs' => FaqStore::publicList()]);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['faqs' => []], 200);
}
