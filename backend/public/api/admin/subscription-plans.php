<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Http\Json;
use App\Subscription\SubscriptionException;
use App\Subscription\SubscriptionService;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        Json::send(['plans' => SubscriptionService::adminPlans()]);
    }

    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST.'], 405);
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? 'save');

    if ($action === 'delete') {
        SubscriptionService::deletePlan(trim((string) ($body['id'] ?? '')));
        Json::send(['plans' => SubscriptionService::adminPlans()]);
    }

    if ($action !== 'save') {
        Json::send(['message' => 'Unknown action.'], 422);
    }

    $plan = is_array($body['plan'] ?? null) ? $body['plan'] : [];
    Json::send(['plan' => SubscriptionService::savePlan($plan), 'plans' => SubscriptionService::adminPlans()]);
} catch (SubscriptionException $exception) {
    Json::send(['message' => $exception->getMessage(), 'errors' => $exception->errors()], $exception->status());
} catch (Throwable) {
    Json::send(['message' => 'Plans could not be saved.'], 500);
}
