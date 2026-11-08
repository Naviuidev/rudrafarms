<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Http\Json;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Json::send(['message' => 'Use POST to upload an image.'], 405);
}

$file = $_FILES['image'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Json::send(['message' => 'Choose an image to upload.'], 422);
}

$size = (int) ($file['size'] ?? 0);
if ($size < 1 || $size > 2_000_000) {
    Json::send(['message' => 'Use an image up to 2 MB.'], 422);
}

$original = strtolower((string) pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
$extension = $original === 'jpeg' ? 'jpg' : $original;
$allowed = [
    'svg' => ['image/svg+xml', 'text/plain', 'text/xml', 'application/xml'],
    'jpg' => ['image/jpeg'],
    'png' => ['image/png'],
    'webp' => ['image/webp'],
];
if (!isset($allowed[$extension])) {
    Json::send(['message' => 'Upload an SVG, JPG, PNG, or WebP image.'], 422);
}

$temporary = (string) ($file['tmp_name'] ?? '');
$mime = mime_content_type($temporary);
if (!is_string($mime) || !in_array($mime, $allowed[$extension], true)) {
    Json::send(['message' => 'Upload an SVG, JPG, PNG, or WebP image.'], 422);
}

if ($extension === 'svg') {
    $markup = file_get_contents($temporary);
    if (!is_string($markup) || preg_match('/<svg[\s>]/i', $markup) !== 1 || preg_match('/<script|javascript:/i', $markup) === 1) {
        Json::send(['message' => 'That SVG file cannot be used.'], 422);
    }
} elseif (getimagesize($temporary) === false) {
    Json::send(['message' => 'That image file cannot be used.'], 422);
}

$name = bin2hex(random_bytes(8)) . '.' . $extension;
$directories = [
    dirname(__DIR__, 2) . '/images',
    dirname(__DIR__, 4) . '/customer/public/images',
];
$stored = false;
foreach ($directories as $index => $directory) {
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        continue;
    }
    $destination = $directory . '/' . $name;
    if ($index === 0) {
        $stored = move_uploaded_file($temporary, $destination);
        continue;
    }
    if ($stored && is_file($directories[0] . '/' . $name)) {
        copy($directories[0] . '/' . $name, $destination);
    }
}

if (!$stored) {
    Json::send(['message' => 'The image could not be saved.'], 500);
}

Json::send(['path' => '/images/' . $name]);
