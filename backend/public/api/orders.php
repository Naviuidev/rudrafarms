<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Auth\Accounts;
use App\Auth\AuthException;
use App\Http\Json;
use App\Order\Checkout;
use App\Order\OrderException;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $customer = Accounts::bearerCustomer();
    if ($method === 'GET') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id !== '') {
            Json::send(['order' => Checkout::detail((string) $customer['id'], $id)]);
        }
        Json::send(['orders' => Checkout::list((string) $customer['id'])]);
    }
    Json::send(['message' => 'Method not allowed.'], 405);
} catch (AuthException $exception) {
    $payload = ['message' => $exception->getMessage()];
    if ($exception->errors() !== []) {
        $payload['errors'] = $exception->errors();
    }
    Json::send($payload, $exception->status());
} catch (OrderException $exception) {
    Json::send(['message' => $exception->getMessage(), 'errors' => $exception->errors()], $exception->status());
} catch (Throwable) {
    Json::send(['message' => 'Orders could not be loaded.'], 500);
}
