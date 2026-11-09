<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Http\Json;
use App\Location\ServiceArea;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Json::send(['message' => 'Use POST to check a location.'], 405);
}

$body = Json::body();
$purpose = (string) ($body['purpose'] ?? '');
if (!in_array($purpose, ['address', 'checkout', 'subscription'], true)) {
    Json::send(['message' => 'Choose where to check this location.'], 400);
}

$latitude = is_numeric($body['latitude'] ?? null) ? (float) $body['latitude'] : null;
$longitude = is_numeric($body['longitude'] ?? null) ? (float) $body['longitude'] : null;

if (
    $latitude === null
    || $longitude === null
    || $latitude < -90
    || $latitude > 90
    || $longitude < -180
    || $longitude > 180
) {
    Json::send(['message' => 'A map point is required before this location can be checked.'], 400);
}

$areas = ServiceArea::load();
$pin = preg_replace('/\D/', '', (string) ($body['pin'] ?? '')) ?? '';

Json::send([
    'purpose' => $purpose,
    'serviceability' => $areas->checkForPurpose($latitude, $longitude, $pin, $purpose),
]);
