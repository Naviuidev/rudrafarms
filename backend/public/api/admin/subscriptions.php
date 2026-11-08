<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\AdminSubscriptionsService;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if (isset($_GET['renewals']) && (string) $_GET['renewals'] === '1') {
            Json::send(['renewals' => AdminSubscriptionsService::upcomingRenewals((int) ($_GET['days'] ?? 7))]);
        }
        Json::send([
            'subscriptions' => AdminSubscriptionsService::list([
                'status' => (string) ($_GET['status'] ?? ''),
                'search' => (string) ($_GET['search'] ?? ''),
                'limit' => (int) ($_GET['limit'] ?? 80),
            ]),
            'renewals' => AdminSubscriptionsService::upcomingRenewals(7),
        ]);
    }

    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST.'], 405);
    }

    $body = Json::body();
    if ((string) ($body['action'] ?? '') !== 'set-status') {
        Json::send(['message' => 'Unknown action.'], 422);
    }

    AdminSubscriptionsService::setStatus(
        trim((string) ($body['id'] ?? '')),
        trim((string) ($body['status'] ?? '')),
    );
    Json::send(['ok' => true]);
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Subscriptions could not be loaded.'], 500);
}
