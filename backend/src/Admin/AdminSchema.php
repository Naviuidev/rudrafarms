<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Schema as AuthSchema;
use App\Catalog\Catalog;
use App\Database\Connection;
use App\Order\Schema as OrderSchema;
use App\Subscription\SubscriptionSchema;

final class AdminSchema
{
    private static bool $ready = false;

    public static function ensure(): void
    {
        if (self::$ready) {
            return;
        }

        AuthSchema::ensure();
        Catalog::ensure();
        OrderSchema::ensure();
        SubscriptionSchema::ensure();

        $pdo = Connection::pdo();

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS coupons (
                id CHAR(36) NOT NULL PRIMARY KEY,
                code VARCHAR(32) NOT NULL,
                discount_type VARCHAR(16) NOT NULL,
                discount_value INT NOT NULL,
                max_discount INT NOT NULL DEFAULT 0,
                minimum_order INT NOT NULL DEFAULT 0,
                usage_limit_total INT NULL,
                usage_limit_per_customer INT NULL,
                allow_quick TINYINT(1) NOT NULL DEFAULT 1,
                allow_subscription TINYINT(1) NOT NULL DEFAULT 1,
                active TINYINT(1) NOT NULL DEFAULT 1,
                starts_at DATE NULL,
                ends_at DATE NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY coupons_code (code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS coupon_redemptions (
                id CHAR(36) NOT NULL PRIMARY KEY,
                coupon_id CHAR(36) NOT NULL,
                customer_id CHAR(36) NOT NULL,
                order_id CHAR(36) NULL,
                amount_saved INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                KEY coupon_redemptions_coupon (coupon_id),
                KEY coupon_redemptions_customer (customer_id, coupon_id),
                CONSTRAINT coupon_redemptions_coupon_fk FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE,
                CONSTRAINT coupon_redemptions_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
                CONSTRAINT coupon_redemptions_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS stock_movements (
                id CHAR(36) NOT NULL PRIMARY KEY,
                variant_id CHAR(36) NOT NULL,
                delta INT NOT NULL,
                reason VARCHAR(120) NOT NULL DEFAULT "",
                reference VARCHAR(80) NOT NULL DEFAULT "",
                created_at DATETIME NOT NULL,
                KEY stock_movements_variant (variant_id, created_at),
                CONSTRAINT stock_movements_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS delivery_personnel (
                id CHAR(36) NOT NULL PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                phone VARCHAR(20) NOT NULL DEFAULT "",
                address VARCHAR(240) NOT NULL DEFAULT "",
                vehicle VARCHAR(120) NOT NULL DEFAULT "",
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS delivery_assignments (
                id CHAR(36) NOT NULL PRIMARY KEY,
                personnel_id CHAR(36) NULL,
                order_id CHAR(36) NULL,
                subscription_delivery_id CHAR(36) NULL,
                status VARCHAR(24) NOT NULL DEFAULT "pending_assignment",
                notes VARCHAR(500) NOT NULL DEFAULT "",
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                KEY delivery_assignments_personnel (personnel_id, status),
                KEY delivery_assignments_order (order_id),
                CONSTRAINT delivery_assignments_personnel_fk FOREIGN KEY (personnel_id) REFERENCES delivery_personnel (id) ON DELETE CASCADE,
                CONSTRAINT delivery_assignments_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        self::migrateAssignmentSubscriptionColumn($pdo);
        self::migrateDeliveryPersonnelNullable($pdo);

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS delivery_status_history (
                id CHAR(36) NOT NULL PRIMARY KEY,
                assignment_id CHAR(36) NOT NULL,
                status VARCHAR(24) NOT NULL,
                notes VARCHAR(500) NOT NULL DEFAULT "",
                failure_reason VARCHAR(240) NOT NULL DEFAULT "",
                proof_ref VARCHAR(240) NOT NULL DEFAULT "",
                updated_by VARCHAR(80) NOT NULL DEFAULT "admin",
                created_at DATETIME NOT NULL,
                KEY delivery_status_history_assignment (assignment_id, created_at),
                CONSTRAINT delivery_status_history_assign_fk FOREIGN KEY (assignment_id) REFERENCES delivery_assignments (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        self::$ready = true;
    }

    private static function migrateAssignmentSubscriptionColumn(\PDO $pdo): void
    {
        $col = $pdo->query("SHOW COLUMNS FROM delivery_assignments LIKE 'subscription_delivery_id'")->fetch();
        if ($col !== false) {
            return;
        }
        try {
            $pdo->exec(
                'ALTER TABLE delivery_assignments ADD COLUMN subscription_delivery_id CHAR(36) NULL AFTER order_id',
            );
        } catch (\Throwable) {
            // ignore if table missing
        }
        try {
            $pdo->exec(
                'ALTER TABLE delivery_assignments
                 ADD CONSTRAINT delivery_assignments_subdel_fk FOREIGN KEY (subscription_delivery_id) REFERENCES subscription_deliveries (id) ON DELETE CASCADE',
            );
        } catch (\Throwable) {
            // duplicate or order issues
        }
    }

    private static function migrateDeliveryPersonnelNullable(\PDO $pdo): void
    {
        try {
            $row = $pdo->query(
                "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_assignments' AND COLUMN_NAME = 'personnel_id'",
            )->fetch(PDO::FETCH_ASSOC);
            if (is_array($row) && ($row['IS_NULLABLE'] ?? '') === 'NO') {
                $pdo->exec('ALTER TABLE delivery_assignments MODIFY personnel_id CHAR(36) NULL');
            }
        } catch (\Throwable) {
            // table may not exist yet
        }
    }
}
