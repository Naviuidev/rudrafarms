<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Auth\Accounts;
use App\Auth\AuthException;
use App\Design\ContactQueryStore;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
  $customer = Accounts::bearerCustomer();
  $customerId = (string) ($customer['id'] ?? '');
  $email = (string) ($customer['email'] ?? '');

  if ($method === 'GET') {
    Json::send(['queries' => ContactQueryStore::forCustomer($customerId, $email)]);
  }
  if ($method !== 'POST') {
    Json::send(['message' => 'Use GET or POST.'], 405);
  }

  $body = Json::body();
  $action = strtolower(trim((string) ($body['action'] ?? '')));
  if ($action !== 'reply') {
    throw new InvalidArgumentException('Unknown action.');
  }
  $query = ContactQueryStore::customerReply(
    trim((string) ($body['queryId'] ?? '')),
    $customerId,
    $email,
    trim((string) ($body['message'] ?? '')),
  );
  Json::send(['query' => $query]);
} catch (AuthException $exception) {
  Json::send(['message' => $exception->getMessage()], 401);
} catch (InvalidArgumentException $exception) {
  $code = (int) ($exception->getCode() > 0 ? $exception->getCode() : 422);
  Json::send(['message' => $exception->getMessage()], $code);
} catch (Throwable $exception) {
  error_log($exception->getMessage());
  Json::send(['message' => 'Queries could not be loaded.'], 500);
}