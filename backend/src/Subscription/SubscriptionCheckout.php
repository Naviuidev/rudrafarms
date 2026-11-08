<?php

declare(strict_types=1);

namespace App\Subscription;

use App\Admin\CouponService;
use App\Auth\Addresses;
use App\Auth\Support;
use App\Database\Connection;
use App\Order\Checkout;
use App\Order\Schema as OrderSchema;
use App\Payment\RazorpayGateway;
use PDO;

final class SubscriptionCheckout
{
    /**
     * @param array<string, mixed> $customer
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public static function quote(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        $customerId = (string) $customer['id'];
        $addressId = trim((string) ($input['addressId'] ?? ''));
        $presented = Addresses::getForCustomer($customerId, $addressId);
        if ($presented === null) {
            throw new SubscriptionException('Choose a delivery address.');
        }
        SubscriptionService::assertServiceable($presented);

        $planId = trim((string) ($input['planId'] ?? ''));
        $planId = $planId === '' ? null : $planId;
        $rawLines = is_array($input['lines'] ?? null) ? $input['lines'] : [];
        $resolved = SubscriptionService::resolveLines($planId, $rawLines);
        $lines = $resolved['lines'];

        $schedule = self::scheduleByKey((string) ($input['scheduleKey'] ?? 'morning'));
        $scheduleKey = (string) $schedule['key'];

        $startDate = trim((string) ($input['startDate'] ?? ''));
        if ($startDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            throw new SubscriptionException('Choose a subscription start date.');
        }
        $tz = new \DateTimeZone('Asia/Kolkata');
        $start = new \DateTimeImmutable($startDate, $tz);
        $today = (new \DateTimeImmutable('now', $tz))->setTime(0, 0, 0);
        if ($start < $today) {
            throw new SubscriptionException('Start date cannot be in the past.');
        }

        $periodStart = $start;
        $periodEnd = SubscriptionQuote::endOfMonth($start);
        $billable = SubscriptionQuote::countBillableDays($periodStart, $periodEnd, [], []);

        $couponCode = trim((string) ($input['coupon'] ?? ''));
        $withCoupon = self::totalsWithCoupon($lines, $scheduleKey, $billable, $couponCode, $customerId);
        $totals = $withCoupon['totals'];
        $coupon = $withCoupon['coupon'];

        return [
            'planType' => $resolved['planType'],
            'scheduleKey' => $scheduleKey,
            'scheduleLabel' => (string) $schedule['label'],
            'periodStart' => $periodStart->format('Y-m-d'),
            'periodEnd' => $periodEnd->format('Y-m-d'),
            'billableDeliveryDays' => $billable,
            'lines' => $totals['lines'],
            'dailySubtotal' => $totals['dailySubtotal'],
            'dailyTax' => $totals['dailyTax'],
            'grossSubtotal' => (int) ($totals['grossSubtotal'] ?? $totals['subtotal'] + (int) ($totals['discount'] ?? 0)),
            'subtotal' => $totals['subtotal'],
            'discount' => (int) ($totals['discount'] ?? 0),
            'tax' => $totals['tax'],
            'payable' => $totals['payable'],
            'coupon' => [
                'code' => (string) ($coupon['code'] ?? ''),
                'applied' => (bool) ($coupon['applied'] ?? false),
                'message' => (string) ($coupon['message'] ?? ''),
                'couponId' => (string) ($coupon['couponId'] ?? ''),
            ],
            'amountPaise' => max(100, $totals['payable'] * 100),
        ];
    }

    /**
     * @param array<string, mixed> $customer
     * @param array<string, mixed> $input
     * @return array{subscription: array<string, mixed>, cycle: array<string, mixed>, order: array<string, mixed>, razorpay: array<string, mixed>}
     */
    public static function start(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        OrderSchema::ensure();

        $preview = self::quote($customer, $input);
        $customerId = (string) $customer['id'];
        $addressId = trim((string) ($input['addressId'] ?? ''));
        $presented = Addresses::getForCustomer($customerId, $addressId);
        if ($presented === null) {
            throw new SubscriptionException('Choose a delivery address.');
        }

        $planId = trim((string) ($input['planId'] ?? ''));
        $planId = $planId === '' ? null : $planId;
        $rawLines = is_array($input['lines'] ?? null) ? $input['lines'] : [];
        $resolved = SubscriptionService::resolveLines($planId, $rawLines);
        $lines = $resolved['lines'];

        $scheduleKey = $preview['scheduleKey'];
        $startDate = $preview['periodStart'];
        $periodStart = new \DateTimeImmutable($preview['periodStart'], new \DateTimeZone('Asia/Kolkata'));
        $periodEnd = new \DateTimeImmutable($preview['periodEnd'], new \DateTimeZone('Asia/Kolkata'));
        $billable = (int) $preview['billableDeliveryDays'];
        $couponCode = trim((string) ($input['coupon'] ?? ''));
        $withCoupon = self::totalsWithCoupon($lines, $scheduleKey, $billable, $couponCode, $customerId);
        $totals = $withCoupon['totals'];
        $couponMeta = $withCoupon['coupon'];
        $couponId = trim((string) ($couponMeta['couponId'] ?? ''));
        if (($couponMeta['applied'] ?? false) && $couponId !== '') {
            CouponService::validateUsage($couponId, $customerId);
        }
        $payable = (int) $totals['payable'];
        $payablePaise = max(100, $payable * 100);

        $subscriptionId = Support::uuid();
        $cycleId = Support::uuid();
        $orderId = Support::uuid();
        $now = Support::now();

        $slot = [
            'key' => $scheduleKey,
            'label' => (string) $preview['scheduleLabel'],
            'date' => '',
            'etaMinutes' => 0,
        ];

        $receipt = 'SUB-' . $cycleId;
        $payment = RazorpayGateway::createOrder($payablePaise, $receipt);

        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO subscriptions (id, customer_id, plan_id, address_id, schedule_key, status, start_date, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, "pending_payment", ?, ?, ?)',
            )->execute([
                $subscriptionId,
                $customerId,
                $planId,
                $addressId,
                $scheduleKey,
                $startDate,
                $now,
                $now,
            ]);

            $lineStmt = $pdo->prepare(
                'INSERT INTO subscription_lines (id, subscription_id, product_id, variant_id, daily_qty, min_qty, max_qty, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            );
            foreach ($lines as $line) {
                $lineStmt->execute([
                    Support::uuid(),
                    $subscriptionId,
                    (string) $line['productId'],
                    (string) $line['variantId'],
                    (int) $line['dailyQty'],
                    1,
                    12,
                    $now,
                    $now,
                ]);
            }

            $pdo->prepare(
                'INSERT INTO subscription_cycles (
                    id, subscription_id, period_start, period_end, billable_delivery_days, status, amount_paise,
                    razorpay_order_id, orders_order_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, "pending_payment", ?, ?, NULL, ?, ?)',
            )->execute([
                $cycleId,
                $subscriptionId,
                $periodStart->format('Y-m-d'),
                $periodEnd->format('Y-m-d'),
                $billable,
                $payablePaise,
                $payment['orderId'],
                $now,
                $now,
            ]);

            $number = Checkout::orderNumberForInsert($pdo);
            $grossSub = (int) ($totals['grossSubtotal'] ?? $totals['subtotal'] + (int) ($totals['discount'] ?? 0));
            $disc = (int) ($totals['discount'] ?? 0);
            $couponCodeStr = (string) ($couponMeta['code'] ?? '');
            $couponIdDb = (($couponMeta['applied'] ?? false) && $couponId !== '') ? $couponId : null;
            $orderCols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
            $hasCouponCol = is_array($orderCols) && in_array('coupon_id', $orderCols, true);
            if ($hasCouponCol) {
                $pdo->prepare(
                    'INSERT INTO orders (
                        id, order_number, customer_id, status, payment_status, fulfillment_status,
                        delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                        address_id, address_json, coupon_code, coupon_id, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                        razorpay_order_id, subscription_id, subscription_cycle_id, created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, "pending_payment", "pending", "pending",
                        "subscription", ?, ?, NULL, 0,
                        ?, ?, ?, ?, ?, ?, 0, ?, ?, "",
                        ?, ?, ?, ?, ?
                    )',
                )->execute([
                    $orderId,
                    $number,
                    $customerId,
                    (string) $slot['key'],
                    (string) $slot['label'],
                    $addressId,
                    json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    $couponCodeStr,
                    $couponIdDb,
                    $grossSub,
                    $disc,
                    (int) $totals['tax'],
                    $payable,
                    $payment['orderId'],
                    $subscriptionId,
                    $cycleId,
                    $now,
                    $now,
                ]);
            } else {
                $pdo->prepare(
                    'INSERT INTO orders (
                        id, order_number, customer_id, status, payment_status, fulfillment_status,
                        delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                        address_id, address_json, coupon_code, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                        razorpay_order_id, subscription_id, subscription_cycle_id, created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, "pending_payment", "pending", "pending",
                        "subscription", ?, ?, NULL, 0,
                        ?, ?, ?, ?, ?, 0, ?, ?, "",
                        ?, ?, ?, ?, ?
                    )',
                )->execute([
                    $orderId,
                    $number,
                    $customerId,
                    (string) $slot['key'],
                    (string) $slot['label'],
                    $addressId,
                    json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    $couponCodeStr,
                    $grossSub,
                    $disc,
                    (int) $totals['tax'],
                    $payable,
                    $payment['orderId'],
                    $subscriptionId,
                    $cycleId,
                    $now,
                    $now,
                ]);
            }

            $itemInsert = $pdo->prepare(
                'INSERT INTO order_items (id, order_id, product_id, variant_id, name, unit, qty, price, line_total, tax)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            );
            foreach ($totals['lines'] as $line) {
                $dailyQty = (int) $line['dailyQty'];
                $mult = (int) $line['scheduleMultiplier'];
                $totalUnits = $dailyQty * $billable * $mult;
                $price = (int) $line['price'];
                $lineSub = $price * $dailyQty * $mult * $billable;
                /** @var array{taxPercent: array<string, int>} $cartConfig */
                $cartConfig = require dirname(__DIR__, 2) . '/config/cart.php';
                $rate = (int) ($cartConfig['taxPercent'][(string) $line['productId']] ?? 0);
                $lineTax = (int) round($lineSub * $rate / 100);
                $unitLabel = (string) ($line['unit'] ?? '');
                $itemInsert->execute([
                    Support::uuid(),
                    $orderId,
                    (string) $line['productId'],
                    (string) $line['variantId'],
                    (string) $line['name'],
                    $unitLabel,
                    max(1, $totalUnits),
                    $price,
                    $lineSub,
                    $lineTax,
                ]);
            }

            $pdo->prepare(
                'UPDATE subscription_cycles SET orders_order_id = ? WHERE id = ?',
            )->execute([$orderId, $cycleId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        $orderRow = Checkout::rowById($customerId, $orderId);
        if ($orderRow === null) {
            throw new SubscriptionException('Order could not be loaded.', 500);
        }

        return [
            'subscription' => ['id' => $subscriptionId],
            'cycle' => ['id' => $cycleId],
            'order' => Checkout::presentRow($orderRow, true),
            'razorpay' => $payment,
        ];
    }

    /**
     * @param array<string, mixed> $customer
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public static function renew(array $customer, array $input): array
    {
        SubscriptionSchema::ensure();
        OrderSchema::ensure();

        $customerId = (string) $customer['id'];
        $subscriptionId = trim((string) ($input['subscriptionId'] ?? ''));
        if ($subscriptionId === '') {
            throw new SubscriptionException('Choose a subscription to renew.');
        }

        $sub = self::subscriptionRow($customerId, $subscriptionId);
        if ($sub === null) {
            throw new SubscriptionException('Subscription not found.', 404);
        }

        if (in_array((string) $sub['status'], ['cancelled'], true)) {
            throw new SubscriptionException('This subscription is cancelled.');
        }

        $lastCycle = self::lastPaidCycle($subscriptionId);
        if ($lastCycle === null) {
            throw new SubscriptionException('No paid billing cycle found to renew from.');
        }

        $periodEndPrev = new \DateTimeImmutable((string) $lastCycle['period_end'], new \DateTimeZone('Asia/Kolkata'));
        $periodStart = $periodEndPrev->modify('+1 day')->setTime(0, 0, 0);
        $periodEnd = SubscriptionQuote::endOfMonth($periodStart);

        $lines = self::linesFromDb($subscriptionId);
        if ($lines === []) {
            throw new SubscriptionException('This subscription has no product lines.');
        }

        $scheduleKey = (string) $sub['schedule_key'];
        $pauses = SubscriptionService::pausesForSubscription($subscriptionId);
        $skips = SubscriptionService::skipsForSubscription($subscriptionId);
        $billable = SubscriptionQuote::countBillableDays($periodStart, $periodEnd, $pauses, $skips);
        if ($billable < 1) {
            throw new SubscriptionException('No billable delivery days in the next cycle. Adjust pause or skip settings.');
        }

        $couponCode = trim((string) ($input['coupon'] ?? ''));
        $withCoupon = self::totalsWithCoupon($lines, $scheduleKey, $billable, $couponCode, $customerId);
        $totals = $withCoupon['totals'];
        $couponMeta = $withCoupon['coupon'];
        $couponId = trim((string) ($couponMeta['couponId'] ?? ''));
        if (($couponMeta['applied'] ?? false) && $couponId !== '') {
            CouponService::validateUsage($couponId, $customerId);
        }
        $payable = (int) $totals['payable'];
        $payablePaise = max(100, $payable * 100);

        $cycleId = Support::uuid();
        $orderId = Support::uuid();
        $now = Support::now();
        $addressId = (string) $sub['address_id'];
        $presented = Addresses::getForCustomer($customerId, $addressId);
        if ($presented === null) {
            throw new SubscriptionException('Saved address is no longer available. Update your subscription address.');
        }
        SubscriptionService::assertServiceable($presented);

        $receipt = 'REN-' . $cycleId;
        $payment = RazorpayGateway::createOrder($payablePaise, $receipt);

        $schedule = self::scheduleByKey($scheduleKey);

        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO subscription_cycles (
                    id, subscription_id, period_start, period_end, billable_delivery_days, status, amount_paise,
                    razorpay_order_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, "pending_payment", ?, ?, ?, ?)',
            )->execute([
                $cycleId,
                $subscriptionId,
                $periodStart->format('Y-m-d'),
                $periodEnd->format('Y-m-d'),
                $billable,
                $payablePaise,
                $payment['orderId'],
                $now,
                $now,
            ]);

            $number = Checkout::orderNumberForInsert($pdo);
            $grossSub = (int) ($totals['grossSubtotal'] ?? $totals['subtotal'] + (int) ($totals['discount'] ?? 0));
            $disc = (int) ($totals['discount'] ?? 0);
            $couponCodeStr = (string) ($couponMeta['code'] ?? '');
            $couponIdDb = (($couponMeta['applied'] ?? false) && $couponId !== '') ? $couponId : null;
            $orderCols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
            $hasCouponCol = is_array($orderCols) && in_array('coupon_id', $orderCols, true);
            if ($hasCouponCol) {
                $pdo->prepare(
                    'INSERT INTO orders (
                        id, order_number, customer_id, status, payment_status, fulfillment_status,
                        delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                        address_id, address_json, coupon_code, coupon_id, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                        razorpay_order_id, subscription_id, subscription_cycle_id, created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, "pending_payment", "pending", "pending",
                        "subscription", ?, ?, NULL, 0,
                        ?, ?, ?, ?, ?, ?, 0, ?, ?, "",
                        ?, ?, ?, ?, ?
                    )',
                )->execute([
                    $orderId,
                    $number,
                    $customerId,
                    (string) $schedule['key'],
                    (string) $schedule['label'],
                    $addressId,
                    json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    $couponCodeStr,
                    $couponIdDb,
                    $grossSub,
                    $disc,
                    (int) $totals['tax'],
                    $payable,
                    $payment['orderId'],
                    $subscriptionId,
                    $cycleId,
                    $now,
                    $now,
                ]);
            } else {
                $pdo->prepare(
                    'INSERT INTO orders (
                        id, order_number, customer_id, status, payment_status, fulfillment_status,
                        delivery_type, slot_key, slot_label, slot_date, eta_minutes,
                        address_id, address_json, coupon_code, subtotal, discount, delivery_fee, tax, payable, delivery_note,
                        razorpay_order_id, subscription_id, subscription_cycle_id, created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, "pending_payment", "pending", "pending",
                        "subscription", ?, ?, NULL, 0,
                        ?, ?, ?, ?, ?, 0, ?, ?, "",
                        ?, ?, ?, ?, ?
                    )',
                )->execute([
                    $orderId,
                    $number,
                    $customerId,
                    (string) $schedule['key'],
                    (string) $schedule['label'],
                    $addressId,
                    json_encode($presented, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    $couponCodeStr,
                    $grossSub,
                    $disc,
                    (int) $totals['tax'],
                    $payable,
                    $payment['orderId'],
                    $subscriptionId,
                    $cycleId,
                    $now,
                    $now,
                ]);
            }

            $itemInsert = $pdo->prepare(
                'INSERT INTO order_items (id, order_id, product_id, variant_id, name, unit, qty, price, line_total, tax)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            );
            foreach ($totals['lines'] as $line) {
                $dailyQty = (int) $line['dailyQty'];
                $mult = (int) $line['scheduleMultiplier'];
                $totalUnits = $dailyQty * $billable * $mult;
                $price = (int) $line['price'];
                $lineSub = $price * $dailyQty * $mult * $billable;
                /** @var array{taxPercent: array<string, int>} $cartConfig */
                $cartConfig = require dirname(__DIR__, 2) . '/config/cart.php';
                $rate = (int) ($cartConfig['taxPercent'][(string) $line['productId']] ?? 0);
                $lineTax = (int) round($lineSub * $rate / 100);
                $itemInsert->execute([
                    Support::uuid(),
                    $orderId,
                    (string) $line['productId'],
                    (string) $line['variantId'],
                    (string) $line['name'],
                    (string) ($line['unit'] ?? ''),
                    max(1, $totalUnits),
                    $price,
                    $lineSub,
                    $lineTax,
                ]);
            }

            $pdo->prepare(
                'UPDATE subscription_cycles SET orders_order_id = ? WHERE id = ?',
            )->execute([$orderId, $cycleId]);

            $pdo->prepare(
                'UPDATE subscriptions SET status = "pending_payment", updated_at = ? WHERE id = ?',
            )->execute([$now, $subscriptionId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        $orderRow = Checkout::rowById($customerId, $orderId);
        if ($orderRow === null) {
            throw new SubscriptionException('Order could not be loaded.', 500);
        }

        return [
            'cycle' => ['id' => $cycleId],
            'order' => Checkout::presentRow($orderRow, true),
            'razorpay' => $payment,
            'quote' => [
                'periodStart' => $periodStart->format('Y-m-d'),
                'periodEnd' => $periodEnd->format('Y-m-d'),
                'billableDeliveryDays' => $billable,
                'grossSubtotal' => (int) ($totals['grossSubtotal'] ?? $totals['subtotal'] + (int) ($totals['discount'] ?? 0)),
                'subtotal' => (int) $totals['subtotal'],
                'discount' => (int) ($totals['discount'] ?? 0),
                'tax' => (int) $totals['tax'],
                'payable' => $payable,
                'coupon' => [
                    'code' => (string) ($couponMeta['code'] ?? ''),
                    'applied' => (bool) ($couponMeta['applied'] ?? false),
                    'message' => (string) ($couponMeta['message'] ?? ''),
                    'couponId' => (string) ($couponMeta['couponId'] ?? ''),
                ],
            ],
        ];
    }

    /**
     * @param list<array{productId: string, variantId: string, dailyQty: int}> $lines
     *
     * @return array{totals: array<string, mixed>, coupon: array<string, mixed>}
     */
    /** @return array{key: string, label: string, detail: string, multiplier: int} */
    private static function scheduleByKey(string $scheduleKey): array
    {
        $key = strtolower(trim($scheduleKey));
        /** @var array{schedules: list<array<string, mixed>>} $config */
        $config = require dirname(__DIR__, 2) . '/config/subscription.php';
        foreach ($config['schedules'] ?? [] as $schedule) {
            if (!is_array($schedule) || (string) ($schedule['key'] ?? '') !== $key) {
                continue;
            }

            return [
                'key' => $key,
                'label' => (string) ($schedule['label'] ?? $key),
                'detail' => (string) ($schedule['detail'] ?? ''),
                'multiplier' => (int) ($schedule['multiplier'] ?? 1),
            ];
        }

        throw new SubscriptionException('Choose when the daily drop should arrive.');
    }

    private static function totalsWithCoupon(array $lines, string $scheduleKey, int $billable, string $couponCode, string $customerId): array
    {
        $pre = SubscriptionQuote::cycleTotals($lines, $scheduleKey, $billable, 0);
        $gross = (int) ($pre['grossSubtotal'] ?? $pre['subtotal']);
        $coupon = CouponService::apply($couponCode, $gross, 'subscription', $customerId);
        $discount = ($coupon['applied'] ?? false) ? (int) ($coupon['discount'] ?? 0) : 0;
        $totals = SubscriptionQuote::cycleTotals($lines, $scheduleKey, $billable, $discount);

        return ['totals' => $totals, 'coupon' => $coupon];
    }

    /** @return array<string, mixed>|null */
    public static function subscriptionRow(string $customerId, string $subscriptionId): ?array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT * FROM subscriptions WHERE id = ? AND customer_id = ? LIMIT 1',
        );
        $statement->execute([$subscriptionId, $customerId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null */
    private static function lastPaidCycle(string $subscriptionId): ?array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT * FROM subscription_cycles WHERE subscription_id = ? AND status = "paid_active" ORDER BY period_end DESC LIMIT 1',
        );
        $statement->execute([$subscriptionId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /** @return list<array{productId: string, variantId: string, dailyQty: int}> */
    private static function linesFromDb(string $subscriptionId): array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT product_id, variant_id, daily_qty FROM subscription_lines WHERE subscription_id = ?',
        );
        $statement->execute([$subscriptionId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $out[] = [
                'productId' => (string) $row['product_id'],
                'variantId' => (string) $row['variant_id'],
                'dailyQty' => (int) $row['daily_qty'],
            ];
        }

        return $out;
    }

    public static function activatePaidCycle(string $orderId): void
    {
        SubscriptionSchema::ensure();
        $pdo = Connection::pdo();
        $statement = $pdo->prepare(
            'SELECT * FROM orders WHERE id = ? LIMIT 1',
        );
        $statement->execute([$orderId]);
        $order = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($order) || (string) $order['delivery_type'] !== 'subscription') {
            return;
        }

        $cycleId = trim((string) ($order['subscription_cycle_id'] ?? ''));
        $subscriptionId = trim((string) ($order['subscription_id'] ?? ''));
        if ($cycleId === '' || $subscriptionId === '') {
            return;
        }

        $paidAt = $order['paid_at'] ? (string) $order['paid_at'] : Support::now();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'UPDATE subscription_cycles SET status = "paid_active", paid_at = ?, updated_at = ? WHERE id = ? AND status = "pending_payment"',
            )->execute([$paidAt, Support::now(), $cycleId]);

            $pdo->prepare(
                'UPDATE subscriptions SET status = "active", updated_at = ? WHERE id = ?',
            )->execute([Support::now(), $subscriptionId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        SubscriptionDeliveryGenerator::syncCycleDeliveries($cycleId);
    }
}
