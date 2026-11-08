<?php

declare(strict_types=1);

namespace App\Order;

use App\Auth\Schema as AuthSchema;
use App\Database\Connection;

final class Schema
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
            'CREATE TABLE IF NOT EXISTS orders (
                id CHAR(36) NOT NULL PRIMARY KEY,
                order_number VARCHAR(24) NOT NULL,
                customer_id CHAR(36) NOT NULL,
                status VARCHAR(24) NOT NULL,
                delivery_type VARCHAR(16) NOT NULL,
                slot_key VARCHAR(32) NOT NULL DEFAULT "",
                slot_label VARCHAR(80) NOT NULL DEFAULT "",
                slot_date DATE NULL,
                eta_minutes SMALLINT NOT NULL DEFAULT 0,
                address_id CHAR(36) NOT NULL,
                address_json JSON NOT NULL,
                coupon_code VARCHAR(32) NOT NULL DEFAULT "",
                subtotal INT NOT NULL,
                discount INT NOT NULL,
                delivery_fee INT NOT NULL,
                tax INT NOT NULL,
                payable INT NOT NULL,
                delivery_note VARCHAR(240) NOT NULL DEFAULT "",
                razorpay_order_id VARCHAR(40) NOT NULL DEFAULT "",
                razorpay_payment_id VARCHAR(40) NOT NULL DEFAULT "",
                paid_at DATETIME NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY orders_number (order_number),
                KEY orders_customer (customer_id, created_at),
                KEY orders_slot (slot_date, slot_key, status),
                CONSTRAINT orders_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS order_items (
                id CHAR(36) NOT NULL PRIMARY KEY,
                order_id CHAR(36) NOT NULL,
                product_id VARCHAR(40) NOT NULL,
                variant_id CHAR(36) NOT NULL,
                name VARCHAR(120) NOT NULL,
                unit VARCHAR(40) NOT NULL,
                qty INT NOT NULL,
                price INT NOT NULL,
                line_total INT NOT NULL,
                tax INT NOT NULL,
                KEY order_items_order (order_id),
                CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        );

        self::migrateColumns($pdo);

        self::$ready = true;
    }

    private static function migrateColumns(\PDO $pdo): void
    {
        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(\PDO::FETCH_COLUMN);
        if (!is_array($cols) || $cols === []) {
            return;
        }

        if (!in_array('payment_status', $cols, true)) {
            $pdo->exec(
                'ALTER TABLE orders
                    ADD COLUMN payment_status VARCHAR(24) NOT NULL DEFAULT "pending" AFTER status,
                    ADD COLUMN fulfillment_status VARCHAR(24) NOT NULL DEFAULT "pending" AFTER payment_status,
                    ADD COLUMN cancellation_requested TINYINT(1) NOT NULL DEFAULT 0 AFTER fulfillment_status,
                    ADD COLUMN refund_status VARCHAR(24) NOT NULL DEFAULT "" AFTER cancellation_requested,
                    ADD COLUMN reorder_of_order_id CHAR(36) NULL AFTER refund_status,
                    ADD COLUMN subscription_id CHAR(36) NULL AFTER reorder_of_order_id,
                    ADD COLUMN subscription_cycle_id CHAR(36) NULL AFTER subscription_id',
            );
            $pdo->exec(
                'UPDATE orders SET payment_status = CASE
                    WHEN status = "pending_payment" THEN "pending"
                    WHEN status IN ("cancelled", "failed") THEN "failed"
                    ELSE "paid"
                END',
            );
            $pdo->exec(
                'UPDATE orders SET fulfillment_status = CASE
                    WHEN status = "pending_payment" THEN "pending"
                    WHEN status = "confirmed" THEN "confirmed"
                    WHEN status = "preparing" THEN "processing"
                    WHEN status = "assigned" THEN "assigned"
                    WHEN status = "out_for_delivery" THEN "out_for_delivery"
                    WHEN status = "delivered" THEN "delivered"
                    WHEN status = "cancelled" THEN "cancelled"
                    WHEN status = "failed" THEN "failed"
                    WHEN status = "refund_initiated" THEN "cancelled"
                    WHEN status = "refunded" THEN "cancelled"
                    ELSE "pending"
                END',
            );
        }

        if (!in_array('coupon_id', $cols, true)) {
            try {
                $pdo->exec(
                    'ALTER TABLE orders ADD COLUMN coupon_id CHAR(36) NULL AFTER coupon_code',
                );
            } catch (\Throwable) {
                // ignore if concurrent migration
            }
        }

        $fresh = $pdo->query('SHOW COLUMNS FROM orders')->fetchAll(\PDO::FETCH_COLUMN);
        if (is_array($fresh) && !in_array('cancellation_reason', $fresh, true)) {
            try {
                $pdo->exec(
                    'ALTER TABLE orders ADD COLUMN cancellation_reason VARCHAR(160) NOT NULL DEFAULT "" AFTER cancellation_requested',
                );
            } catch (\Throwable) {
                // ignore if concurrent migration
            }
        }
    }
}
