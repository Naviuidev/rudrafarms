<?php

declare(strict_types=1);

namespace App\Subscription;

use App\Auth\Schema as AuthSchema;
use App\Catalog\Catalog;
use App\Database\Connection;
use App\Order\Schema as OrderSchema;

final class SubscriptionSchema
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

        $pdo = Connection::pdo();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subscription_plans (
                id CHAR(36) NOT NULL PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                description VARCHAR(500) NOT NULL DEFAULT "",
                plan_type VARCHAR(16) NOT NULL DEFAULT "fixed",
                items_json JSON NOT NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                sort_order SMALLINT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                KEY subscription_plans_active (active, sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subscriptions (
                id CHAR(36) NOT NULL PRIMARY KEY,
                customer_id CHAR(36) NOT NULL,
                plan_id CHAR(36) NULL,
                address_id CHAR(36) NOT NULL,
                schedule_key VARCHAR(16) NOT NULL DEFAULT "morning",
                status VARCHAR(24) NOT NULL DEFAULT "draft",
                start_date DATE NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                KEY subscriptions_customer (customer_id, status),
                KEY subscriptions_plan (plan_id),
                CONSTRAINT subscriptions_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
                CONSTRAINT subscriptions_plan_fk FOREIGN KEY (plan_id) REFERENCES subscription_plans (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subscription_lines (
                id CHAR(36) NOT NULL PRIMARY KEY,
                subscription_id CHAR(36) NOT NULL,
                product_id VARCHAR(40) NOT NULL,
                variant_id CHAR(36) NOT NULL,
                daily_qty SMALLINT NOT NULL DEFAULT 1,
                min_qty SMALLINT NOT NULL DEFAULT 1,
                max_qty SMALLINT NOT NULL DEFAULT 12,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                KEY subscription_lines_sub (subscription_id),
                CONSTRAINT subscription_lines_sub_fk FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE,
                CONSTRAINT subscription_lines_product_fk FOREIGN KEY (product_id) REFERENCES products (id),
                CONSTRAINT subscription_lines_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subscription_cycles (
                id CHAR(36) NOT NULL PRIMARY KEY,
                subscription_id CHAR(36) NOT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                billable_delivery_days SMALLINT NOT NULL DEFAULT 0,
                status VARCHAR(24) NOT NULL DEFAULT "pending_payment",
                amount_paise INT NOT NULL DEFAULT 0,
                razorpay_order_id VARCHAR(40) NOT NULL DEFAULT "",
                paid_at DATETIME NULL,
                renewal_reminder_sent_at DATETIME NULL,
                orders_order_id CHAR(36) NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                KEY subscription_cycles_sub (subscription_id, period_start),
                KEY subscription_cycles_status (status, period_end),
                UNIQUE KEY subscription_cycles_unique_period (subscription_id, period_start),
                CONSTRAINT subscription_cycles_sub_fk FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        self::migrateCycleOrderLink($pdo);
        self::migrateCancellationReason($pdo);

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subscription_pauses (
                id CHAR(36) NOT NULL PRIMARY KEY,
                subscription_id CHAR(36) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                note VARCHAR(240) NOT NULL DEFAULT "",
                created_at DATETIME NOT NULL,
                KEY subscription_pauses_sub (subscription_id, start_date),
                CONSTRAINT subscription_pauses_sub_fk FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subscription_skips (
                id CHAR(36) NOT NULL PRIMARY KEY,
                subscription_id CHAR(36) NOT NULL,
                delivery_date DATE NOT NULL,
                created_at DATETIME NOT NULL,
                UNIQUE KEY subscription_skips_unique (subscription_id, delivery_date),
                CONSTRAINT subscription_skips_sub_fk FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subscription_queries (
                id CHAR(36) NOT NULL PRIMARY KEY,
                subscription_id CHAR(36) NOT NULL,
                customer_id CHAR(36) NOT NULL,
                kind VARCHAR(24) NOT NULL DEFAULT "pause",
                message VARCHAR(500) NOT NULL,
                created_at DATETIME NOT NULL,
                KEY subscription_queries_sub (subscription_id, created_at),
                CONSTRAINT subscription_queries_sub_fk FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS subscription_deliveries (
                id CHAR(36) NOT NULL PRIMARY KEY,
                subscription_id CHAR(36) NOT NULL,
                cycle_id CHAR(36) NOT NULL,
                delivery_date DATE NOT NULL,
                status VARCHAR(24) NOT NULL DEFAULT "scheduled",
                created_at DATETIME NOT NULL,
                UNIQUE KEY subscription_deliveries_unique (subscription_id, delivery_date),
                KEY subscription_deliveries_cycle (cycle_id, delivery_date),
                CONSTRAINT subscription_deliveries_sub_fk FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE,
                CONSTRAINT subscription_deliveries_cycle_fk FOREIGN KEY (cycle_id) REFERENCES subscription_cycles (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        self::seedDefaultPlans($pdo);
        self::$ready = true;
    }

    private static function migrateCancellationReason(\PDO $pdo): void
    {
        $columns = $pdo->query("SHOW COLUMNS FROM subscriptions LIKE 'cancellation_reason'")->fetch();
        if ($columns !== false) {
            return;
        }
        $pdo->exec(
            'ALTER TABLE subscriptions ADD COLUMN cancellation_reason VARCHAR(160) NOT NULL DEFAULT "" AFTER status',
        );
    }

    private static function migrateCycleOrderLink(\PDO $pdo): void
    {
        $columns = $pdo->query("SHOW COLUMNS FROM subscription_cycles LIKE 'orders_order_id'")->fetch();
        if ($columns !== false) {
            return;
        }
        $pdo->exec(
            'ALTER TABLE subscription_cycles ADD COLUMN orders_order_id CHAR(36) NULL AFTER renewal_reminder_sent_at',
        );
    }

    private static function seedDefaultPlans(\PDO $pdo): void
    {
        $count = (int) $pdo->query('SELECT COUNT(*) FROM subscription_plans')->fetchColumn();
        if ($count > 0) {
            return;
        }

        $now = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d H:i:s');
        $plans = [
            [
                'id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
                'name' => 'Daily Cow Milk',
                'description' => '1 litre cow milk each delivery day.',
                'type' => 'fixed',
                'items' => [['productId' => 'cow-milk', 'variantId' => '44444444-4444-4444-8444-444444444001', 'qty' => 1, 'minQty' => 1, 'maxQty' => 4]],
            ],
        ];

        $stmt = $pdo->prepare(
            'INSERT INTO subscription_plans (id, name, description, plan_type, items_json, active, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
        );
        foreach ($plans as $index => $plan) {
            $stmt->execute([
                $plan['id'],
                $plan['name'],
                $plan['description'],
                $plan['type'],
                json_encode($plan['items'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                $index,
                $now,
                $now,
            ]);
        }
    }
}
