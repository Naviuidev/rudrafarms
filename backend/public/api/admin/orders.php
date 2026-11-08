<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\AdminOrdersService;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'POST') {
        $body = Json::body();
        $action = (string) ($body['action'] ?? '');
        if ($action !== 'set-status') {
            Json::send(['message' => 'Unknown order action.'], 422);
        }
        $deliveryDate = trim((string) ($body['deliveryDate'] ?? ''));
        if ($deliveryDate !== '') {
            Json::send(AdminOrdersService::updateDeliveryDay(
                (string) ($body['orderId'] ?? ''),
                $deliveryDate,
                (string) ($body['status'] ?? ''),
                (string) ($body['note'] ?? ''),
            ));
        }
        Json::send(AdminOrdersService::updateStatus(
            (string) ($body['orderId'] ?? ''),
            (string) ($body['status'] ?? ''),
            (string) ($body['note'] ?? ''),
        ));
    }

    if ($method !== 'GET') {
        Json::send(['message' => 'Use GET or POST for admin orders.'], 405);
    }

    $format = strtolower(trim((string) ($_GET['format'] ?? 'json')));
    $id = trim((string) ($_GET['id'] ?? ''));

    if ($id !== '') {
        $detail = AdminOrdersService::detail($id);
        if ($detail === null) {
            Json::send(['message' => 'Order not found.'], 404);
        }
        Json::send($detail);
    }

    $filters = [
        'from' => (string) ($_GET['from'] ?? ''),
        'to' => (string) ($_GET['to'] ?? ''),
        'status' => (string) ($_GET['status'] ?? ''),
        'paymentStatus' => (string) ($_GET['paymentStatus'] ?? ''),
        'deliveryType' => (string) ($_GET['deliveryType'] ?? ''),
        'search' => (string) ($_GET['search'] ?? ''),
        'customerId' => (string) ($_GET['customerId'] ?? ''),
        'bucket' => (string) ($_GET['bucket'] ?? ''),
        'limit' => (int) ($_GET['limit'] ?? 80),
    ];

    if ($format === 'csv') {
        if ((int) ($_GET['limit'] ?? 0) < 1) {
            $filters['limit'] = 2000;
        }
        header_remove('Content-Type');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="orders-export-' . date('Y-m-d') . '.csv"');
        $rows = AdminOrdersService::csvRows($filters);
        $out = fopen('php://output', 'w');
        if ($out !== false) {
            foreach ($rows as $row) {
                fputcsv($out, array_values($row));
            }
            fclose($out);
        }
        exit;
    }

    Json::send(['orders' => AdminOrdersService::listOrders($filters)]);
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Orders could not be loaded.'], 500);
}
