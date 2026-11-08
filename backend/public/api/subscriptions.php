<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Auth\Accounts;
use App\Auth\AuthException;
use App\Http\Json;
use App\Payment\PaymentConfig;
use App\Subscription\SubscriptionActions;
use App\Subscription\SubscriptionCheckout;
use App\Subscription\SubscriptionService;
use App\Order\OrderException;
use App\Subscription\SubscriptionException;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $customer = Accounts::bearerCustomer();

    if ($method === 'GET') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id !== '') {
            Json::send(['subscription' => SubscriptionService::detailForCustomer((string) $customer['id'], $id)]);
        }
        /** @var array{schedules: list<array<string, mixed>>} $subConfig */
        $subConfig = require dirname(__DIR__, 2) . '/config/subscription.php';
        $credentials = PaymentConfig::credentials();
        Json::send([
            'plans' => SubscriptionService::publicPlans(),
            'subscriptions' => SubscriptionService::listForCustomer((string) $customer['id']),
            'schedules' => $subConfig['schedules'] ?? [],
            'paymentSandbox' => str_starts_with((string) ($credentials['keyId'] ?? ''), 'rzp_test_'),
        ]);
    }

    if ($method !== 'POST') {
        Json::send(['message' => 'Method not allowed.'], 405);
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? '');

    $result = match ($action) {
        'quote' => SubscriptionCheckout::quote($customer, $body),
        'start' => SubscriptionCheckout::start($customer, $body),
        'renew' => SubscriptionCheckout::renew($customer, $body),
        'pause' => SubscriptionActions::pause($customer, $body),
        'resume' => SubscriptionActions::resume($customer, $body),
        'skip' => SubscriptionActions::skipDelivery($customer, $body),
        'withdraw-skip' => SubscriptionActions::withdrawSkip($customer, $body),
        'pause-query' => SubscriptionActions::pauseQuery($customer, $body),
        'cancel' => SubscriptionActions::cancel($customer, $body),
        default => null,
    };

    if ($result === null) {
        Json::send(['message' => 'Choose a subscription action.'], 422);
    }

    Json::send($result);
} catch (AuthException $exception) {
    $payload = ['message' => $exception->getMessage()];
    if ($exception->errors() !== []) {
        $payload['errors'] = $exception->errors();
    }
    Json::send($payload, $exception->status());
} catch (SubscriptionException $exception) {
    Json::send(['message' => $exception->getMessage(), 'errors' => $exception->errors()], $exception->status());
} catch (OrderException $exception) {
    Json::send(['message' => $exception->getMessage(), 'errors' => $exception->errors()], $exception->status());
} catch (Throwable) {
    Json::send(['message' => 'Subscriptions could not be loaded.'], 500);
}
