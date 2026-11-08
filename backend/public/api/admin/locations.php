<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Http\Json;
use App\Location\LocationStore;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    Json::send(['locations' => LocationStore::all()]);
}

if ($method !== 'POST') {
    Json::send(['message' => 'Use GET or POST for locations.'], 405);
}

$body = Json::body();
$action = (string) ($body['action'] ?? 'save');

try {
    if ($action === 'delete') {
        LocationStore::delete((string) ($body['id'] ?? ''));
        Json::send(['locations' => LocationStore::all()]);
    }

    $input = $body['location'] ?? $body;
    if (!is_array($input)) {
        Json::send(['message' => 'Enter the location details.'], 422);
    }

    $saved = LocationStore::save($input);
    Json::send(['location' => $saved, 'locations' => LocationStore::all()]);
} catch (\InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
}
