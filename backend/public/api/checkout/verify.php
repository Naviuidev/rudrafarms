<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Auth\Accounts;
use App\Auth\AuthException;
use App\Http\Json;
use App\Order\Checkout;
use App\Order\OrderException;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Json::send(['message' => 'Method not allowed.'], 405);
}

try {
    $customer = Accounts::bearerCustomer();
    Json::send(Checkout::verify($customer, Json::body()));
} catch (AuthException $exception) {
    $payload = ['message' => $exception->getMessage()];
    if ($exception->errors() !== []) {
        $payload['errors'] = $exception->errors();
    }
    Json::send($payload, $exception->status());
} catch (OrderException $exception) {
    Json::send(['message' => $exception->getMessage(), 'errors' => $exception->errors()], $exception->status());
} catch (Throwable) {
    Json::send(['message' => 'The payment could not be confirmed.'], 500);
}
