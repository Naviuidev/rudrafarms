<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Design\FaqStore;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        Json::send(['faqs' => FaqStore::all()]);
    }
    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST for FAQs.'], 405);
    }

    $body = Json::body();
    $action = strtolower(trim((string) ($body['action'] ?? 'save')));
    $faqs = match ($action) {
        'save' => FaqStore::save(is_array($body['faq'] ?? null) ? $body['faq'] : []),
        'delete' => FaqStore::delete(trim((string) ($body['id'] ?? ''))),
        default => throw new InvalidArgumentException('Choose a valid FAQ action.'),
    };
    Json::send(['faqs' => $faqs]);
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'FAQs could not be saved.'], 500);
}
