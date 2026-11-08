<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Auth\Accounts;
use App\Http\Json;

Accounts::handle(static function (): array {
    $customer = Accounts::bearerCustomer();

    return Accounts::changePassword($customer, Json::body());
});
