<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Auth\Accounts;
use App\Auth\Addresses;
use App\Http\Json;

Accounts::handle(static function (): array {
    $customer = Accounts::bearerCustomer();
    $id = (string) $customer['id'];
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        return ['addresses' => Addresses::all($id)];
    }

    $body = Json::body();
    $action = (string) ($body['action'] ?? 'save');
    if ($action === 'delete') {
        Addresses::delete($id, (string) ($body['id'] ?? ''));
    } elseif ($action === 'default') {
        Addresses::makeDefault($id, (string) ($body['id'] ?? ''));
    } else {
        $input = $body['address'] ?? null;
        if (!is_array($input)) {
            Json::send(['message' => 'Enter the address details.'], 422);
        }
        Addresses::save($id, $input);
    }

    return ['addresses' => Addresses::all($id)];
});
