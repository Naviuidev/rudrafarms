<?php

declare(strict_types=1);

namespace App\Design;

use App\Auth\Mail;
use App\Auth\Support;
use InvalidArgumentException;

final class ContactQueryStore
{
    /** @var array<string, string> */
    public const TOPICS = [
        'payment_deducted_no_order' => 'Payment got deducted but order not placed',
        'payment_in_process' => 'Payment is in process',
        'custom' => 'Custom message',
    ];

    public static function path(): string
    {
        return dirname(__DIR__, 2) . '/storage/contact-queries.json';
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function submit(array $input, ?string $customerId = null): array
    {
        $fullName = self::text($input['fullName'] ?? $input['name'] ?? '', 120);
        if (mb_strlen($fullName) < 2) {
            throw new InvalidArgumentException('Enter your full name.');
        }
        $email = strtolower(self::text($input['email'] ?? '', 190));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Enter a valid email address.');
        }
        $mobile = preg_replace('/\D/', '', (string) ($input['mobile'] ?? $input['phone'] ?? '')) ?? '';
        if (!preg_match('/^[6-9]\d{9}$/', $mobile)) {
            throw new InvalidArgumentException('Enter a 10-digit mobile number.');
        }

        $topicKey = trim((string) ($input['topicKey'] ?? $input['query'] ?? ''));
        if (!isset(self::TOPICS[$topicKey])) {
            throw new InvalidArgumentException('Choose a query type.');
        }
        $topicLabel = self::TOPICS[$topicKey];

        $message = trim((string) ($input['message'] ?? ''));
        if ($topicKey === 'custom') {
            if (mb_strlen($message) < 10) {
                throw new InvalidArgumentException('Write your message (at least 10 characters).');
            }
            if (mb_strlen($message) > 4000) {
                throw new InvalidArgumentException('Keep the message shorter.');
            }
        } else {
            $message = $message !== '' ? $message : $topicLabel;
            if (mb_strlen($message) > 4000) {
                throw new InvalidArgumentException('Keep the message shorter.');
            }
        }

        $now = Support::now();
        $id = Support::uuid();
        $entry = [
            'id' => $id,
            'customerId' => $customerId ?? '',
            'fullName' => $fullName,
            'email' => $email,
            'mobile' => $mobile,
            'topicKey' => $topicKey,
            'topicLabel' => $topicLabel,
            'status' => 'open',
            'messages' => [
                [
                    'id' => Support::uuid(),
                    'role' => 'customer',
                    'body' => $message,
                    'createdAt' => $now,
                ],
            ],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];

        $document = self::document();
        $queries = is_array($document['queries'] ?? null) ? $document['queries'] : [];
        $queries[] = $entry;
        $document['queries'] = $queries;
        self::writeDocument($document);

        return self::present($entry);
    }

    /** @return list<array<string, mixed>> */
    public static function allForAdmin(): array
    {
        $queries = is_array(self::document()['queries'] ?? null) ? self::document()['queries'] : [];
        usort($queries, static fn (array $a, array $b): int => strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? '')));

        return array_map(static fn (array $row): array => self::present($row), array_filter($queries, 'is_array'));
    }

    /** @return list<array<string, mixed>> */
    public static function forCustomer(string $customerId, string $email): array
    {
        $email = strtolower(trim($email));
        $queries = is_array(self::document()['queries'] ?? null) ? self::document()['queries'] : [];
        $out = [];
        foreach ($queries as $row) {
            if (!is_array($row)) {
                continue;
            }
            $rowCustomerId = (string) ($row['customerId'] ?? '');
            $rowEmail = strtolower((string) ($row['email'] ?? ''));
            if ($customerId !== '' && $rowCustomerId === $customerId) {
                $out[] = self::present($row);
                continue;
            }
            if ($email !== '' && $rowEmail === $email) {
                $out[] = self::present($row);
            }
        }
        usort($out, static fn (array $a, array $b): int => strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? '')));

        return $out;
    }

    /** @return array<string, mixed> */
    public static function customerReply(string $queryId, string $customerId, string $email, string $body): array
    {
        $body = trim($body);
        if (mb_strlen($body) < 2) {
            throw new InvalidArgumentException('Write a short reply.');
        }
        if (mb_strlen($body) > 4000) {
            throw new InvalidArgumentException('Keep the reply shorter.');
        }

        $document = self::document();
        $queries = is_array($document['queries'] ?? null) ? $document['queries'] : [];
        $found = null;
        foreach ($queries as $index => $row) {
            if (!is_array($row) || (string) ($row['id'] ?? '') !== $queryId) {
                continue;
            }
            if (!self::customerOwns($row, $customerId, $email)) {
                throw new InvalidArgumentException('That query was not found.');
            }
            $now = Support::now();
            $messages = is_array($row['messages'] ?? null) ? $row['messages'] : [];
            $messages[] = [
                'id' => Support::uuid(),
                'role' => 'customer',
                'body' => $body,
                'createdAt' => $now,
            ];
            $row['messages'] = $messages;
            $row['status'] = 'open';
            $row['updatedAt'] = $now;
            $queries[$index] = $row;
            $found = $row;
            break;
        }
        if ($found === null) {
            throw new InvalidArgumentException('That query was not found.');
        }
        $document['queries'] = $queries;
        self::writeDocument($document);

        return self::present($found);
    }

    /** @return array<string, mixed> */
    public static function adminReply(string $queryId, string $body, bool $markContacted = true): array
    {
        $body = trim($body);
        if (mb_strlen($body) < 2) {
            throw new InvalidArgumentException('Write a response for the customer.');
        }
        if (mb_strlen($body) > 4000) {
            throw new InvalidArgumentException('Keep the response shorter.');
        }

        $document = self::document();
        $queries = is_array($document['queries'] ?? null) ? $document['queries'] : [];
        $found = null;
        foreach ($queries as $index => $row) {
            if (!is_array($row) || (string) ($row['id'] ?? '') !== $queryId) {
                continue;
            }
            $now = Support::now();
            $messages = is_array($row['messages'] ?? null) ? $row['messages'] : [];
            $messages[] = [
                'id' => Support::uuid(),
                'role' => 'admin',
                'body' => $body,
                'createdAt' => $now,
            ];
            $row['messages'] = $messages;
            $row['status'] = $markContacted ? 'contacted' : (string) ($row['status'] ?? 'open');
            $row['updatedAt'] = $now;
            $queries[$index] = $row;
            $found = $row;
            break;
        }
        if ($found === null) {
            throw new InvalidArgumentException('That query was not found.');
        }
        $document['queries'] = $queries;
        self::writeDocument($document);

        $name = (string) ($found['fullName'] ?? 'Customer');
        $email = (string) ($found['email'] ?? '');
        if ($email !== '') {
            $subject = 'Re: Your message to Rudra\'s Farm Fresh';
            $mailBody = "Hello {$name},\n\nThank you for contacting Rudra's Farm Fresh.\n\n{$body}\n\n— Rudra's Farm Fresh team\n";
            Mail::send($email, $name, $subject, $mailBody);
        }

        return self::present($found);
    }

    /** @return array<string, mixed> */
    public static function setStatus(string $queryId, string $status): array
    {
        $status = strtolower(trim($status));
        if (!in_array($status, ['open', 'contacted'], true)) {
            throw new InvalidArgumentException('Choose a valid status.');
        }

        $document = self::document();
        $queries = is_array($document['queries'] ?? null) ? $document['queries'] : [];
        $found = null;
        foreach ($queries as $index => $row) {
            if (!is_array($row) || (string) ($row['id'] ?? '') !== $queryId) {
                continue;
            }
            $row['status'] = $status;
            $row['updatedAt'] = Support::now();
            $queries[$index] = $row;
            $found = $row;
            break;
        }
        if ($found === null) {
            throw new InvalidArgumentException('That query was not found.');
        }
        $document['queries'] = $queries;
        self::writeDocument($document);

        return self::present($found);
    }

    /** @param array<string, mixed> $row */
    private static function customerOwns(array $row, string $customerId, string $email): bool
    {
        $rowCustomerId = (string) ($row['customerId'] ?? '');
        if ($customerId !== '' && $rowCustomerId === $customerId) {
            return true;
        }

        return strtolower((string) ($row['email'] ?? '')) === strtolower(trim($email));
    }

    /** @return array{queries: list<array<string, mixed>>} */
    private static function document(): array
    {
        $path = self::path();
        if (!is_file($path)) {
            return ['queries' => []];
        }
        $raw = file_get_contents($path);
        if (!is_string($raw) || $raw === '') {
            return ['queries' => []];
        }
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : ['queries' => []];
    }

    /** @param array<string, mixed> $document */
    private static function writeDocument(array $document): void
    {
        $path = self::path();
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new InvalidArgumentException('Contact queries could not be saved.');
        }
        $encoded = json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || file_put_contents($path, $encoded) === false) {
            throw new InvalidArgumentException('Contact queries could not be saved.');
        }
    }

    /** @param array<string, mixed> $item @return array<string, mixed> */
    private static function present(array $item): array
    {
        $messages = [];
        foreach (is_array($item['messages'] ?? null) ? $item['messages'] : [] as $message) {
            if (!is_array($message)) {
                continue;
            }
            $messages[] = [
                'id' => (string) ($message['id'] ?? ''),
                'role' => (string) ($message['role'] ?? 'customer'),
                'body' => (string) ($message['body'] ?? ''),
                'createdAt' => (string) ($message['createdAt'] ?? ''),
            ];
        }

        return [
            'id' => (string) ($item['id'] ?? ''),
            'customerId' => (string) ($item['customerId'] ?? ''),
            'fullName' => (string) ($item['fullName'] ?? ''),
            'email' => (string) ($item['email'] ?? ''),
            'mobile' => (string) ($item['mobile'] ?? ''),
            'topicKey' => (string) ($item['topicKey'] ?? ''),
            'topicLabel' => (string) ($item['topicLabel'] ?? ''),
            'status' => (string) ($item['status'] ?? 'open'),
            'statusLabel' => (string) ($item['status'] ?? 'open') === 'contacted' ? 'Contacted' : 'Open',
            'messages' => $messages,
            'createdAt' => (string) ($item['createdAt'] ?? ''),
            'updatedAt' => (string) ($item['updatedAt'] ?? ''),
        ];
    }

    private static function text(mixed $value, int $max): string
    {
        $text = trim((string) $value);
        if (strlen($text) > $max) {
            throw new InvalidArgumentException('Keep the text shorter.');
        }

        return $text;
    }
}