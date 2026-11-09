<?php

declare(strict_types=1);

namespace App\Catalog;

use App\Auth\Schema as AuthSchema;
use App\Auth\Support;
use App\Database\Connection;
use InvalidArgumentException;
use PDO;
use PDOException;

final class Catalog
{
    private static bool $ready = false;

    public static function ensure(): void
    {
        if (self::$ready) {
            return;
        }

        AuthSchema::ensure();
        $pdo = Connection::pdo();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS units (
                id CHAR(36) NOT NULL PRIMARY KEY,
                name VARCHAR(40) NOT NULL,
                sort_order SMALLINT NOT NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                UNIQUE KEY units_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS categories (
                id CHAR(36) NOT NULL PRIMARY KEY,
                name VARCHAR(80) NOT NULL,
                slug VARCHAR(80) NOT NULL,
                image VARCHAR(255) NOT NULL DEFAULT \'\',
                sort_order SMALLINT NOT NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY categories_slug (slug)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subcategories (
                id CHAR(36) NOT NULL PRIMARY KEY,
                category_id CHAR(36) NOT NULL,
                name VARCHAR(80) NOT NULL,
                slug VARCHAR(80) NOT NULL,
                sort_order SMALLINT NOT NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY subcategories_slug (category_id, slug),
                CONSTRAINT subcategories_category_fk FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(40) NOT NULL PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                description TEXT NOT NULL,
                category_id CHAR(36) NOT NULL,
                subcategory_id CHAR(36) NULL,
                featured TINYINT(1) NOT NULL DEFAULT 0,
                popular TINYINT(1) NOT NULL DEFAULT 0,
                bestseller TINYINT(1) NOT NULL DEFAULT 0,
                subscription_eligible TINYINT(1) NOT NULL DEFAULT 0,
                quick_delivery_eligible TINYINT(1) NOT NULL DEFAULT 0,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                KEY products_category (category_id),
                KEY products_subcategory (subcategory_id),
                CONSTRAINT products_category_fk FOREIGN KEY (category_id) REFERENCES categories (id),
                CONSTRAINT products_subcategory_fk FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS product_images (
                id CHAR(36) NOT NULL PRIMARY KEY,
                product_id VARCHAR(40) NOT NULL,
                url VARCHAR(255) NOT NULL,
                sort_order SMALLINT NOT NULL,
                KEY product_images_product (product_id, sort_order),
                CONSTRAINT product_images_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS product_variants (
                id CHAR(36) NOT NULL PRIMARY KEY,
                product_id VARCHAR(40) NOT NULL,
                unit_id CHAR(36) NOT NULL,
                label VARCHAR(80) NOT NULL DEFAULT "",
                mrp DECIMAL(10,2) NOT NULL,
                selling_price DECIMAL(10,2) NOT NULL,
                stock INT NOT NULL DEFAULT 0,
                available TINYINT(1) NOT NULL DEFAULT 1,
                active TINYINT(1) NOT NULL DEFAULT 1,
                is_default TINYINT(1) NOT NULL DEFAULT 0,
                sort_order SMALLINT NOT NULL DEFAULT 0,
                KEY product_variants_product (product_id, sort_order),
                CONSTRAINT product_variants_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
                CONSTRAINT product_variants_unit_fk FOREIGN KEY (unit_id) REFERENCES units (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS wishlists (
                customer_id CHAR(36) NOT NULL,
                product_id VARCHAR(40) NOT NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (customer_id, product_id),
                CONSTRAINT wishlists_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
                CONSTRAINT wishlists_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $imageColumn = $pdo->query("SHOW COLUMNS FROM categories LIKE 'image'")->fetch();
        if ($imageColumn === false) {
            $pdo->exec("ALTER TABLE categories ADD image VARCHAR(255) NOT NULL DEFAULT '' AFTER slug");
        }
        $parentColumn = $pdo->query("SHOW COLUMNS FROM categories LIKE 'parent_id'")->fetch();
        if ($parentColumn === false) {
            $pdo->exec('ALTER TABLE categories ADD COLUMN parent_id CHAR(36) NULL AFTER id');
            $pdo->exec('ALTER TABLE categories ADD KEY categories_parent (parent_id)');
            $pdo->exec(
                'ALTER TABLE categories ADD CONSTRAINT categories_parent_fk FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE SET NULL',
            );
        }
        self::seed();
        self::$ready = true;
    }

    /** @return array{categories: list<array<string, mixed>>, products: list<array<string, mixed>>} */
    public static function publicCatalog(): array
    {
        self::ensure();

        return [
            'categories' => self::categoryTree(true),
            'products' => self::productList(false),
        ];
    }

    /** @return array{units: list<array<string, mixed>>, categories: list<array<string, mixed>>, products: list<array<string, mixed>>} */
    public static function adminCatalog(): array
    {
        self::ensure();

        return [
            'units' => self::unitList(false),
            'categories' => self::categoryTree(false),
            'products' => self::productList(true),
        ];
    }

    /** @param array<string, mixed> $input */
    public static function saveUnit(array $input): array
    {
        self::ensure();
        $name = self::requiredText($input['name'] ?? '', 40, 'Enter a unit name.');
        $active = self::flag($input['active'] ?? true);
        $id = trim((string) ($input['id'] ?? ''));
        $pdo = Connection::pdo();
        if ($id === '') {
            $id = Support::uuid();
            $sort = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units')->fetchColumn();
            self::write(static fn () => $pdo->prepare(
                'INSERT INTO units (id, name, sort_order, active, created_at) VALUES (?, ?, ?, ?, ?)',
            )->execute([$id, $name, $sort, $active, Support::now()]));
        } else {
            self::write(static fn () => $pdo->prepare('UPDATE units SET name = ?, active = ? WHERE id = ?')->execute([$name, $active, $id]));
            if (!self::exists('units', $id)) {
                throw new InvalidArgumentException('This unit could not be found.');
            }
        }

        return self::adminCatalog();
    }

    public static function deleteUnit(string $id): array
    {
        self::ensure();
        if (self::count('SELECT COUNT(*) FROM product_variants WHERE unit_id = ?', [$id]) > 0) {
            throw new InvalidArgumentException('This unit is used by a product. Mark it inactive instead.');
        }
        Connection::pdo()->prepare('DELETE FROM units WHERE id = ?')->execute([$id]);

        return self::adminCatalog();
    }

    /** @param array<string, mixed> $input */
    public static function saveCategory(array $input): array
    {
        self::ensure();
        $name = self::requiredText($input['name'] ?? '', 80, 'Enter a category name.');
        $image = self::imagePath($input['image'] ?? '');
        $active = self::flag($input['active'] ?? true);
        $id = trim((string) ($input['id'] ?? ''));
        $parentId = trim((string) ($input['parentId'] ?? ''));
        $parentId = $parentId === '' ? null : $parentId;
        if ($parentId !== null && !self::exists('categories', $parentId)) {
            throw new InvalidArgumentException('Choose a valid parent category.');
        }
        if ($parentId === $id && $id !== '') {
            throw new InvalidArgumentException('A category cannot be its own parent.');
        }
        $pdo = Connection::pdo();
        $now = Support::now();
        if ($id === '') {
            $id = Support::uuid();
            $slug = self::uniqueSlug('categories', self::slug($name));
            $sort = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories')->fetchColumn();
            self::write(static fn () => $pdo->prepare(
                'INSERT INTO categories (id, parent_id, name, slug, image, sort_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )->execute([$id, $parentId, $name, $slug, $image, $sort, $active, $now, $now]));
        } else {
            self::write(static fn () => $pdo->prepare(
                'UPDATE categories SET name = ?, image = ?, active = ?, parent_id = ?, updated_at = ? WHERE id = ?',
            )->execute([$name, $image, $active, $parentId, $now, $id]));
            if (!self::exists('categories', $id)) {
                throw new InvalidArgumentException('This category could not be found.');
            }
        }

        return self::adminCatalog();
    }

    public static function deleteCategory(string $id): array
    {
        self::ensure();
        if (self::count('SELECT COUNT(*) FROM products WHERE category_id = ?', [$id]) > 0) {
            throw new InvalidArgumentException('This category still has products. Mark it inactive instead.');
        }
        $pdo = Connection::pdo();
        $pdo->prepare('DELETE FROM subcategories WHERE category_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);

        return self::adminCatalog();
    }

    /** @param array<string, mixed> $input */
    public static function saveSubcategory(array $input): array
    {
        self::ensure();
        $name = self::requiredText($input['name'] ?? '', 80, 'Enter a subcategory name.');
        $categoryId = trim((string) ($input['categoryId'] ?? ''));
        if (!self::exists('categories', $categoryId)) {
            throw new InvalidArgumentException('Choose a category.');
        }
        $active = self::flag($input['active'] ?? true);
        $id = trim((string) ($input['id'] ?? ''));
        $pdo = Connection::pdo();
        $now = Support::now();
        if ($id === '') {
            $id = Support::uuid();
            $slug = self::uniqueSlug('subcategories', self::slug($name), 'category_id', $categoryId);
            $sort = self::count('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM subcategories WHERE category_id = ?', [$categoryId]);
            self::write(static fn () => $pdo->prepare(
                'INSERT INTO subcategories (id, category_id, name, slug, sort_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            )->execute([$id, $categoryId, $name, $slug, $sort, $active, $now, $now]));
        } else {
            $current = self::row('SELECT category_id FROM subcategories WHERE id = ?', [$id]);
            if ($current === null) {
                throw new InvalidArgumentException('This subcategory could not be found.');
            }
            if ($current['category_id'] !== $categoryId && self::count('SELECT COUNT(*) FROM products WHERE subcategory_id = ?', [$id]) > 0) {
                throw new InvalidArgumentException('Move the products out of this subcategory before changing its category.');
            }
            $slug = self::uniqueSlug('subcategories', self::slug($name), 'category_id', $categoryId, $id);
            self::write(static fn () => $pdo->prepare(
                'UPDATE subcategories SET category_id = ?, name = ?, slug = ?, active = ?, updated_at = ? WHERE id = ?',
            )->execute([$categoryId, $name, $slug, $active, $now, $id]));
        }

        return self::adminCatalog();
    }

    public static function deleteSubcategory(string $id): array
    {
        self::ensure();
        if (self::count('SELECT COUNT(*) FROM products WHERE subcategory_id = ?', [$id]) > 0) {
            throw new InvalidArgumentException('This subcategory still has products. Mark it inactive instead.');
        }
        Connection::pdo()->prepare('DELETE FROM subcategories WHERE id = ?')->execute([$id]);

        return self::adminCatalog();
    }

    /** @param array<string, mixed> $input */
    public static function saveProduct(array $input): array
    {
        self::ensure();
        $name = self::requiredText($input['name'] ?? '', 120, 'Enter a product name.');
        $description = trim((string) ($input['description'] ?? ''));
        if ($description === '' || strlen($description) > 2000) {
            throw new InvalidArgumentException('Enter a description up to 2000 characters.');
        }
        $categoryId = trim((string) ($input['categoryId'] ?? ''));
        if (!self::exists('categories', $categoryId)) {
            throw new InvalidArgumentException('Choose a category.');
        }
        $subcategoryId = trim((string) ($input['subcategoryId'] ?? ''));
        if ($subcategoryId !== '') {
            $subcategory = self::row('SELECT category_id FROM subcategories WHERE id = ?', [$subcategoryId]);
            if ($subcategory === null || $subcategory['category_id'] !== $categoryId) {
                throw new InvalidArgumentException('Choose a subcategory from the selected category.');
            }
        } else {
            $subcategoryId = null;
        }
        $images = self::images($input['images'] ?? []);
        $variants = self::variants($input['variants'] ?? []);
        $id = trim((string) ($input['id'] ?? ''));
        $pdo = Connection::pdo();
        $now = Support::now();
        $fields = [
            $name,
            $description,
            $categoryId,
            $subcategoryId,
            self::flag($input['featured'] ?? false),
            self::flag($input['popular'] ?? false),
            self::flag($input['bestseller'] ?? false),
            self::flag($input['subscription'] ?? false),
            self::flag($input['quickDelivery'] ?? false),
            self::flag($input['active'] ?? true),
            $now,
        ];
        $pdo->beginTransaction();
        try {
            if ($id === '') {
                $id = self::uniqueProductId($name);
                $pdo->prepare(
                    'INSERT INTO products (
                        id, name, description, category_id, subcategory_id, featured, popular, bestseller,
                        subscription_eligible, quick_delivery_eligible, active, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )->execute([$id, ...$fields, $now]);
            } else {
                if (!self::exists('products', $id)) {
                    throw new InvalidArgumentException('This product could not be found.');
                }
                $pdo->prepare(
                    'UPDATE products SET
                        name = ?, description = ?, category_id = ?, subcategory_id = ?, featured = ?, popular = ?,
                        bestseller = ?, subscription_eligible = ?, quick_delivery_eligible = ?, active = ?, updated_at = ?
                     WHERE id = ?',
                )->execute([...$fields, $id]);
            }
            $pdo->prepare('DELETE FROM product_images WHERE product_id = ?')->execute([$id]);
            $image = $pdo->prepare('INSERT INTO product_images (id, product_id, url, sort_order) VALUES (?, ?, ?, ?)');
            foreach ($images as $index => $url) {
                $image->execute([Support::uuid(), $id, $url, $index]);
            }
            $kept = [];
            $write = $pdo->prepare(
                'INSERT INTO product_variants (
                    id, product_id, unit_id, label, mrp, selling_price, stock, available, active, is_default, sort_order
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    unit_id = VALUES(unit_id), label = VALUES(label), mrp = VALUES(mrp),
                    selling_price = VALUES(selling_price), stock = VALUES(stock), available = VALUES(available),
                    active = VALUES(active), is_default = VALUES(is_default), sort_order = VALUES(sort_order)',
            );
            foreach ($variants as $index => $variant) {
                $variantId = $variant['id'];
                if ($variantId !== '' && !self::variantBelongs($variantId, $id)) {
                    throw new InvalidArgumentException('A variant does not belong to this product.');
                }
                if ($variantId === '') {
                    $variantId = Support::uuid();
                }
                $write->execute([
                    $variantId,
                    $id,
                    $variant['unitId'],
                    $variant['label'],
                    $variant['mrp'],
                    $variant['sellingPrice'],
                    $variant['stock'],
                    $variant['available'],
                    $variant['active'],
                    $variant['isDefault'],
                    $index,
                ]);
                $kept[] = $variantId;
            }
            $placeholders = implode(',', array_fill(0, count($kept), '?'));
            $pdo->prepare("DELETE FROM product_variants WHERE product_id = ? AND id NOT IN ({$placeholders})")
                ->execute([$id, ...$kept]);
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        return self::adminCatalog();
    }

    public static function deleteProduct(string $id): array
    {
        self::ensure();
        Connection::pdo()->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);

        return self::adminCatalog();
    }

    /** @return list<string> */
    public static function wishlist(string $customerId): array
    {
        self::ensure();
        $rows = self::rows(
            'SELECT product_id FROM wishlists WHERE customer_id = ? ORDER BY created_at DESC',
            [$customerId],
        );

        return array_map(static fn (array $row): string => (string) $row['product_id'], $rows);
    }

    /** @return list<string> */
    public static function addWish(string $customerId, string $productId): array
    {
        self::ensure();
        if (!self::productIsVisible($productId)) {
            throw new InvalidArgumentException('That product is not available.');
        }
        Connection::pdo()->prepare(
            'INSERT IGNORE INTO wishlists (customer_id, product_id, created_at) VALUES (?, ?, ?)',
        )->execute([$customerId, $productId, Support::now()]);

        return self::wishlist($customerId);
    }

    /** @return list<string> */
    public static function removeWish(string $customerId, string $productId): array
    {
        self::ensure();
        Connection::pdo()->prepare('DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?')
            ->execute([$customerId, $productId]);

        return self::wishlist($customerId);
    }

    public static function markSeeded(): void
    {
        $flag = self::seedFlag();
        if (!is_file($flag)) {
            file_put_contents($flag, 'seeded');
        }
    }

    private static function seedFlag(): string
    {
        return dirname(__DIR__, 2) . '/storage/catalog.seeded';
    }

    private static function seed(): void
    {
        $pdo = Connection::pdo();
        $hasCatalog =
            (int) $pdo->query('SELECT COUNT(*) FROM units')->fetchColumn() > 0
            || (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn() > 0;

        if (is_file(self::seedFlag())) {
            if ($hasCatalog) {
                return;
            }
            @unlink(self::seedFlag());
        }

        if ($hasCatalog) {
            self::markSeeded();

            return;
        }

        $now = Support::now();
        $units = [
            ['11111111-1111-4111-8111-111111111001', '250 g'],
            ['11111111-1111-4111-8111-111111111002', '500 g'],
            ['11111111-1111-4111-8111-111111111003', '1 kg'],
            ['11111111-1111-4111-8111-111111111004', '500 ml'],
            ['11111111-1111-4111-8111-111111111005', '1 litre'],
            ['11111111-1111-4111-8111-111111111006', '1 piece'],
            ['11111111-1111-4111-8111-111111111007', '1 dozen'],
            ['11111111-1111-4111-8111-111111111008', 'Packet'],
            ['11111111-1111-4111-8111-111111111009', '200 g'],
            ['11111111-1111-4111-8111-111111111010', '6 pieces'],
        ];
        $categories = [
            ['22222222-2222-4222-8222-222222222001', 'Milk & Dairy', 'milk-dairy'],
            ['22222222-2222-4222-8222-222222222002', 'Eggs & Poultry', 'eggs-poultry'],
            ['22222222-2222-4222-8222-222222222003', 'Fresh Vegetables', 'fresh-vegetables'],
            ['22222222-2222-4222-8222-222222222004', 'Fresh Fruits', 'fresh-fruits'],
            ['22222222-2222-4222-8222-222222222005', 'Natural Products', 'natural-products'],
        ];
        $subs = [
            ['33333333-3333-4333-8333-333333333001', '22222222-2222-4222-8222-222222222001', 'Milk', 'milk'],
            ['33333333-3333-4333-8333-333333333002', '22222222-2222-4222-8222-222222222001', 'Curd', 'curd'],
            ['33333333-3333-4333-8333-333333333003', '22222222-2222-4222-8222-222222222001', 'Paneer', 'paneer'],
            ['33333333-3333-4333-8333-333333333004', '22222222-2222-4222-8222-222222222002', 'Eggs', 'eggs'],
            ['33333333-3333-4333-8333-333333333005', '22222222-2222-4222-8222-222222222003', 'Leafy greens', 'leafy-greens'],
            ['33333333-3333-4333-8333-333333333006', '22222222-2222-4222-8222-222222222004', 'Seasonal fruit', 'seasonal-fruit'],
            ['33333333-3333-4333-8333-333333333007', '22222222-2222-4222-8222-222222222005', 'Honey', 'honey'],
        ];
        $products = [
            ['cow-milk', 'Cow Milk', 'Fresh cow milk for the morning pour, sold by the litre.', '22222222-2222-4222-8222-222222222001', '33333333-3333-4333-8333-333333333001', 1, 1, 0, 1, 1, '/images/cow-milk.svg'],
            ['buffalo-milk', 'Buffalo Milk', 'Richer buffalo milk, kept separate from cow milk.', '22222222-2222-4222-8222-222222222001', '33333333-3333-4333-8333-333333333001', 1, 0, 1, 1, 1, '/images/buffalo-milk.svg'],
            ['curd', 'Fresh Curd', 'Set curd from the same dairy route, packed in 500 g.', '22222222-2222-4222-8222-222222222001', '33333333-3333-4333-8333-333333333002', 1, 1, 0, 1, 1, '/images/curd.svg'],
            ['paneer', 'Paneer', 'Soft paneer for the day, sold in a 200 g block.', '22222222-2222-4222-8222-222222222001', '33333333-3333-4333-8333-333333333003', 0, 0, 1, 0, 1, '/images/paneer.svg'],
            ['eggs', 'Country Eggs', 'Country eggs packed in a half dozen.', '22222222-2222-4222-8222-222222222002', '33333333-3333-4333-8333-333333333004', 1, 1, 0, 0, 1, '/images/eggs.svg'],
            ['palak', 'Palak', 'Leafy palak bunched for the same-day basket.', '22222222-2222-4222-8222-222222222003', '33333333-3333-4333-8333-333333333005', 0, 1, 0, 0, 1, '/images/palak.svg'],
            ['mango', 'Seasonal Mango', 'Seasonal mangoes weighed by the kilogram.', '22222222-2222-4222-8222-222222222004', '33333333-3333-4333-8333-333333333006', 0, 0, 1, 0, 1, '/images/mango.svg'],
            ['honey', 'Wild Honey', 'Raw honey in a 250 g jar.', '22222222-2222-4222-8222-222222222005', '33333333-3333-4333-8333-333333333007', 0, 0, 1, 0, 1, '/images/honey.svg'],
        ];
        $variants = [
            ['44444444-4444-4444-8444-444444444001', 'cow-milk', '11111111-1111-4111-8111-111111111005', '', 75, 68, 48, 1],
            ['44444444-4444-4444-8444-444444444002', 'cow-milk', '11111111-1111-4111-8111-111111111004', '', 42, 38, 36, 0],
            ['44444444-4444-4444-8444-444444444003', 'buffalo-milk', '11111111-1111-4111-8111-111111111005', '', 90, 80, 30, 1],
            ['44444444-4444-4444-8444-444444444004', 'curd', '11111111-1111-4111-8111-111111111002', '', 52, 45, 24, 1],
            ['44444444-4444-4444-8444-444444444005', 'paneer', '11111111-1111-4111-8111-111111111009', '', 110, 95, 16, 1],
            ['44444444-4444-4444-8444-444444444006', 'eggs', '11111111-1111-4111-8111-111111111010', '', 110, 90, 20, 1],
            ['44444444-4444-4444-8444-444444444007', 'palak', '11111111-1111-4111-8111-111111111001', '', 36, 30, 18, 1],
            ['44444444-4444-4444-8444-444444444008', 'mango', '11111111-1111-4111-8111-111111111003', '', 140, 120, 12, 1],
            ['44444444-4444-4444-8444-444444444009', 'honey', '11111111-1111-4111-8111-111111111001', '', 210, 180, 10, 1],
        ];

        $pdo->beginTransaction();
        try {
            $unit = $pdo->prepare('INSERT INTO units (id, name, sort_order, active, created_at) VALUES (?, ?, ?, 1, ?)');
            foreach ($units as $index => $row) {
                $unit->execute([$row[0], $row[1], $index + 1, $now]);
            }
            $hasParent = $pdo->query("SHOW COLUMNS FROM categories LIKE 'parent_id'")->fetch() !== false;
            $categorySql = $hasParent
                ? 'INSERT INTO categories (id, parent_id, name, slug, image, sort_order, active, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, 1, ?, ?)'
                : 'INSERT INTO categories (id, name, slug, sort_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)';
            $category = $pdo->prepare($categorySql);
            foreach ($categories as $index => $row) {
                if ($hasParent) {
                    $category->execute([$row[0], $row[1], $row[2], '', $index + 1, $now, $now]);
                } else {
                    $category->execute([$row[0], $row[1], $row[2], $index + 1, $now, $now]);
                }
            }
            $subcategory = $pdo->prepare(
                'INSERT INTO subcategories (id, category_id, name, slug, sort_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
            );
            $subOrder = [];
            foreach ($subs as $row) {
                $subOrder[$row[1]] = ($subOrder[$row[1]] ?? 0) + 1;
                $subcategory->execute([$row[0], $row[1], $row[2], $row[3], $subOrder[$row[1]], $now, $now]);
            }
            $product = $pdo->prepare(
                'INSERT INTO products (
                    id, name, description, category_id, subcategory_id, featured, popular, bestseller,
                    subscription_eligible, quick_delivery_eligible, active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
            );
            $image = $pdo->prepare('INSERT INTO product_images (id, product_id, url, sort_order) VALUES (?, ?, ?, 0)');
            foreach ($products as $row) {
                $product->execute([$row[0], $row[1], $row[2], $row[3], $row[4], $row[5], $row[6], $row[7], $row[8], $row[9], $now, $now]);
                $image->execute([Support::uuid(), $row[0], $row[10]]);
            }
            $variant = $pdo->prepare(
                'INSERT INTO product_variants (
                    id, product_id, unit_id, label, mrp, selling_price, stock, available, active, is_default, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)',
            );
            $order = [];
            foreach ($variants as $row) {
                $order[$row[1]] = ($order[$row[1]] ?? 0);
                $variant->execute([$row[0], $row[1], $row[2], $row[3], $row[4], $row[5], $row[6], $row[7], $order[$row[1]]]);
                $order[$row[1]]++;
            }
            $pdo->commit();
            self::markSeeded();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    /** @return list<array<string, mixed>> */
    private static function unitList(bool $activeOnly): array
    {
        $sql = 'SELECT * FROM units' . ($activeOnly ? ' WHERE active = 1' : '') . ' ORDER BY sort_order, name';
        $units = [];
        foreach (self::rows($sql) as $row) {
            $units[] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'active' => (int) $row['active'] === 1,
            ];
        }

        return $units;
    }

    /** @return list<array<string, mixed>> */
    private static function categoryTree(bool $activeOnly): array
    {
        $categories = [];
        $sql = 'SELECT * FROM categories' . ($activeOnly ? ' WHERE active = 1' : '') . ' ORDER BY sort_order, name';
        foreach (self::rows($sql) as $row) {
            $categories[$row['id']] = [
                'id' => $row['id'],
                'parentId' => !empty($row['parent_id']) ? (string) $row['parent_id'] : '',
                'name' => $row['name'],
                'slug' => $row['slug'],
                'image' => (string) ($row['image'] ?? ''),
                'active' => (int) $row['active'] === 1,
                'subcategories' => [],
            ];
        }
        $subSql = 'SELECT * FROM subcategories' . ($activeOnly ? ' WHERE active = 1' : '') . ' ORDER BY sort_order, name';
        foreach (self::rows($subSql) as $row) {
            if (!isset($categories[$row['category_id']])) {
                continue;
            }
            $categories[$row['category_id']]['subcategories'][] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'slug' => $row['slug'],
                'active' => (int) $row['active'] === 1,
            ];
        }

        return array_values($categories);
    }

    /** @return list<array<string, mixed>> */
    private static function productList(bool $includeInactive): array
    {
        $sql = 'SELECT p.*, c.name AS category_name, c.active AS category_active,
                    s.name AS subcategory_name, s.active AS subcategory_active
             FROM products p
             INNER JOIN categories c ON c.id = p.category_id
             LEFT JOIN subcategories s ON s.id = p.subcategory_id';
        if (!$includeInactive) {
            $sql .= ' WHERE p.active = 1 AND c.active = 1';
        }
        $sql .= ' ORDER BY p.featured DESC, p.name';
        $products = [];
        foreach (self::rows($sql) as $row) {
            if (!$includeInactive && $row['subcategory_id'] !== null && (int) $row['subcategory_active'] !== 1) {
                $row['subcategory_name'] = null;
                $row['subcategory_id'] = null;
            }
            $products[$row['id']] = self::presentProduct($row);
        }
        if ($products === []) {
            return [];
        }
        $ids = array_keys($products);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        foreach (self::rows("SELECT * FROM product_images WHERE product_id IN ({$placeholders}) ORDER BY sort_order", $ids) as $row) {
            $products[$row['product_id']]['images'][] = $row['url'];
        }
        $variantSql = "SELECT v.*, u.name AS unit_name FROM product_variants v
            INNER JOIN units u ON u.id = v.unit_id
            WHERE v.product_id IN ({$placeholders})";
        if (!$includeInactive) {
            $variantSql .= ' AND v.active = 1';
        }
        $variantSql .= ' ORDER BY v.sort_order, u.name';
        foreach (self::rows($variantSql, $ids) as $row) {
            $products[$row['product_id']]['variants'][] = self::presentVariant($row);
        }
        $visible = [];
        foreach ($products as $product) {
            if ($product['variants'] === []) {
                continue;
            }
            $default = null;
            foreach ($product['variants'] as $variant) {
                if ($variant['isDefault']) {
                    $default = $variant;
                    break;
                }
            }
            $default ??= $product['variants'][0];
            $product['variants'] = array_map(static function (array $variant) use ($default): array {
                $variant['isDefault'] = $variant['id'] === $default['id'];

                return $variant;
            }, $product['variants']);
            $product['image'] = $product['images'][0] ?? '';
            $product['unit'] = $default['label'] !== '' ? $default['label'] : $default['unit'];
            $product['mrp'] = $default['mrp'];
            $product['price'] = $default['sellingPrice'];
            $product['discount'] = $default['discount'];
            $product['discountPercent'] = $default['discountPercent'];
            $product['stock'] = $default['stock'];
            $product['available'] = $default['available'];
            $product['variantId'] = $default['id'];
            $visible[] = $product;
        }

        return $visible;
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private static function presentProduct(array $row): array
    {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'categoryId' => $row['category_id'],
            'category' => $row['category_name'],
            'subcategoryId' => $row['subcategory_id'] ?? '',
            'subcategory' => $row['subcategory_name'] ?? '',
            'images' => [],
            'image' => '',
            'variants' => [],
            'featured' => (int) $row['featured'] === 1,
            'popular' => (int) $row['popular'] === 1,
            'bestseller' => (int) $row['bestseller'] === 1,
            'subscription' => (int) $row['subscription_eligible'] === 1,
            'quickDelivery' => (int) $row['quick_delivery_eligible'] === 1,
            'active' => (int) $row['active'] === 1,
        ];
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private static function presentVariant(array $row): array
    {
        $mrp = self::rupees($row['mrp']);
        $selling = self::rupees($row['selling_price']);
        $discount = self::rupees(max(0, $mrp - $selling));

        return [
            'id' => $row['id'],
            'unitId' => $row['unit_id'],
            'unit' => $row['unit_name'],
            'label' => $row['label'],
            'mrp' => $mrp,
            'sellingPrice' => $selling,
            'discount' => $discount,
            'discountPercent' => $mrp > 0 ? (int) round(($discount / $mrp) * 100) : 0,
            'stock' => (int) $row['stock'],
            'available' => (int) $row['available'] === 1,
            'active' => (int) $row['active'] === 1,
            'isDefault' => (int) $row['is_default'] === 1,
        ];
    }

    private static function imagePath(mixed $value): string
    {
        $url = trim((string) $value);
        if ($url === '') {
            return '';
        }
        if (preg_match('#^/images/[A-Za-z0-9._/-]+$#', $url) !== 1 && preg_match('#^https://\S{1,240}$#', $url) !== 1) {
            throw new InvalidArgumentException('Use an image path starting with /images/ or an https link.');
        }

        return $url;
    }

    /** @param list<mixed>|mixed $value @return list<string> */
    private static function images(mixed $value): array
    {
        $lines = is_array($value) ? $value : preg_split('/\r\n|\r|\n/', (string) $value);
        $images = [];
        foreach ($lines ?: [] as $line) {
            $url = trim((string) $line);
            if ($url === '') {
                continue;
            }
            if (preg_match('#^/images/[A-Za-z0-9._/-]+$#', $url) !== 1 && preg_match('#^https://\S{1,240}$#', $url) !== 1) {
                throw new InvalidArgumentException('Use an image path starting with /images/ or an https link.');
            }
            $images[] = $url;
        }
        if ($images === []) {
            throw new InvalidArgumentException('Add at least one product image.');
        }
        if (count($images) > 6) {
            throw new InvalidArgumentException('A product can have up to 6 images.');
        }

        return $images;
    }

    /**
     * @param mixed $value
     * @return list<array{id: string, unitId: string, label: string, mrp: int|float, sellingPrice: int|float, stock: int, available: int, active: int, isDefault: int}>
     */
    private static function variants(mixed $value): array
    {
        if (!is_array($value) || $value === []) {
            throw new InvalidArgumentException('Add at least one variant.');
        }
        if (count($value) > 12) {
            throw new InvalidArgumentException('A product can have up to 12 variants.');
        }
        $variants = [];
        $defaultIndex = null;
        foreach ($value as $index => $entry) {
            if (!is_array($entry)) {
                throw new InvalidArgumentException('Check the variant details.');
            }
            $unitId = trim((string) ($entry['unitId'] ?? ''));
            $unit = self::row('SELECT active FROM units WHERE id = ?', [$unitId]);
            if ($unit === null) {
                throw new InvalidArgumentException('Choose a unit for each variant.');
            }
            $label = trim((string) ($entry['label'] ?? ''));
            if (strlen($label) > 80) {
                throw new InvalidArgumentException('A variant label can be up to 80 characters.');
            }
            $mrp = self::price($entry['mrp'] ?? null, 'Enter the MRP.');
            $selling = self::price($entry['sellingPrice'] ?? null, 'Enter the selling price.');
            if ($selling > $mrp) {
                throw new InvalidArgumentException('The selling price cannot be higher than the MRP.');
            }
            $stock = $entry['stock'] ?? 0;
            if (!is_numeric($stock) || (int) $stock < 0 || (int) $stock > 100000 || (string) (int) $stock !== (string) (0 + $stock)) {
                throw new InvalidArgumentException('Enter stock as a whole number.');
            }
            if (self::flag($entry['isDefault'] ?? false) === 1 && $defaultIndex === null) {
                $defaultIndex = $index;
            }
            $variants[] = [
                'id' => trim((string) ($entry['id'] ?? '')),
                'unitId' => $unitId,
                'label' => $label,
                'mrp' => $mrp,
                'sellingPrice' => $selling,
                'stock' => (int) $stock,
                'available' => self::flag($entry['available'] ?? true),
                'active' => self::flag($entry['active'] ?? true),
                'isDefault' => 0,
            ];
        }
        $defaultIndex ??= 0;
        $variants[$defaultIndex]['isDefault'] = 1;

        return $variants;
    }

    private static function price(mixed $value, string $message): int|float
    {
        if (!is_numeric($value)) {
            throw new InvalidArgumentException($message);
        }
        $number = round((float) $value, 2);
        if ($number < 1 || $number > 100000) {
            throw new InvalidArgumentException($message);
        }

        return self::rupees($number);
    }

    private static function rupees(mixed $value): int|float
    {
        $number = round((float) $value, 2);

        return abs($number - round($number)) < 0.001 ? (int) round($number) : $number;
    }

    private static function productIsVisible(string $id): bool
    {
        return self::count(
            'SELECT COUNT(*) FROM products p
             INNER JOIN categories c ON c.id = p.category_id
             WHERE p.id = ? AND p.active = 1 AND c.active = 1',
            [$id],
        ) === 1;
    }

    private static function variantBelongs(string $variantId, string $productId): bool
    {
        return self::count('SELECT COUNT(*) FROM product_variants WHERE id = ? AND product_id = ?', [$variantId, $productId]) === 1;
    }

    private static function requiredText(mixed $value, int $max, string $message): string
    {
        $text = trim((string) $value);
        if ($text === '' || strlen($text) > $max) {
            throw new InvalidArgumentException($message);
        }

        return $text;
    }

    private static function flag(mixed $value): int
    {
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (is_int($value) || is_float($value)) {
            return (int) $value === 1 ? 1 : 0;
        }
        if (is_string($value)) {
            return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
        }

        return 0;
    }

    private static function slug(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        return $slug === '' ? 'item' : substr($slug, 0, 40);
    }

    private static function uniqueSlug(string $table, string $slug, string $scopeColumn = '', string $scopeId = '', string $ignoreId = ''): string
    {
        $base = $slug;
        $number = 2;
        while (self::slugTaken($table, $slug, $scopeColumn, $scopeId, $ignoreId)) {
            $slug = substr($base, 0, 36) . '-' . $number;
            $number++;
        }

        return $slug;
    }

    private static function slugTaken(string $table, string $slug, string $scopeColumn, string $scopeId, string $ignoreId): bool
    {
        $sql = "SELECT COUNT(*) FROM {$table} WHERE slug = ?";
        $params = [$slug];
        if ($scopeColumn !== '') {
            $sql .= " AND {$scopeColumn} = ?";
            $params[] = $scopeId;
        }
        if ($ignoreId !== '') {
            $sql .= ' AND id <> ?';
            $params[] = $ignoreId;
        }

        return self::count($sql, $params) > 0;
    }

    private static function uniqueProductId(string $name): string
    {
        $base = self::slug($name);
        $id = $base;
        $number = 2;
        while (self::exists('products', $id)) {
            $id = substr($base, 0, 36) . '-' . $number;
            $number++;
        }

        return $id;
    }

    private static function exists(string $table, string $id): bool
    {
        if ($id === '' || !in_array($table, ['units', 'categories', 'subcategories', 'products'], true)) {
            return false;
        }

        return self::count("SELECT COUNT(*) FROM {$table} WHERE id = ?", [$id]) === 1;
    }

    /** @param list<mixed> $params */
    private static function count(string $sql, array $params = []): int
    {
        $statement = Connection::pdo()->prepare($sql);
        $statement->execute($params);

        return (int) $statement->fetchColumn();
    }

    /** @param list<mixed> $params @return array<string, mixed>|null */
    private static function row(string $sql, array $params = []): ?array
    {
        $rows = self::rows($sql, $params);

        return $rows[0] ?? null;
    }

    /** @param list<mixed> $params @return list<array<string, mixed>> */
    private static function rows(string $sql, array $params = []): array
    {
        $statement = Connection::pdo()->prepare($sql);
        $statement->execute($params);
        $rows = $statement->fetchAll();

        return is_array($rows) ? $rows : [];
    }

    private static function write(callable $callback): void
    {
        try {
            $callback();
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new InvalidArgumentException('That name is already used.');
            }
            throw $exception;
        }
    }
}
