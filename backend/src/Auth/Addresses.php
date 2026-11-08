<?php

declare(strict_types=1);

namespace App\Auth;

use App\Database\Connection;

final class Addresses
{
    /** @return list<array<string, mixed>> */
    public static function all(string $customerId): array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at ASC',
        );
        $statement->execute([$customerId]);
        $rows = $statement->fetchAll();

        return array_map(self::present(...), is_array($rows) ? $rows : []);
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function save(string $customerId, array $input): array
    {
        $address = self::validate($input);
        $pdo = Connection::pdo();
        $existing = self::owned($customerId, $address['id']);
        $count = self::count($customerId);
        $wantsDefault = filter_var($input['isDefault'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($existing) {
            $isDefault = (int) $existing['is_default'];
        } else {
            $isDefault = ($count === 0 || $wantsDefault) ? 1 : 0;
        }

        $now = Support::now();
        $pdo->beginTransaction();
        try {
            if ($isDefault === 1) {
                $pdo->prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?')->execute([$customerId]);
            }
            if ($existing) {
                $pdo->prepare(
                    'UPDATE customer_addresses
                     SET line1 = ?, line2 = ?, landmark = ?, city = ?, state = ?, pin = ?, latitude = ?, longitude = ?,
                         address_type = ?, contact_name = ?, contact_phone = ?, is_default = ?, updated_at = ?
                     WHERE id = ? AND customer_id = ?',
                )->execute([
                    $address['line1'], $address['line2'], $address['landmark'], $address['city'], $address['state'],
                    $address['pin'], $address['latitude'], $address['longitude'], $address['type'],
                    $address['contactName'], $address['contactPhone'], $isDefault, $now, $address['id'], $customerId,
                ]);
            } else {
                $pdo->prepare(
                    'INSERT INTO customer_addresses
                     (id, customer_id, line1, line2, landmark, city, state, pin, latitude, longitude, address_type, contact_name, contact_phone, is_default, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )->execute([
                    $address['id'], $customerId, $address['line1'], $address['line2'], $address['landmark'],
                    $address['city'], $address['state'], $address['pin'], $address['latitude'], $address['longitude'],
                    $address['type'], $address['contactName'], $address['contactPhone'], $isDefault, $now, $now,
                ]);
            }
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        $saved = self::owned($customerId, $address['id']);
        if ($saved === null) {
            throw new AuthException('This address could not be saved.');
        }

        return self::present($saved);
    }

    public static function delete(string $customerId, string $id): void
    {
        $current = self::owned($customerId, $id);
        if ($current === null) {
            throw new AuthException('Choose an address to delete.');
        }

        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?')->execute([$id, $customerId]);
            if ((int) $current['is_default'] === 1) {
                $next = $pdo->prepare(
                    'SELECT id FROM customer_addresses WHERE customer_id = ? ORDER BY created_at ASC LIMIT 1',
                );
                $next->execute([$customerId]);
                $row = $next->fetch();
                if (is_array($row)) {
                    $pdo->prepare('UPDATE customer_addresses SET is_default = 1, updated_at = ? WHERE id = ?')
                        ->execute([Support::now(), $row['id']]);
                }
            }
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    public static function makeDefault(string $customerId, string $id): void
    {
        if (self::owned($customerId, $id) === null) {
            throw new AuthException('Choose an address to use as the default.');
        }

        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            $now = Support::now();
            $pdo->prepare('UPDATE customer_addresses SET is_default = 0, updated_at = ? WHERE customer_id = ?')
                ->execute([$now, $customerId]);
            $pdo->prepare('UPDATE customer_addresses SET is_default = 1, updated_at = ? WHERE id = ? AND customer_id = ?')
                ->execute([$now, $id, $customerId]);
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    /** @return array<string, mixed>|null */
    public static function getForCustomer(string $customerId, string $id): ?array
    {
        $row = self::owned($customerId, $id);

        return $row ? self::present($row) : null;
    }

    /** @return array<string, mixed>|null */
    private static function owned(string $customerId, string $id): ?array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ? LIMIT 1',
        );
        $statement->execute([$id, $customerId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    private static function count(string $customerId): int
    {
        $statement = Connection::pdo()->prepare('SELECT COUNT(*) FROM customer_addresses WHERE customer_id = ?');
        $statement->execute([$customerId]);

        return (int) $statement->fetchColumn();
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    private static function validate(array $input): array
    {
        $errors = [];
        $line1 = trim((string) ($input['line1'] ?? ''));
        $city = trim((string) ($input['city'] ?? ''));
        $state = trim((string) ($input['state'] ?? ''));
        $pin = preg_replace('/\D/', '', (string) ($input['pin'] ?? '')) ?? '';
        $name = trim((string) ($input['contactName'] ?? ''));
        $phone = preg_replace('/\D/', '', (string) ($input['contactPhone'] ?? '')) ?? '';
        $type = (string) ($input['type'] ?? 'home');
        $latitude = is_numeric($input['latitude'] ?? null) ? (float) $input['latitude'] : null;
        $longitude = is_numeric($input['longitude'] ?? null) ? (float) $input['longitude'] : null;

        if (mb_strlen($line1) < 5) {
            $errors['line1'] = 'Enter the house number and street.';
        }
        if (mb_strlen($city) < 2 || $state === '') {
            $errors['city'] = 'Enter the city and state.';
        }
        if (!preg_match('/^[1-9][0-9]{5}$/', $pin)) {
            $errors['pin'] = 'Enter a 6-digit PIN code.';
        }
        if ($latitude === null || $longitude === null || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
            $errors['point'] = 'Set a map point for this address.';
        }
        if (mb_strlen($name) < 2) {
            $errors['contactName'] = 'Enter the contact person.';
        }
        if (!preg_match('/^[6-9]\d{9}$/', $phone)) {
            $errors['contactPhone'] = 'Enter a 10-digit mobile number.';
        }
        if (!in_array($type, ['home', 'work', 'other'], true)) {
            $type = 'home';
        }
        if ($errors !== []) {
            throw new AuthException('Check the address fields.', 422, $errors);
        }

        $id = strtolower(trim((string) ($input['id'] ?? '')));
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id)) {
            $id = Support::uuid();
        }

        return [
            'id' => $id,
            'line1' => $line1,
            'line2' => trim((string) ($input['line2'] ?? '')),
            'landmark' => trim((string) ($input['landmark'] ?? '')),
            'city' => $city,
            'state' => $state,
            'pin' => $pin,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'type' => $type,
            'contactName' => $name,
            'contactPhone' => $phone,
        ];
    }

    /** @param array<string, mixed> $row */
    private static function present(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'line1' => (string) $row['line1'],
            'line2' => (string) $row['line2'],
            'landmark' => (string) $row['landmark'],
            'city' => (string) $row['city'],
            'state' => (string) $row['state'],
            'pin' => (string) $row['pin'],
            'latitude' => (float) $row['latitude'],
            'longitude' => (float) $row['longitude'],
            'type' => (string) $row['address_type'],
            'contactName' => (string) $row['contact_name'],
            'contactPhone' => (string) $row['contact_phone'],
            'isDefault' => (int) $row['is_default'] === 1,
        ];
    }
}
