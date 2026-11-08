<?php

declare(strict_types=1);

return [
    'maxQty' => 12,
    'deliveryFee' => 40,
    'freeDeliveryMinimum' => 499,
    'coupons' => [
        'FARM10' => ['type' => 'percent', 'value' => 10, 'max' => 100, 'minimum' => 200],
        'FRESH50' => ['type' => 'flat', 'value' => 50, 'minimum' => 300],
    ],
    // Fresh milk, curd, eggs, vegetables, and fruit are untaxed. Packaged paneer and honey are taxed.
    'taxPercent' => [
        'paneer' => 5,
        'honey' => 5,
    ],
];
