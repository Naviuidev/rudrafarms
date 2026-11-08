<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Admin\CouponService;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        Json::send(['coupons' => CouponService::listAll()]);
    }

    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST.'], 405);
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? 'save');

    if ($action === 'delete') {
        CouponService::delete(trim((string) ($body['id'] ?? '')));
        Json::send(['coupons' => CouponService::listAll()]);
    }

    if ($action !== 'save') {
        Json::send(['message' => 'Unknown action.'], 422);
    }

    $input = is_array($body['coupon'] ?? null) ? $body['coupon'] : [];
    Json::send(['coupons' => CouponService::save($input)]);
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Coupons could not be saved.'], 500);
}
