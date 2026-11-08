<?php

declare(strict_types=1);

$root = realpath(__DIR__ . '/public');
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$uri = is_string($uri) ? rawurldecode($uri) : '/';

if ($root === false || $uri === '' || str_contains($uri, "\0") || str_contains($uri, '..')) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['message' => 'Not found']);
    return true;
}

$target = realpath($root . $uri);
if ($target === false || !str_starts_with($target, $root) || !is_file($target)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['message' => 'Not found']);
    return true;
}

if (pathinfo($target, PATHINFO_EXTENSION) === 'php') {
    require $target;
    return true;
}

$types = [
    'css' => 'text/css; charset=utf-8',
    'js' => 'text/javascript; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'svg' => 'image/svg+xml',
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'webp' => 'image/webp',
];
$extension = strtolower(pathinfo($target, PATHINFO_EXTENSION));
header('Content-Type: ' . ($types[$extension] ?? 'application/octet-stream'));
readfile($target);
return true;
