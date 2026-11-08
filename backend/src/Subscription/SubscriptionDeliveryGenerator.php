<?php

declare(strict_types=1);

namespace App\Subscription;

use App\Auth\Support;
use App\Database\Connection;
use PDO;

final class SubscriptionDeliveryGenerator
{
    public static function syncCycleDeliveries(string $cycleId): void
    {
        SubscriptionSchema::ensure();

        $pdo = Connection::pdo();
        $statement = $pdo->prepare(
            'SELECT c.*, s.schedule_key, s.id AS subscription_id
             FROM subscription_cycles c
             INNER JOIN subscriptions s ON s.id = c.subscription_id
             WHERE c.id = ? LIMIT 1',
        );
        $statement->execute([$cycleId]);
        $cycle = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($cycle) || (string) $cycle['status'] !== 'paid_active') {
            return;
        }

        $subscriptionId = (string) $cycle['subscription_id'];
        $pauses = SubscriptionService::pausesForSubscription($subscriptionId);
        $skips = SubscriptionService::skipsForSubscription($subscriptionId);

        $start = new \DateTimeImmutable((string) $cycle['period_start'], new \DateTimeZone('Asia/Kolkata'));
        $end = new \DateTimeImmutable((string) $cycle['period_end'], new \DateTimeZone('Asia/Kolkata'));

        $pdo->beginTransaction();
        try {
            $delete = $pdo->prepare(
                'DELETE FROM subscription_deliveries WHERE cycle_id = ?',
            );
            $delete->execute([$cycleId]);

            $insert = $pdo->prepare(
                'INSERT INTO subscription_deliveries (id, subscription_id, cycle_id, delivery_date, status, created_at)
                 VALUES (?, ?, ?, ?, "scheduled", ?)',
            );

            $cursor = $start;
            while ($cursor <= $end) {
                $key = $cursor->format('Y-m-d');
                if (in_array($key, $skips, true)) {
                    $cursor = $cursor->modify('+1 day');

                    continue;
                }
                if (SubscriptionQuote::inPause($cursor, $pauses)) {
                    $cursor = $cursor->modify('+1 day');

                    continue;
                }

                $id = Support::uuid();
                $now = Support::now();
                try {
                    $insert->execute([$id, $subscriptionId, $cycleId, $key, $now]);
                } catch (\PDOException $e) {
                    if ($e->getCode() !== '23000') {
                        throw $e;
                    }
                }
                $cursor = $cursor->modify('+1 day');
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /** Generate delivery rows for every active paid cycle up to period_end (idempotent). */
    public static function runScheduledJobs(): array
    {
        SubscriptionSchema::ensure();
        $pdo = Connection::pdo();
        $rows = $pdo->query(
            'SELECT id FROM subscription_cycles WHERE status = "paid_active"',
        )->fetchAll(PDO::FETCH_COLUMN);
        $synced = 0;
        foreach (is_array($rows) ? $rows : [] as $id) {
            self::syncCycleDeliveries((string) $id);
            $synced++;
        }

        return ['cyclesSynced' => $synced];
    }

    public static function sendRenewalReminders(): array
    {
        SubscriptionSchema::ensure();
        /** @var array{reminderDaysBefore: int} $cfg */
        $cfg = require dirname(__DIR__, 2) . '/config/subscription.php';
        $days = max(1, (int) ($cfg['reminderDaysBefore'] ?? 3));

        $tz = new \DateTimeZone('Asia/Kolkata');
        $today = new \DateTimeImmutable('now', $tz);
        $target = $today->modify('+' . $days . ' days')->format('Y-m-d');

        $pdo = Connection::pdo();
        $statement = $pdo->prepare(
            'SELECT c.id, c.subscription_id, c.period_end, s.customer_id, cu.email, cu.name
             FROM subscription_cycles c
             INNER JOIN subscriptions s ON s.id = c.subscription_id
             INNER JOIN customers cu ON cu.id = s.customer_id
             WHERE c.status = "paid_active" AND c.period_end = ?
               AND (c.renewal_reminder_sent_at IS NULL)',
        );
        $statement->execute([$target]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

        $sent = 0;
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $email = (string) $row['email'];
            $name = (string) $row['name'];
            $end = (string) $row['period_end'];
            $body = "Hi {$name},\n\nYour subscription billing period ends on {$end}. Renew manually in your account to keep daily deliveries.\n\n— RudrasFarmFresh";
            $ok = \App\Auth\Mail::send($email, $name, 'Renew your RudrasFarmFresh subscription', $body);
            if ($ok) {
                $pdo->prepare(
                    'UPDATE subscription_cycles SET renewal_reminder_sent_at = ? WHERE id = ?',
                )->execute([Support::now(), (string) $row['id']]);
                $sent++;
            }
        }

        return ['remindersSent' => $sent];
    }

    public static function expireSubscriptions(): array
    {
        SubscriptionSchema::ensure();
        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
        $pdo = Connection::pdo();

        $statement = $pdo->prepare(
            'SELECT s.id FROM subscriptions s
             WHERE s.status IN ("active", "pending_payment")
               AND NOT EXISTS (
                 SELECT 1 FROM subscription_cycles c
                 WHERE c.subscription_id = s.id AND c.status = "paid_active" AND c.period_end >= ?
               )',
        );
        $statement->execute([$today]);
        $ids = $statement->fetchAll(PDO::FETCH_COLUMN);
        $count = 0;
        foreach (is_array($ids) ? $ids : [] as $id) {
            $pdo->prepare(
                'UPDATE subscriptions SET status = "expired", updated_at = ? WHERE id = ?',
            )->execute([Support::now(), (string) $id]);
            $count++;
        }

        return ['expired' => $count];
    }
}
