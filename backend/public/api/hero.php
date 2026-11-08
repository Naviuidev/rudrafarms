<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Design\HeroStore;
use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Use GET to load the storefront hero.'], 405);
}

Json::send(['hero' => HeroStore::get()]);
