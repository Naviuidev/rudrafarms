<?php

declare(strict_types=1);

namespace App\Admin;

use App\Database\Connection;
use PDO;

final class AdminCustomersService
{
    /**
     * @param array{search?: string, limit?: int} $filters
     *
     * @return list<array<string, mixed>>
     */
    public static function listCustomers(array $filters = []): array
    {
        AdminSchema::ensure();
        $pdo = Connection::pdo();
        $search = trim((string) ($filters['search'] ?? ''));
        $limit = max(1, min(200, (int) ($filters['limit'] ?? 80)));

        $where = ['1=1'];
        $params = [];
        if ($search !== '') {
            $where[] = '(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $sql = "SELECT c.id, c.name, c.email, c.phone, c.email_verified_at, c.created_at,
                       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count
                FROM customers c
                WHERE " . implode(' AND ', $where) . '
                ORDER BY c.created_at DESC
                LIMIT ' . (int) $limit;

        $st = $pdo->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'phone' => (string) ($row['phone'] ?? ''),
            'emailVerifiedAt' => !empty($row['email_verified_at']) ? (string) $row['email_verified_at'] : '',
            'orderCount' => (int) ($row['order_count'] ?? 0),
            'createdAt' => (string) $row['created_at'],
        ], is_array($rows) ? $rows : []);
    }

    /**
     * @return array{customer: array<string, mixed>, addresses: list<array<string, mixed>>}|null
     */
    public static function detail(string $customerId): ?array
    {
        AdminSchema::ensure();
        $customerId = trim($customerId);
        if ($customerId === '') {
            return null;
        }

        $pdo = Connection::pdo();
        $st = $pdo->prepare(
            'SELECT id, name, email, phone, email_verified_at, created_at,
                    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count
             FROM customers c WHERE id = ? LIMIT 1',
        );
        $st->execute([$customerId]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        $addrSt = $pdo->prepare(
            'SELECT id, line1, line2, landmark, city, state, pin, latitude, longitude,
                    address_type, contact_name, contact_phone, is_default, created_at
             FROM customer_addresses WHERE customer_id = ?
             ORDER BY is_default DESC, created_at DESC',
        );
        $addrSt->execute([$customerId]);
        $addrRows = $addrSt->fetchAll(PDO::FETCH_ASSOC);
        $addresses = [];
        foreach (is_array($addrRows) ? $addrRows : [] as $a) {
            if (!is_array($a)) {
                continue;
            }
            $addresses[] = [
                'id' => (string) $a['id'],
                'line1' => (string) $a['line1'],
                'line2' => (string) ($a['line2'] ?? ''),
                'landmark' => (string) ($a['landmark'] ?? ''),
                'city' => (string) $a['city'],
                'state' => (string) $a['state'],
                'pin' => (string) $a['pin'],
                'latitude' => (string) $a['latitude'],
                'longitude' => (string) $a['longitude'],
                'addressType' => (string) ($a['address_type'] ?? ''),
                'contactName' => (string) ($a['contact_name'] ?? ''),
                'contactPhone' => (string) ($a['contact_phone'] ?? ''),
                'isDefault' => (bool) (int) ($a['is_default'] ?? 0),
                'createdAt' => (string) ($a['created_at'] ?? ''),
            ];
        }

        return [
            'customer' => [
                'id' => (string) $row['id'],
                'name' => (string) $row['name'],
                'email' => (string) $row['email'],
                'phone' => (string) ($row['phone'] ?? ''),
                'emailVerifiedAt' => !empty($row['email_verified_at']) ? (string) $row['email_verified_at'] : '',
                'orderCount' => (int) ($row['order_count'] ?? 0),
                'createdAt' => (string) $row['created_at'],
            ],
            'addresses' => $addresses,
        ];
    }
}
