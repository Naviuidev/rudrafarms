<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Auth\Accounts;
use App\Auth\AuthException;
use App\Http\Json;
use App\Order\OrderActions;
use App\Order\OrderException;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Json::send(['message' => 'Use POST.'], 405);
}

try {
    $customer = Accounts::bearerCustomer();
    $body = Json::body();
    $action = (string) ($body['action'] ?? '');

    $result = match ($action) {
        'request-cancellation' => OrderActions::requestCancellation($customer, trim((string) ($body['orderId'] ?? ''))),
        'cancel-subscription' => OrderActions::cancelSubscription(
            $customer,
            trim((string) ($body['orderId'] ?? '')),
            trim((string) ($body['reason'] ?? '')),
        ),
        'reorder-preview' => OrderActions::reorderPayload($customer, trim((string) ($body['orderId'] ?? ''))),
        'reorder' => OrderActions::reorderPlace($customer, $body),
        default => null,
    };

    if ($result === null) {
        Json::send(['message' => 'Choose order action request-cancellation, cancel-subscription, reorder-preview, or reorder.'], 422);
    }

    Json::send($result);
} catch (AuthException $exception) {
    $payload = ['message' => $exception->getMessage()];
    if ($exception->errors() !== []) {
        $payload['errors'] = $exception->errors();
    }
    Json::send($payload, $exception->status());
} catch (OrderException $exception) {
    Json::send(['message' => $exception->getMessage(), 'errors' => $exception->errors()], $exception->status());
} catch (Throwable) {
    Json::send(['message' => 'That action could not be completed.'], 500);
}
