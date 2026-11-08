<?php

declare(strict_types=1);

namespace App\Admin;

use App\Catalog\Catalog;
use App\Database\Connection;
use PDO;

final class FarmData
{
    /** @var array<string, string> */
    public const KINDS = [
        'users' => 'Users',
        'products' => 'Products',
        'categories' => 'Categories',
        'units' => 'Units',
        'orders' => 'Orders',
        'delivery-boys' => 'Delivery boys',
        'subscriptions' => 'Subscriptions',
        'coupons' => 'Coupons',
    ];

    /** @return array{kind: string, label: string, columns: list<array{key: string, label: string}>, rows: list<array<string, string>>} */
    public static function list(string $kind): array
    {
        $kind = self::kind($kind);
        AdminSchema::ensure();
        $pdo = Connection::pdo();

        $columns = match ($kind) {
            'users' => [['key' => 'name', 'label' => 'Name'], ['key' => 'email', 'label' => 'Email'], ['key' => 'phone', 'label' => 'Phone'], ['key' => 'created', 'label' => 'Created']],
            'products' => [['key' => 'name', 'label' => 'Name'], ['key' => 'active', 'label' => 'Active']],
            'categories' => [['key' => 'name', 'label' => 'Name'], ['key' => 'parent', 'label' => 'Parent'], ['key' => 'active', 'label' => 'Active']],
            'units' => [['key' => 'name', 'label' => 'Name'], ['key' => 'active', 'label' => 'Active']],
            'orders' => [['key' => 'number', 'label' => 'Order'], ['key' => 'status', 'label' => 'Status'], ['key' => 'payable', 'label' => 'Payable'], ['key' => 'created', 'label' => 'Created']],
            'delivery-boys' => [['key' => 'name', 'label' => 'Name'], ['key' => 'phone', 'label' => 'Phone'], ['key' => 'vehicle', 'label' => 'Vehicle'], ['key' => 'active', 'label' => 'Active']],
            'subscriptions' => [['key' => 'customer', 'label' => 'Customer'], ['key' => 'status', 'label' => 'Status'], ['key' => 'start', 'label' => 'Starts']],
            'coupons' => [['key' => 'code', 'label' => 'Code'], ['key' => 'discount', 'label' => 'Discount'], ['key' => 'active', 'label' => 'Active']],
        };

        $rows = match ($kind) {
            'users' => self::users($pdo),
            'products' => self::products($pdo),
            'categories' => self::categories($pdo),
            'units' => self::units($pdo),
            'orders' => self::orders($pdo),
            'delivery-boys' => self::deliveryBoys($pdo),
            'subscriptions' => self::subscriptions($pdo),
            'coupons' => self::coupons($pdo),
        };

        return [
            'kind' => $kind,
            'label' => self::KINDS[$kind],
            'columns' => $columns,
            'rows' => $rows,
        ];
    }

    public static function delete(string $kind, string $id): void
    {
        $kind = self::kind($kind);
        $id = trim($id);
        if ($id === '') {
            throw new \InvalidArgumentException('Choose a record to delete.');
        }
        Catalog::markSeeded();
        AdminSchema::ensure();
        $pdo = Connection::pdo();
        if (!self::present($pdo, $kind, $id)) {
            throw new \InvalidArgumentException('That record is no longer there.');
        }
        $pdo->beginTransaction();
        try {
            self::remove($pdo, $kind, $id);
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log($exception->getMessage());
            throw new \InvalidArgumentException('That record is still used by other data.');
        }
        if (self::present($pdo, $kind, $id)) {
            throw new \InvalidArgumentException('That record is still used by other data.');
        }
    }

    public static function deleteAll(string $kind): int
    {
        $kind = self::kind($kind);
        Catalog::markSeeded();
        AdminSchema::ensure();
        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            self::remove($pdo, $kind, null);
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log($exception->getMessage());
            throw new \InvalidArgumentException('Those records are still used by other data.');
        }
        if (self::countKind($pdo, $kind) > 0) {
            throw new \InvalidArgumentException('Those records are still used by other data.');
        }

        return 0;
    }

    private static function kind(string $kind): string
    {
        if (!isset(self::KINDS[$kind])) {
            throw new \InvalidArgumentException('Choose a data set.');
        }

        return $kind;
    }

    private static function remove(PDO $pdo, string $kind, ?string $id): int
    {
        if ($kind === 'users') {
            return self::run($pdo, 'DELETE FROM customers' . self::where($id), $id);
        }
        if ($kind === 'products') {
            self::run($pdo, 'DELETE FROM subscription_lines' . ($id === null ? '' : ' WHERE product_id = ?'), $id);

            return self::run($pdo, 'DELETE FROM products' . self::where($id), $id);
        }
        if ($kind === 'categories') {
            return self::removeCategories($pdo, $id);
        }
        if ($kind === 'units') {
            return self::removeUnits($pdo, $id);
        }
        if ($kind === 'orders') {
            self::run($pdo, 'UPDATE subscription_cycles SET orders_order_id = NULL' . ($id === null ? '' : ' WHERE orders_order_id = ?'), $id);

            return self::run($pdo, 'DELETE FROM orders' . self::where($id), $id);
        }
        if ($kind === 'delivery-boys') {
            self::run($pdo, 'UPDATE delivery_assignments SET personnel_id = NULL' . ($id === null ? ' WHERE personnel_id IS NOT NULL' : ' WHERE personnel_id = ?'), $id);

            return self::run($pdo, 'DELETE FROM delivery_personnel' . self::where($id), $id);
        }
        if ($kind === 'subscriptions') {
            if ($id === null) {
                $pdo->exec(
                    'DELETE da FROM delivery_assignments da
                     INNER JOIN subscription_deliveries sd ON sd.id = da.subscription_delivery_id',
                );
            } else {
                $pdo->prepare(
                    'DELETE da FROM delivery_assignments da
                     INNER JOIN subscription_deliveries sd ON sd.id = da.subscription_delivery_id
                     WHERE sd.subscription_id = ?',
                )->execute([$id]);
            }

            return self::run($pdo, 'DELETE FROM subscriptions' . self::where($id), $id);
        }

        return self::run($pdo, 'DELETE FROM coupons' . self::where($id), $id);
    }

    private static function where(?string $id): string
    {
        return $id === null ? '' : ' WHERE id = ?';
    }

    private static function table(string $kind): string
    {
        return match ($kind) {
            'users' => 'customers',
            'products' => 'products',
            'categories' => 'categories',
            'units' => 'units',
            'orders' => 'orders',
            'delivery-boys' => 'delivery_personnel',
            'subscriptions' => 'subscriptions',
            'coupons' => 'coupons',
        };
    }

    private static function present(PDO $pdo, string $kind, string $id): bool
    {
        $statement = $pdo->prepare('SELECT 1 FROM ' . self::table($kind) . ' WHERE id = ?');
        $statement->execute([$id]);

        return $statement->fetchColumn() !== false;
    }

    private static function countKind(PDO $pdo, string $kind): int
    {
        return (int) $pdo->query('SELECT COUNT(*) FROM ' . self::table($kind))->fetchColumn();
    }

    private static function removeCategories(PDO $pdo, ?string $id): int
    {
        if ($id === null) {
            self::run($pdo, 'DELETE FROM subscription_lines', null);
            self::run($pdo, 'DELETE FROM products', null);
            self::run($pdo, 'UPDATE categories SET parent_id = NULL', null);

            return self::run($pdo, 'DELETE FROM categories', null);
        }

        $pdo->prepare(
            'DELETE sl FROM subscription_lines sl
             INNER JOIN products p ON p.id = sl.product_id
             LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
             WHERE p.category_id = ? OR sc.category_id = ?',
        )->execute([$id, $id]);
        $pdo->prepare(
            'DELETE p FROM products p
             LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
             WHERE p.category_id = ? OR sc.category_id = ?',
        )->execute([$id, $id]);

        return self::run($pdo, 'DELETE FROM categories WHERE id = ?', $id);
    }

    private static function removeUnits(PDO $pdo, ?string $id): int
    {
        if ($id === null) {
            $pdo->exec(
                'DELETE sl FROM subscription_lines sl
                 INNER JOIN product_variants v ON v.id = sl.variant_id',
            );
            self::run($pdo, 'DELETE FROM product_variants', null);

            return self::run($pdo, 'DELETE FROM units', null);
        }

        $pdo->prepare(
            'DELETE sl FROM subscription_lines sl
             INNER JOIN product_variants v ON v.id = sl.variant_id
             WHERE v.unit_id = ?',
        )->execute([$id]);
        self::run($pdo, 'DELETE FROM product_variants WHERE unit_id = ?', $id);

        return self::run($pdo, 'DELETE FROM units WHERE id = ?', $id);
    }

    private static function run(PDO $pdo, string $sql, ?string $id): int
    {
        $statement = $pdo->prepare($sql);
        $statement->execute($id === null ? [] : [$id]);

        return $statement->rowCount();
    }

    /** @return list<array<string, string>> */
    private static function users(PDO $pdo): array
    {
        $rows = $pdo->query('SELECT id, name, email, phone, created_at FROM customers ORDER BY created_at DESC')->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'phone' => (string) ($row['phone'] ?? ''),
            'created' => self::when((string) $row['created_at']),
        ], $rows);
    }

    /** @return list<array<string, string>> */
    private static function products(PDO $pdo): array
    {
        $rows = $pdo->query('SELECT id, name, active FROM products ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'active' => (int) $row['active'] === 1 ? 'Yes' : 'No',
        ], $rows);
    }

    /** @return list<array<string, string>> */
    private static function categories(PDO $pdo): array
    {
        $rows = $pdo->query(
            'SELECT c.id, c.name, c.active, parent.name AS parent_name
             FROM categories c
             LEFT JOIN categories parent ON parent.id = c.parent_id
             ORDER BY c.name',
        )->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'parent' => (string) ($row['parent_name'] ?? ''),
            'active' => (int) $row['active'] === 1 ? 'Yes' : 'No',
        ], $rows);
    }

    /** @return list<array<string, string>> */
    private static function units(PDO $pdo): array
    {
        $rows = $pdo->query('SELECT id, name, active FROM units ORDER BY sort_order, name')->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'active' => (int) $row['active'] === 1 ? 'Yes' : 'No',
        ], $rows);
    }

    /** @return list<array<string, string>> */
    private static function orders(PDO $pdo): array
    {
        $rows = $pdo->query('SELECT id, order_number, status, payable, created_at FROM orders ORDER BY created_at DESC')->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'number' => (string) $row['order_number'],
            'status' => str_replace('_', ' ', (string) $row['status']),
            'payable' => '₹' . number_format((int) $row['payable']),
            'created' => self::when((string) $row['created_at']),
        ], $rows);
    }

    /** @return list<array<string, string>> */
    private static function deliveryBoys(PDO $pdo): array
    {
        $rows = $pdo->query('SELECT id, name, phone, vehicle, active FROM delivery_personnel ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'phone' => (string) $row['phone'],
            'vehicle' => (string) $row['vehicle'],
            'active' => (int) $row['active'] === 1 ? 'Yes' : 'No',
        ], $rows);
    }

    /** @return list<array<string, string>> */
    private static function subscriptions(PDO $pdo): array
    {
        $rows = $pdo->query(
            'SELECT s.id, s.status, s.start_date, c.name AS customer_name
             FROM subscriptions s
             INNER JOIN customers c ON c.id = s.customer_id
             ORDER BY s.created_at DESC',
        )->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'customer' => (string) $row['customer_name'],
            'status' => str_replace('_', ' ', (string) $row['status']),
            'start' => (string) $row['start_date'],
        ], $rows);
    }

    /** @return list<array<string, string>> */
    private static function coupons(PDO $pdo): array
    {
        $rows = $pdo->query('SELECT id, code, discount_type, discount_value, active FROM coupons ORDER BY code')->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static function (array $row): array {
            $value = (int) $row['discount_value'];
            $discount = (string) $row['discount_type'] === 'percent' ? $value . '%' : '₹' . number_format($value);

            return [
                'id' => (string) $row['id'],
                'code' => (string) $row['code'],
                'discount' => $discount,
                'active' => (int) $row['active'] === 1 ? 'Yes' : 'No',
            ];
        }, $rows);
    }

    private static function when(string $value): string
    {
        $stamp = strtotime($value . ' UTC');

        return $stamp === false ? $value : gmdate('d M Y', $stamp);
    }
}
