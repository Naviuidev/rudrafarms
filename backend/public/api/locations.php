<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Http\Json;
use App\Location\LocationStore;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Use GET to list delivery locations.'], 405);
}

$locations = array_map(static function (array $location): array {
    $pins = $location['pins'] ?? [];
    if (!is_array($pins)) {
        $pins = [];
    }
    $center = null;
    $circle = $location['circle'] ?? null;
    if (is_array($circle) && isset($circle['latitude'], $circle['longitude'])) {
        $center = ['latitude' => (float) $circle['latitude'], 'longitude' => (float) $circle['longitude']];
    } else {
        $polygon = $location['polygon'] ?? null;
        if (is_array($polygon) && $polygon !== []) {
            $latitude = 0.0;
            $longitude = 0.0;
            $count = 0;
            foreach ($polygon as $point) {
                if (!is_array($point) || count($point) < 2) {
                    continue;
                }
                $latitude += (float) $point[0];
                $longitude += (float) $point[1];
                $count++;
            }
            if ($count > 0) {
                $center = ['latitude' => $latitude / $count, 'longitude' => $longitude / $count];
            }
        }
    }

    return [
        'id' => (string) ($location['id'] ?? ''),
        'name' => (string) ($location['name'] ?? 'Service area'),
        'city' => (string) ($location['city'] ?? ''),
        'state' => (string) ($location['state'] ?? ''),
        'pins' => array_values(array_filter(array_map('strval', $pins))),
        'subscription' => !empty($location['subscription']),
        'center' => $center,
    ];
}, LocationStore::all());

Json::send(['locations' => array_values(array_filter($locations, static fn (array $row): bool => $row['id'] !== ''))]);
