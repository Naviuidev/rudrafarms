<?php

declare(strict_types=1);

namespace App\Admin;

final class DeveloperGate
{
    public static function assert(string $area, string $password): void
    {
        $expected = match ($area) {
            'payments' => 'Payments@1998',
            'email' => 'Smtp@1998',
            'data' => 'Hosur@1998',
            'database' => 'Db@1998',
            default => '',
        };
        if ($expected === '' || !hash_equals($expected, $password)) {
            throw new \InvalidArgumentException('That password is not correct.', 401);
        }
    }
}
