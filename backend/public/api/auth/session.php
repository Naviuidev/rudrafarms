<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Auth\Accounts;

Accounts::handle(static fn (): array => Accounts::current(Accounts::bearerCustomer()));
