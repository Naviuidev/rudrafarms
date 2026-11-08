<?php

declare(strict_types=1);

return [
    'timezone' => 'Asia/Kolkata',
    'open' => '06:00',
    'close' => '20:00',
    'cutoff' => [
        'express' => '18:00',
        'same-day' => '16:00',
        'scheduled' => '20:00',
    ],
    'etaMinutes' => [
        'express' => 90,
        'same-day' => 240,
        'scheduled' => 0,
    ],
    'scheduledDaysAhead' => 7,
    'slots' => [
        [
            'key' => 'morning-6-8',
            'label' => '6:00–8:00 AM',
            'start' => '06:00',
            'end' => '08:00',
            'capacity' => 24,
            'types' => ['same-day', 'scheduled'],
        ],
        [
            'key' => 'morning-8-10',
            'label' => '8:00–10:00 AM',
            'start' => '08:00',
            'end' => '10:00',
            'capacity' => 24,
            'types' => ['same-day', 'scheduled'],
        ],
        [
            'key' => 'evening-4-6',
            'label' => '4:00–6:00 PM',
            'start' => '16:00',
            'end' => '18:00',
            'capacity' => 20,
            'types' => ['same-day', 'scheduled'],
        ],
        [
            'key' => 'evening-6-8',
            'label' => '6:00–8:00 PM',
            'start' => '18:00',
            'end' => '20:00',
            'capacity' => 20,
            'types' => ['same-day', 'scheduled'],
        ],
    ],
];
