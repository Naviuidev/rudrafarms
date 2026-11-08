<?php

declare(strict_types=1);

namespace App\Order;

use RuntimeException;

final class OrderException extends RuntimeException
{
    /** @param array<string, string> $errors */
    public function __construct(
        string $message,
        private int $status = 422,
        private array $errors = [],
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }

    /** @return array<string, string> */
    public function errors(): array
    {
        return $this->errors;
    }
}
