<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Config\EnvironmentOverview;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method !== 'GET') {
        Json::send(['message' => 'Use GET.'], 405);
    }

    Json::send(['overview' => EnvironmentOverview::view()]);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Environment overview could not be loaded.'], 500);
}
