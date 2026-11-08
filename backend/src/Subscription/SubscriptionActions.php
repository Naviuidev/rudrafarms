<?php

declare(strict_types=1);

namespace App\Subscription;

use App\Auth\Support;
use App\Database\Connection;

final class SubscriptionActions
{
    /** @param array<string, mixed> $customer */
    public static function pause(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        $customerId = (string) $customer['id'];
        $subscriptionId = trim((string) ($input['subscriptionId'] ?? ''));
        $start = trim((string) ($input['startDate'] ?? ''));
        $end = trim((string) ($input['endDate'] ?? ''));
        if ($subscriptionId === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            throw new SubscriptionException('Choose valid pause dates.');
        }
        if ($start > $end) {
            throw new SubscriptionException('Pause start must be before the end date.');
        }

        $sub = SubscriptionCheckout::subscriptionRow($customerId, $subscriptionId);
        if ($sub === null) {
            throw new SubscriptionException('Subscription not found.', 404);
        }
        if ((string) $sub['status'] === 'cancelled') {
            throw new SubscriptionException('This subscription is cancelled.');
        }

        $pdo = Connection::pdo();
        $pdo->prepare(
            'INSERT INTO subscription_pauses (id, subscription_id, start_date, end_date, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?)',
        )->execute([
            Support::uuid(),
            $subscriptionId,
            $start,
            $end,
            trim((string) ($input['note'] ?? '')),
            Support::now(),
        ]);

        $pdo->prepare(
            'UPDATE subscriptions SET status = "paused", updated_at = ? WHERE id = ?',
        )->execute([Support::now(), $subscriptionId]);

        return SubscriptionService::detailForCustomer($customerId, $subscriptionId);
    }

    /** @param array<string, mixed> $customer */
    public static function resume(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        $customerId = (string) $customer['id'];
        $subscriptionId = trim((string) ($input['subscriptionId'] ?? ''));
        if ($subscriptionId === '') {
            throw new SubscriptionException('Choose a subscription.');
        }

        $sub = SubscriptionCheckout::subscriptionRow($customerId, $subscriptionId);
        if ($sub === null) {
            throw new SubscriptionException('Subscription not found.', 404);
        }

        $pdo = Connection::pdo();
        $pdo->prepare(
            'UPDATE subscriptions SET status = "active", updated_at = ? WHERE id = ?',
        )->execute([Support::now(), $subscriptionId]);

        return SubscriptionService::detailForCustomer($customerId, $subscriptionId);
    }

    /** @param array<string, mixed> $customer */
    public static function skipDelivery(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        $customerId = (string) $customer['id'];
        $subscriptionId = trim((string) ($input['subscriptionId'] ?? ''));
        $date = trim((string) ($input['deliveryDate'] ?? ''));
        if ($subscriptionId === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new SubscriptionException('Choose a delivery date to skip.');
        }

        $sub = SubscriptionCheckout::subscriptionRow($customerId, $subscriptionId);
        if ($sub === null) {
            throw new SubscriptionException('Subscription not found.', 404);
        }

        $pdo = Connection::pdo();
        try {
            $pdo->prepare(
                'INSERT INTO subscription_skips (id, subscription_id, delivery_date, created_at)
                 VALUES (?, ?, ?, ?)',
            )->execute([Support::uuid(), $subscriptionId, $date, Support::now()]);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000') {
                throw new SubscriptionException('That date is already skipped.');
            }
            throw $e;
        }

        $cycle = $pdo->prepare(
            'SELECT id FROM subscription_cycles WHERE subscription_id = ? AND status = "paid_active" AND ? BETWEEN period_start AND period_end LIMIT 1',
        );
        $cycle->execute([$subscriptionId, $date]);
        $cycleId = $cycle->fetchColumn();
        if (is_string($cycleId) && $cycleId !== '') {
            SubscriptionDeliveryGenerator::syncCycleDeliveries($cycleId);
        }

        return SubscriptionService::detailForCustomer($customerId, $subscriptionId);
    }

    /** @param array<string, mixed> $customer */
    public static function withdrawSkip(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        $customerId = (string) $customer['id'];
        $subscriptionId = trim((string) ($input['subscriptionId'] ?? ''));
        $date = trim((string) ($input['deliveryDate'] ?? ''));
        if ($subscriptionId === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new SubscriptionException('Choose a skipped date to withdraw.');
        }

        $sub = SubscriptionCheckout::subscriptionRow($customerId, $subscriptionId);
        if ($sub === null) {
            throw new SubscriptionException('Subscription not found.', 404);
        }

        self::assertWithdrawOpen((string) ($sub['schedule_key'] ?? ''), $date);

        $pdo = Connection::pdo();
        $deleted = $pdo->prepare(
            'DELETE FROM subscription_skips WHERE subscription_id = ? AND delivery_date = ?',
        );
        $deleted->execute([$subscriptionId, $date]);
        if ($deleted->rowCount() === 0) {
            throw new SubscriptionException('That date is not skipped.');
        }

        $cycle = $pdo->prepare(
            'SELECT id FROM subscription_cycles WHERE subscription_id = ? AND status = "paid_active" AND ? BETWEEN period_start AND period_end LIMIT 1',
        );
        $cycle->execute([$subscriptionId, $date]);
        $cycleId = $cycle->fetchColumn();
        if (is_string($cycleId) && $cycleId !== '') {
            $day = new \DateTimeImmutable($date, new \DateTimeZone('Asia/Kolkata'));
            $paused = SubscriptionQuote::inPause($day, SubscriptionService::pausesForSubscription($subscriptionId));
            if (!$paused) {
                try {
                    $pdo->prepare(
                        'INSERT INTO subscription_deliveries (id, subscription_id, cycle_id, delivery_date, status, created_at)
                         VALUES (?, ?, ?, ?, "scheduled", ?)',
                    )->execute([Support::uuid(), $subscriptionId, $cycleId, $date, Support::now()]);
                } catch (\PDOException $e) {
                    if ($e->getCode() !== '23000') {
                        throw $e;
                    }
                }
            }
        }

        return SubscriptionService::detailForCustomer($customerId, $subscriptionId);
    }

    /** @param array<string, mixed> $customer */
    public static function pauseQuery(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        $customerId = (string) $customer['id'];
        $subscriptionId = trim((string) ($input['subscriptionId'] ?? ''));
        $message = trim((string) ($input['message'] ?? ''));
        if ($subscriptionId === '') {
            throw new SubscriptionException('Choose a subscription.');
        }
        if (mb_strlen($message) < 10) {
            throw new SubscriptionException('Write a short message for the farm.');
        }
        if (mb_strlen($message) > 500) {
            throw new SubscriptionException('Keep the message under 500 characters.');
        }

        $sub = SubscriptionCheckout::subscriptionRow($customerId, $subscriptionId);
        if ($sub === null) {
            throw new SubscriptionException('Subscription not found.', 404);
        }

        Connection::pdo()->prepare(
            'INSERT INTO subscription_queries (id, subscription_id, customer_id, kind, message, created_at)
             VALUES (?, ?, ?, "pause", ?, ?)',
        )->execute([Support::uuid(), $subscriptionId, $customerId, $message, Support::now()]);

        return ['ok' => true];
    }

    private static function assertWithdrawOpen(string $scheduleKey, string $date): void
    {
        $clock = [
            'morning' => '07:00:00',
            'evening' => '16:00:00',
            'both' => '07:00:00',
        ];
        $time = $clock[$scheduleKey] ?? '07:00:00';
        $zone = new \DateTimeZone('Asia/Kolkata');
        $delivery = new \DateTimeImmutable($date . ' ' . $time, $zone);
        $cutoff = $delivery->modify('-3 hours');
        $now = new \DateTimeImmutable('now', $zone);
        if ($now >= $cutoff) {
            throw new SubscriptionException('A skipped day can be withdrawn only until 3 hours before the delivery time.');
        }
    }

    /** @param array<string, mixed> $customer */
    public static function cancel(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        $customerId = (string) $customer['id'];
        $subscriptionId = trim((string) ($input['subscriptionId'] ?? ''));
        if ($subscriptionId === '') {
            throw new SubscriptionException('Choose a subscription.');
        }

        $sub = SubscriptionCheckout::subscriptionRow($customerId, $subscriptionId);
        if ($sub === null) {
            throw new SubscriptionException('Subscription not found.', 404);
        }

        $pdo = Connection::pdo();
        $pdo->prepare(
            'UPDATE subscriptions SET status = "cancelled", updated_at = ? WHERE id = ?',
        )->execute([Support::now(), $subscriptionId]);

        return SubscriptionService::detailForCustomer($customerId, $subscriptionId);
    }
}
