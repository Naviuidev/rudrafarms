<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\AdminDashboard;
use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Use GET for the dashboard.'], 405);
}

try {
    $from = (string) ($_GET['from'] ?? '');
    $to = (string) ($_GET['to'] ?? '');
    Json::send(AdminDashboard::metrics(['from' => $from, 'to' => $to]));
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Dashboard metrics could not be loaded.'], 500);
}
