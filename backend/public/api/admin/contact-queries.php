<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Design\ContactQueryStore;
use App\Http\Json;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
  if ($method === 'GET') {
    Json::send(['queries' => ContactQueryStore::allForAdmin()]);
  }
  if ($method !== 'POST') {
    Json::send(['message' => 'Use GET or POST for contact queries.'], 405);
  }

  $body = Json::body();
  $action = strtolower(trim((string) ($body['action'] ?? '')));
  $id = trim((string) ($body['id'] ?? $body['queryId'] ?? ''));

  $query = match ($action) {
    'reply' => ContactQueryStore::adminReply(
      $id,
      trim((string) ($body['message'] ?? $body['response'] ?? '')),
      !array_key_exists('markContacted', $body) || filter_var($body['markContacted'], FILTER_VALIDATE_BOOLEAN),
    ),
    'set-status' => ContactQueryStore::setStatus($id, trim((string) ($body['status'] ?? ''))),
    default => throw new InvalidArgumentException('Choose a valid action.'),
  };

  Json::send(['query' => $query, 'queries' => ContactQueryStore::allForAdmin()]);
} catch (InvalidArgumentException $exception) {
  $code = (int) ($exception->getCode() > 0 ? $exception->getCode() : 422);
  Json::send(['message' => $exception->getMessage()], $code);
} catch (Throwable $exception) {
  error_log($exception->getMessage());
  Json::send(['message' => 'Contact queries could not be saved.'], 500);
}