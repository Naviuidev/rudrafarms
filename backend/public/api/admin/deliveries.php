<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\DeliveryAdminService;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if (isset($_GET['history'])) {
            Json::send(['history' => DeliveryAdminService::statusHistory((string) $_GET['history'])]);
        }
        if (isset($_GET['upcoming']) && (string) $_GET['upcoming'] === '1') {
            Json::send(DeliveryAdminService::upcomingSubscriptionDeliveries());
        }
        if (isset($_GET['pending']) && (string) $_GET['pending'] === '1') {
            $pendingFilters = [
                'from' => (string) ($_GET['from'] ?? ''),
                'to' => (string) ($_GET['to'] ?? ''),
                'limit' => (int) ($_GET['limit'] ?? 80),
            ];
            Json::send([
                'pendingOrders' => DeliveryAdminService::pendingQuickOrders($pendingFilters),
                'pendingSubscriptionDeliveries' => DeliveryAdminService::pendingSubscriptionDeliveries($pendingFilters),
            ]);
        }
        $filters = [
            'from' => (string) ($_GET['from'] ?? ''),
            'to' => (string) ($_GET['to'] ?? ''),
            'personnelId' => (string) ($_GET['personnelId'] ?? ''),
            'status' => (string) ($_GET['status'] ?? ''),
        ];
        Json::send([
            'personnel' => DeliveryAdminService::listPersonnel(),
            'assignments' => DeliveryAdminService::listAssignments($filters),
        ]);
    }

    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST.'], 405);
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? '');

    $result = match ($action) {
        'save-personnel' => ['personnel' => DeliveryAdminService::savePersonnel(is_array($body['personnel'] ?? null) ? $body['personnel'] : [])],
        'save-assignment' => ['assignments' => DeliveryAdminService::upsertAssignment(is_array($body['assignment'] ?? null) ? $body['assignment'] : [])],
        'set-status' => ['assignments' => DeliveryAdminService::setAssignmentStatus(is_array($body['payload'] ?? null) ? $body['payload'] : [])],
        default => null,
    };

    if ($result === null) {
        Json::send(['message' => 'Unknown delivery action.'], 422);
    }

    Json::send($result);
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Delivery data could not be saved.'], 500);
}
