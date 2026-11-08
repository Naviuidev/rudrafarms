<?php

declare(strict_types=1);

/**
 * First seed for subscription areas. After the admin opens Locations,
 * edits are stored in storage/locations.json and this file is left as the seed.
 */
return [
    'pins' => [
        '635109' => ['city' => 'Hosur', 'state' => 'Tamil Nadu', 'latitude' => 12.7409, 'longitude' => 77.8253],
        '635110' => ['city' => 'Hosur', 'state' => 'Tamil Nadu', 'latitude' => 12.7350, 'longitude' => 77.8200],
        '635126' => ['city' => 'Hosur', 'state' => 'Tamil Nadu', 'latitude' => 12.7520, 'longitude' => 77.8350],
        '635101' => ['city' => 'Hosur', 'state' => 'Tamil Nadu', 'latitude' => 12.8488, 'longitude' => 77.8253],
        '635001' => ['city' => 'Krishnagiri', 'state' => 'Tamil Nadu', 'latitude' => 12.5186, 'longitude' => 78.2137],
        '560001' => ['city' => 'Bengaluru', 'state' => 'Karnataka', 'latitude' => 12.9716, 'longitude' => 77.5946],
    ],
    'zones' => [
        [
            'id' => 'hosur-core',
            'name' => 'Hosur core',
            'quick' => true,
            'subscription' => true,
            'polygon' => [
                [12.79, 77.78],
                [12.79, 77.88],
                [12.69, 77.88],
                [12.69, 77.78],
            ],
        ],
        [
            'id' => 'hosur-outskirts',
            'name' => 'Hosur outskirts',
            'quick' => false,
            'subscription' => true,
            'circle' => ['latitude' => 12.7409, 'longitude' => 77.8253, 'radiusKm' => 16],
        ],
        [
            'id' => 'krishnagiri',
            'name' => 'Krishnagiri',
            'quick' => true,
            'subscription' => false,
            'circle' => ['latitude' => 12.5186, 'longitude' => 78.2137, 'radiusKm' => 6],
        ],
    ],
];
