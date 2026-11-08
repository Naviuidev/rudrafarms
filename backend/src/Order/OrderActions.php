<?php

declare(strict_types=1);

namespace App\Order;

use App\Auth\Support;
use App\Database\Connection;
use App\Subscription\SubscriptionCheckout;
use App\Subscription\SubscriptionException;
use App\Subscription\SubscriptionSchema;
use PDO;

final class OrderActions
{
    /** @param array<string, mixed> $customer */
    public static function requestCancellation(array $customer, string $orderId): array
    {
        Schema::ensure();
        $customerId = (string) $customer['id'];
        $orderId = trim($orderId);
        $row = Checkout::rowById($customerId, $orderId);
        if ($row === null) {
            throw new OrderException('That order was not found.', 404);
        }

        $status = (string) $row['status'];
        if (!in_array($status, ['pending_payment', 'confirmed', 'preparing', 'assigned', 'out_for_delivery'], true)) {
            throw new OrderException('This order cannot be cancelled from the account.');
        }

        $pdo = Connection::pdo();
        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        $hasExt = is_array($cols) && in_array('cancellation_requested', $cols, true);

        if ($hasExt) {
            $pdo->prepare(
                'UPDATE orders SET cancellation_requested = 1, updated_at = ? WHERE id = ? AND customer_id = ?',
            )->execute([Support::now(), $orderId, $customerId]);
        }

        $fresh = Checkout::rowById($customerId, $orderId);
        if ($fresh === null) {
            throw new OrderException('That order was not found.', 404);
        }

        return ['order' => Checkout::presentRow($fresh, true)];
    }

    /**
     * Stop a subscription from its billing order and keep the reason the customer picked.
     *
     * @param array<string, mixed> $customer
     * @return array{order: array<string, mixed>}
     */
    public static function cancelSubscription(array $customer, string $orderId, string $reasonKey): array
    {
        Schema::ensure();
        SubscriptionSchema::ensure();
        $reasons = [
            'away' => 'Going away',
            'price' => 'Too expensive',
            'timing' => 'Delivery time does not work',
            'quality' => 'Product quality',
            'mistake' => 'Ordered by mistake',
            'one-time' => 'Switching to one-time orders',
        ];
        $reasonKey = trim($reasonKey);
        if (!isset($reasons[$reasonKey])) {
            throw new OrderException('Choose a reason to cancel this subscription.');
        }
        $label = $reasons[$reasonKey];

        $customerId = (string) $customer['id'];
        $orderId = trim($orderId);
        $row = Checkout::rowById($customerId, $orderId);
        if ($row === null) {
            throw new OrderException('That order was not found.', 404);
        }

        $subscriptionId = trim((string) ($row['subscription_id'] ?? ''));
        if ($subscriptionId === '') {
            throw new OrderException('This order is not a subscription.');
        }
        if (in_array((string) $row['status'], ['cancelled', 'failed'], true)) {
            throw new OrderException('This order is already closed.');
        }

        try {
            $sub = SubscriptionCheckout::subscriptionRow($customerId, $subscriptionId);
        } catch (SubscriptionException $exception) {
            throw new OrderException($exception->getMessage(), $exception->status());
        }
        if ($sub === null) {
            throw new OrderException('Subscription not found.', 404);
        }
        if ((string) ($sub['status'] ?? '') === 'cancelled') {
            throw new OrderException('This subscription is already cancelled.');
        }

        $pdo = Connection::pdo();
        $now = Support::now();
        $paid = (string) ($row['payment_status'] ?? '') === 'paid' || !empty($row['paid_at']);
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'UPDATE subscriptions SET status = "cancelled", cancellation_reason = ?, updated_at = ? WHERE id = ? AND customer_id = ?',
            )->execute([$label, $now, $subscriptionId, $customerId]);
            $pdo->prepare(
                'UPDATE subscription_cycles SET status = "cancelled", updated_at = ? WHERE subscription_id = ? AND status = "pending_payment"',
            )->execute([$now, $subscriptionId]);
            $pdo->prepare(
                'UPDATE subscription_deliveries SET status = "cancelled" WHERE subscription_id = ? AND status = "scheduled"',
            )->execute([$subscriptionId]);

            if ($paid) {
                $pdo->prepare(
                    'UPDATE orders SET cancellation_requested = 1, cancellation_reason = ?, updated_at = ? WHERE id = ? AND customer_id = ?',
                )->execute([$label, $now, $orderId, $customerId]);
            } else {
                $pdo->prepare(
                    'UPDATE orders
                     SET status = "cancelled",
                         payment_status = "failed",
                         fulfillment_status = "cancelled",
                         cancellation_requested = 1,
                         cancellation_reason = ?,
                         updated_at = ?
                     WHERE id = ? AND customer_id = ?',
                )->execute([$label, $now, $orderId, $customerId]);
            }
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        $fresh = Checkout::rowById($customerId, $orderId);
        if ($fresh === null) {
            throw new OrderException('That order was not found.', 404);
        }

        return ['order' => Checkout::presentRow($fresh, true)];
    }

    /**
     * Build a cart-style payload from a past order for quick reorder (quick delivery only).
     *
     * @param array<string, mixed> $customer
     * @return array<string, mixed>
     */
    public static function reorderPayload(array $customer, string $orderId): array
    {
        Schema::ensure();
        $customerId = (string) $customer['id'];
        $orderId = trim($orderId);
        $row = Checkout::rowById($customerId, $orderId);
        if ($row === null) {
            throw new OrderException('That order was not found.', 404);
        }
        if ((string) $row['delivery_type'] !== 'quick') {
            throw new OrderException('Subscription renewals use the Subscriptions page.');
        }

        $pdo = Connection::pdo();
        $statement = $pdo->prepare(
            'SELECT product_id, variant_id, qty FROM order_items WHERE order_id = ?',
        );
        $statement->execute([$orderId]);
        $items = $statement->fetchAll(PDO::FETCH_ASSOC);
        $lines = [];
        foreach (is_array($items) ? $items : [] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $lines[] = [
                'productId' => (string) $item['product_id'],
                'variantId' => (string) $item['variant_id'],
                'qty' => max(1, (int) $item['qty']),
                'deliveryMode' => 'quick',
            ];
        }

        return [
            'addressId' => (string) $row['address_id'],
            'reorderOfOrderId' => $orderId,
            'items' => $lines,
        ];
    }

    /**
     * Place a new quick order as a copy of an existing paid quick order (server-side reorder).
     *
     * @param array<string, mixed> $customer
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public static function reorderPlace(array $customer, array $input): array
    {
        $payload = self::reorderPayload($customer, trim((string) ($input['orderId'] ?? '')));
        $merged = [
            'addressId' => $payload['addressId'],
            'deliveryType' => (string) ($input['deliveryType'] ?? 'standard'),
            'slotKey' => (string) ($input['slotKey'] ?? ''),
            'slotDate' => (string) ($input['slotDate'] ?? ''),
            'notes' => (string) ($input['notes'] ?? ''),
            'subscriptionSchedule' => '',
            'items' => $payload['items'],
            'coupon' => (string) ($input['coupon'] ?? ''),
            'reorderOfOrderId' => $payload['reorderOfOrderId'],
        ];

        return Checkout::place($customer, $merged);
    }
}
