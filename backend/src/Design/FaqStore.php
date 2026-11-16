<?php

declare(strict_types=1);

namespace App\Design;

use App\Auth\Support;
use InvalidArgumentException;

final class FaqStore
{
    public static function path(): string
    {
        return dirname(__DIR__, 2) . '/storage/faqs.json';
    }

    /** @return list<array<string, mixed>> */
    public static function publicList(): array
    {
        $items = self::all();

        return array_values(array_filter(
            $items,
            static fn (array $item): bool => !empty($item['active']),
        ));
    }

    /** @return list<array<string, mixed>> */
    public static function all(): array
    {
        $document = self::document();
        $items = is_array($document['faqs'] ?? null) ? $document['faqs'] : [];
        usort($items, static function (array $a, array $b): int {
            $order = ((int) ($a['sortOrder'] ?? 0)) <=> ((int) ($b['sortOrder'] ?? 0));
            if ($order !== 0) {
                return $order;
            }

            return strcmp((string) ($a['updatedAt'] ?? ''), (string) ($b['updatedAt'] ?? ''));
        });

        return array_map(static fn (array $item): array => self::present($item), $items);
    }

    /** @param array<string, mixed> $input @return list<array<string, mixed>> */
    public static function save(array $input): array
    {
        $document = self::document();
        $question = self::text($input['question'] ?? '', 240);
        if ($question === '') {
            throw new InvalidArgumentException('Enter a question.');
        }
        $answer = self::text($input['answer'] ?? '', 4000);
        if ($answer === '') {
            throw new InvalidArgumentException('Enter an answer.');
        }
        $active = !empty($input['active']);
        $sortOrder = is_numeric($input['sortOrder'] ?? null) ? (int) $input['sortOrder'] : 0;
        $now = Support::now();
        $id = trim((string) ($input['id'] ?? ''));

        $items = is_array($document['faqs'] ?? null) ? $document['faqs'] : [];
        $replaced = false;
        foreach ($items as $index => $row) {
            if (!is_array($row) || (string) ($row['id'] ?? '') !== $id || $id === '') {
                continue;
            }
            $items[$index] = [
                'id' => $id,
                'question' => $question,
                'answer' => $answer,
                'active' => $active,
                'sortOrder' => $sortOrder,
                'updatedAt' => $now,
            ];
            $replaced = true;
            break;
        }
        if (!$replaced) {
            $items[] = [
                'id' => $id !== '' ? $id : Support::uuid(),
                'question' => $question,
                'answer' => $answer,
                'active' => $active,
                'sortOrder' => $sortOrder,
                'updatedAt' => $now,
            ];
        }

        $document['faqs'] = $items;
        self::writeDocument($document);

        return self::all();
    }

    public static function delete(string $id): array
    {
        $id = trim($id);
        if ($id === '') {
            throw new InvalidArgumentException('Choose an FAQ to delete.');
        }
        $document = self::document();
        $items = is_array($document['faqs'] ?? null) ? $document['faqs'] : [];
        $items = array_values(array_filter(
            $items,
            static fn (mixed $row): bool => is_array($row) && (string) ($row['id'] ?? '') !== $id,
        ));
        $document['faqs'] = $items;
        self::writeDocument($document);

        return self::all();
    }

    /** @return array{faqs: list<array<string, mixed>>} */
    private static function document(): array
    {
        $path = self::path();
        if (!is_file($path)) {
            return ['faqs' => []];
        }
        $raw = file_get_contents($path);
        if (!is_string($raw) || $raw === '') {
            return ['faqs' => []];
        }
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : ['faqs' => []];
    }

    /** @param array<string, mixed> $document */
    private static function writeDocument(array $document): void
    {
        $path = self::path();
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new InvalidArgumentException('The FAQ file could not be saved.');
        }
        $encoded = json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || file_put_contents($path, $encoded) === false) {
            throw new InvalidArgumentException('The FAQ file could not be saved.');
        }
    }

    /** @param array<string, mixed> $item @return array<string, mixed> */
    private static function present(array $item): array
    {
        return [
            'id' => (string) ($item['id'] ?? ''),
            'question' => (string) ($item['question'] ?? ''),
            'answer' => (string) ($item['answer'] ?? ''),
            'active' => !empty($item['active']),
            'sortOrder' => (int) ($item['sortOrder'] ?? 0),
            'updatedAt' => (string) ($item['updatedAt'] ?? ''),
        ];
    }

    private static function text(mixed $value, int $max): string
    {
        $text = trim((string) $value);
        if ($text === '') {
            return '';
        }
        if (strlen($text) > $max) {
            throw new InvalidArgumentException('Keep the text shorter.');
        }

        return $text;
    }
}
