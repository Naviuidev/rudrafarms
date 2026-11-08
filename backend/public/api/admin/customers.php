<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\AdminCustomersService;
use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Json::send(['message' => 'Use GET for admin customers.'], 405);
}

try {
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id !== '') {
        $detail = AdminCustomersService::detail($id);
        if ($detail === null) {
            Json::send(['message' => 'Customer not found.'], 404);
        }
        Json::send($detail);
    }

    $filters = [
        'search' => (string) ($_GET['search'] ?? ''),
        'limit' => (int) ($_GET['limit'] ?? 80),
    ];
    Json::send(['customers' => AdminCustomersService::listCustomers($filters)]);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Customers could not be loaded.'], 500);
}
