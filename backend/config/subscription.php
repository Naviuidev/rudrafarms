<?php

declare(strict_types=1);

return [
    /** Days before paid period ends to email a renewal reminder (requires SMTP). */
    'reminderDaysBefore' => 3,
    'schedules' => [
        [
            'key' => 'morning',
            'label' => 'Morning · before 7:00 AM',
            'detail' => 'One drop each day, delivered before 7:00 AM.',
            'multiplier' => 1,
        ],
        [
            'key' => 'evening',
            'label' => 'Evening · before 4:00 PM',
            'detail' => 'One drop each day, delivered before 4:00 PM.',
            'multiplier' => 1,
        ],
        [
            'key' => 'both',
            'label' => 'Morning & evening',
            'detail' => 'Two drops each day. Daily product price is doubled.',
            'multiplier' => 2,
        ],
    ],
];
