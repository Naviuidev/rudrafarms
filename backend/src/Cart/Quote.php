<?php

declare(strict_types=1);

namespace App\Cart;

use App\Admin\CouponService;
use App\Catalog\Catalog;
use App\Database\Connection;
use App\Location\ServiceArea;

final class Quote
{
    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function build(array $input): array
    {
        Catalog::ensure();
        /** @var array{maxQty: int, deliveryFee: int, freeDeliveryMinimum: int, coupons: array<string, array<string, mixed>>, taxPercent: array<string, int>} $config */
        $config = require dirname(__DIR__, 2) . '/config/cart.php';
        $rawItems = is_array($input['items'] ?? null) ? $input['items'] : [];
        $orderKind = self::orderKind($rawItems);
        $schedule = self::scheduleKey($input);
        $lines = self::lines($rawItems, $config, $orderKind);
        $subtotal = 0;
        $tax = 0;
        $problems = 0;
        foreach ($lines as $line) {
            if (!$line['ok']) {
                $problems++;
                continue;
            }
            $subtotal += $line['lineTotal'];
            $tax += $line['tax'];
        }

        if ($orderKind === 'subscription' && $schedule === 'both') {
            $subtotal *= 2;
            $tax *= 2;
            foreach ($lines as $index => $line) {
                if (!$line['ok']) {
                    continue;
                }
                $lines[$index]['lineTotal'] *= 2;
                $lines[$index]['tax'] *= 2;
            }
        }

        $customerId = trim((string) ($input['customerId'] ?? ''));
        $customerId = $customerId !== '' ? $customerId : null;
        $couponKind = match ($orderKind) {
            'subscription' => 'subscription',
            'quick' => 'quick',
            default => 'quick',
        };
        $coupon = CouponService::apply(trim((string) ($input['coupon'] ?? '')), $subtotal, $couponKind, $customerId);
        $discount = $coupon['applied'] ? $coupon['discount'] : 0;
        $net = max(0, $subtotal - $discount);
        $deliveryFee = $orderKind === 'subscription' || $subtotal === 0 || $net >= $config['freeDeliveryMinimum']
            ? 0
            : $config['deliveryFee'];
        $point = self::point($input);
        $areas = ServiceArea::load()->check($point['latitude'], $point['longitude'], (string) ($input['pin'] ?? ''));
        $serviceable = $point['present'] && $problems === 0 && $subtotal > 0 && $orderKind !== 'mixed';
        $message = self::serviceMessage($point['present'], $orderKind, $areas, $problems);

        if ($orderKind === 'subscription' && $point['present'] && $problems === 0 && $subtotal > 0 && !$areas['subscription']) {
            $serviceable = false;
            $message = 'Subscription delivery is not available for this address.';
        }

        return [
            'items' => $lines,
            'orderKind' => $orderKind,
            'subscriptionSchedule' => $schedule,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'coupon' => [
                'code' => $coupon['code'],
                'applied' => $coupon['applied'],
                'message' => $coupon['message'],
                'couponId' => $coupon['couponId'] ?? '',
            ],
            'deliveryFee' => $deliveryFee,
            'freeDeliveryMinimum' => $config['freeDeliveryMinimum'],
            'tax' => $tax,
            'payable' => $net + $deliveryFee + $tax,
            'serviceable' => $serviceable,
            'serviceability' => [
                'dayToDay' => $orderKind === 'quick' && $serviceable,
                'subscription' => $areas['subscription'],
                'zones' => $areas['subscriptionZones'],
                'message' => $message,
            ],
        ];
    }

    /** @param list<mixed> $items */
    public static function orderKind(array $items): string
    {
        $modes = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $modes[self::deliveryMode($item)] = true;
        }
        if (isset($modes['quick']) && isset($modes['subscription'])) {
            return 'mixed';
        }
        if (isset($modes['subscription'])) {
            return 'subscription';
        }

        return 'quick';
    }

    /**
     * @param list<mixed> $items
     * @param array{maxQty: int, taxPercent: array<string, int>} $config
     * @return list<array<string, mixed>>
     */
    private static function lines(array $items, array $config, string $orderKind): array
    {
        $lines = [];
        $seen = [];
        foreach (array_slice($items, 0, 20) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $productId = trim((string) ($item['productId'] ?? ''));
            $variantId = trim((string) ($item['variantId'] ?? ''));
            $mode = self::deliveryMode($item);
            $key = $productId . ':' . $variantId . ':' . $mode;
            if ($productId === '' || $variantId === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            if ($orderKind === 'mixed') {
                $lines[] = self::mixedLine($productId, $variantId, $mode);
                continue;
            }
            $lines[] = self::line($productId, $variantId, $item['qty'] ?? 0, $item['price'] ?? null, $config, $mode);
        }

        return $lines;
    }

    /** @return array<string, mixed> */
    private static function mixedLine(string $productId, string $variantId, string $mode): array
    {
        return [
            'key' => $productId . ':' . $variantId . ':' . $mode,
            'productId' => $productId,
            'variantId' => $variantId,
            'deliveryMode' => $mode,
            'name' => 'Cart item',
            'unit' => '',
            'image' => '',
            'price' => 0,
            'mrp' => 0,
            'qty' => 0,
            'stock' => 0,
            'lineTotal' => 0,
            'tax' => 0,
            'ok' => false,
            'priceChanged' => false,
            'message' => 'Quick delivery and subscription items need separate checkouts.',
        ];
    }

    /** @param array{maxQty: int, taxPercent: array<string, int>} $config @return array<string, mixed> */
    private static function line(string $productId, string $variantId, mixed $qty, mixed $sentPrice, array $config, string $mode): array
    {
        $row = self::row($productId, $variantId);
        $blank = [
            'key' => $productId . ':' . $variantId . ':' . $mode,
            'productId' => $productId,
            'variantId' => $variantId,
            'deliveryMode' => $mode,
            'name' => $row['name'] ?? 'Unavailable product',
            'unit' => '',
            'image' => '',
            'price' => 0,
            'mrp' => 0,
            'qty' => 0,
            'stock' => 0,
            'lineTotal' => 0,
            'tax' => 0,
            'ok' => false,
            'priceChanged' => false,
            'message' => 'That product is not available.',
        ];
        if ($row === null) {
            return $blank;
        }

        $price = self::rupees($row['selling_price']);
        $stock = (int) $row['stock'];
        $unit = trim((string) $row['label']) !== '' ? (string) $row['label'] : (string) $row['unit_name'];
        $quantity = is_numeric($qty) ? (int) $qty : 0;
        $message = '';
        $ok = true;
        if ((int) $row['product_active'] !== 1 || (int) $row['category_active'] !== 1 || (int) $row['variant_active'] !== 1) {
            $ok = false;
            $message = 'That product is not available.';
        } elseif ((int) $row['available'] !== 1 || $stock < 1) {
            $ok = false;
            $message = 'This item is out of stock.';
        } elseif ($mode === 'subscription' && (int) $row['subscription_eligible'] !== 1) {
            $ok = false;
            $message = 'This product is not available on subscription.';
        } elseif ($mode === 'quick' && (int) $row['quick_delivery_eligible'] !== 1) {
            $ok = false;
            $message = 'This product is for a subscription, not a day-to-day order.';
        } elseif (!is_numeric($qty) || (int) $qty != $qty || $quantity < 1) {
            $ok = false;
            $message = 'Enter a whole quantity.';
        } elseif ($quantity > $config['maxQty']) {
            $ok = false;
            $message = 'You can add up to ' . $config['maxQty'] . ' of one item.';
        } elseif ($quantity > $stock) {
            $ok = false;
            $message = 'Only ' . $stock . ' in stock.';
        }

        $lineTotal = $ok ? $price * $quantity : 0;
        $rate = $config['taxPercent'][$productId] ?? 0;
        $tax = $ok ? (int) round($lineTotal * $rate / 100) : 0;
        $priceChanged = is_numeric($sentPrice) && self::rupees($sentPrice) !== $price;
        if ($ok && $priceChanged) {
            $message = 'The price is now ₹' . $price . '.';
        }

        return [
            'key' => $productId . ':' . $variantId . ':' . $mode,
            'productId' => $productId,
            'variantId' => $variantId,
            'deliveryMode' => $mode,
            'name' => (string) $row['name'],
            'unit' => $unit,
            'image' => (string) ($row['image'] ?? ''),
            'price' => $price,
            'mrp' => self::rupees($row['mrp']),
            'qty' => max(0, $quantity),
            'stock' => $stock,
            'lineTotal' => $lineTotal,
            'tax' => $tax,
            'ok' => $ok,
            'priceChanged' => $priceChanged,
            'message' => $message,
        ];
    }

    /** @return array<string, mixed>|null */
    private static function row(string $productId, string $variantId): ?array
    {
        $statement = Connection::pdo()->prepare(
            'SELECT p.name, p.active AS product_active, p.quick_delivery_eligible, p.subscription_eligible,
                    c.active AS category_active,
                    v.label, v.mrp, v.selling_price, v.stock, v.available, v.active AS variant_active,
                    u.name AS unit_name,
                    (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image
             FROM product_variants v
             INNER JOIN products p ON p.id = v.product_id
             INNER JOIN categories c ON c.id = p.category_id
             INNER JOIN units u ON u.id = v.unit_id
             WHERE p.id = ? AND v.id = ?',
        );
        $statement->execute([$productId, $variantId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $input @return array{present: bool, latitude: ?float, longitude: ?float} */
    private static function point(array $input): array
    {
        $latitude = $input['latitude'] ?? null;
        $longitude = $input['longitude'] ?? null;
        if (!is_numeric($latitude) || !is_numeric($longitude)) {
            return ['present' => false, 'latitude' => null, 'longitude' => null];
        }
        $lat = (float) $latitude;
        $lng = (float) $longitude;
        $present = abs($lat) <= 90 && abs($lng) <= 180 && !($lat === 0.0 && $lng === 0.0);

        return ['present' => $present, 'latitude' => $present ? $lat : null, 'longitude' => $present ? $lng : null];
    }

    /** @param array<string, mixed> $areas */
    private static function serviceMessage(bool $hasPoint, string $orderKind, array $areas, int $problems): string
    {
        if ($orderKind === 'mixed') {
            return 'Quick delivery and subscription items need separate checkouts.';
        }
        if (!$hasPoint) {
            return 'Add a delivery address so this order can be checked.';
        }
        if ($problems > 0) {
            return 'Update the cart before checkout.';
        }
        if ($orderKind === 'subscription') {
            return $areas['subscription']
                ? 'This address can take a daily subscription. You can place this order any time.'
                : 'Subscription delivery is not available for this address.';
        }
        if ($areas['subscription']) {
            return 'This address can take a day-to-day order. A subscription can start here too.';
        }

        return 'This address can take a day-to-day order.';
    }

    /** @param array<string, mixed> $item */
    private static function deliveryMode(array $item): string
    {
        $mode = strtolower(trim((string) ($item['deliveryMode'] ?? 'quick')));

        return $mode === 'subscription' ? 'subscription' : 'quick';
    }

    /** @param array<string, mixed> $input */
    private static function scheduleKey(array $input): string
    {
        $key = strtolower(trim((string) ($input['subscriptionSchedule'] ?? '')));
        if (!in_array($key, ['morning', 'evening', 'both'], true)) {
            return '';
        }

        return $key;
    }

    private static function rupees(mixed $value): int
    {
        return (int) round((float) $value);
    }
}
