<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Design\HeroStore;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        Json::send(HeroStore::library());
    }
    if ($method === 'POST') {
        $body = Json::body();
        $action = strtolower(trim((string) ($body['action'] ?? 'save')));
        $result = match ($action) {
            'save' => HeroStore::saveSection(is_array($body['section'] ?? null) ? $body['section'] : []),
            'publish' => HeroStore::publish((string) ($body['id'] ?? '')),
            'delete' => HeroStore::deleteSection((string) ($body['id'] ?? '')),
            'create' => HeroStore::createSection($body),
            default => throw new \InvalidArgumentException('Choose a valid hero action.'),
        };
        Json::send($result);
    }
    Json::send(['message' => 'Use GET or POST for the hero design.'], 405);
} catch (\InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (\Throwable) {
    Json::send(['message' => 'The hero design could not be saved.'], 500);
}
