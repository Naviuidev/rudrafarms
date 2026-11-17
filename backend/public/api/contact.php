<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Auth\Tokens;
use App\Design\ContactQueryStore;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        Json::send([
            'topics' => ContactQueryStore::TOPICS,
        ]);
    }
    if ($method !== 'POST') {
        Json::send(['message' => 'Use GET or POST for contact.'], 405);
    }

    $body = Json::body();
    $action = strtolower(trim((string) ($body['action'] ?? 'submit')));
    if ($action !== 'submit') {
        throw new InvalidArgumentException('Unknown contact action.');
    }

    $customerId = null;
    $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^Bearer\s+(\S+)$/i', $header, $match) === 1) {
        $customer = Tokens::sessionCustomer($match[1]);
        if (is_array($customer)) {
            $customerId = (string) ($customer['id'] ?? '');
        }
    }

    $query = ContactQueryStore::submit(is_array($body) ? $body : [], $customerId);
    Json::send(['query' => $query, 'ok' => true]);
} catch (InvalidArgumentException $exception) {
    Json::send(['message' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Json::send(['message' => 'Your message could not be sent.'], 500);
}