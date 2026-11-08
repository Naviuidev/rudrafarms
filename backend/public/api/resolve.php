<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Http\Json;
use App\Location\PlaceLookup;
use App\Location\ServiceArea;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Json::send(['message' => 'Use POST to resolve a location.'], 405);
}

$lookup = new PlaceLookup(ServiceArea::load(), trim((string) ($_ENV['GOOGLE_MAPS_API_KEY'] ?? '')));
$result = $lookup->resolve(Json::body());

Json::send($result, ($result['found'] ?? false) ? 200 : 422);
