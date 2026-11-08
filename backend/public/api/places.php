<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Http\Json;
use App\Location\PlaceLookup;
use App\Location\ServiceArea;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Use GET to search places.'], 405);
}

$lookup = new PlaceLookup(ServiceArea::load(), trim((string) ($_ENV['GOOGLE_MAPS_API_KEY'] ?? '')));
$input = trim((string) ($_GET['input'] ?? ''));

Json::send([
    'available' => $lookup->placesAvailable(),
    'suggestions' => $lookup->suggest($input),
]);
