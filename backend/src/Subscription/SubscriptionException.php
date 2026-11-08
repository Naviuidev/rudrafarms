<?php

declare(strict_types=1);

namespace App\Subscription;

use Exception;

final class SubscriptionException extends Exception
{
    /** @param array<string, string> $errors */
    public function __construct(
        string $message,
        private int $httpStatus = 400,
        private array $errors = [],
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->httpStatus;
    }

    /** @return array<string, string> */
    public function errors(): array
    {
        return $this->errors;
    }
}
