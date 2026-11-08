<?php

declare(strict_types=1);

namespace App\Payment;

use App\Auth\Support;
use App\Order\OrderException;
use Razorpay\Api\Api;

final class RazorpayGateway
{
    /** @return array{keyId: string, keySecret: string} */
    private static function pair(): array
    {
        $creds = PaymentConfig::credentials();
        if ($creds === null) {
            return ['keyId' => '', 'keySecret' => ''];
        }

        return $creds;
    }

    public static function configured(): bool
    {
        $pair = self::pair();

        return $pair['keyId'] !== '' && $pair['keySecret'] !== '';
    }

    public static function mockAllowed(): bool
    {
        return Support::local() && !self::configured();
    }

    /** @return array{keyId: string, orderId: string, amount: int, currency: string, mock: bool} */
    public static function createOrder(int $payablePaise, string $receipt): array
    {
        if ($payablePaise < 100) {
            throw new OrderException('The payable amount is too low to charge.');
        }

        if (self::mockAllowed()) {
            return [
                'keyId' => 'mock',
                'orderId' => 'mock_' . bin2hex(random_bytes(8)),
                'amount' => $payablePaise,
                'currency' => 'INR',
                'mock' => true,
            ];
        }

        if (!self::configured()) {
            throw new OrderException('Online payment is not configured yet.', 503);
        }

        $pair = self::pair();
        $api = new Api($pair['keyId'], $pair['keySecret']);
        $order = $api->order->create([
            'receipt' => $receipt,
            'amount' => $payablePaise,
            'currency' => 'INR',
            'payment_capture' => 1,
        ]);

        return [
            'keyId' => $pair['keyId'],
            'orderId' => (string) $order['id'],
            'amount' => $payablePaise,
            'currency' => 'INR',
            'mock' => false,
        ];
    }

    public static function verify(string $orderId, string $paymentId, string $signature): void
    {
        if (!self::configured()) {
            throw new OrderException('Online payment is not configured yet.', 503);
        }

        $pair = self::pair();
        $api = new Api($pair['keyId'], $pair['keySecret']);
        $api->utility->verifyPaymentSignature([
            'razorpay_order_id' => $orderId,
            'razorpay_payment_id' => $paymentId,
            'razorpay_signature' => $signature,
        ]);
    }

    /**
     * A UPI QR payment is recorded on the Razorpay order even when the
     * checkout window closes before it can send a signature back.
     */
    public static function capturedPaymentId(string $razorpayOrderId, int $amountPaise): ?string
    {
        if (!self::configured() || !str_starts_with($razorpayOrderId, 'order_') || $amountPaise < 100) {
            return null;
        }

        $pair = self::pair();
        $api = new Api($pair['keyId'], $pair['keySecret']);
        $collection = $api->order->fetch($razorpayOrderId)->payments();
        $items = [];
        if (is_array($collection)) {
            $items = is_array($collection['items'] ?? null) ? $collection['items'] : [];
        }

        foreach ($items as $payment) {
            if (!is_array($payment)) {
                continue;
            }
            $id = (string) ($payment['id'] ?? '');
            $status = (string) ($payment['status'] ?? '');
            $amount = (int) ($payment['amount'] ?? 0);
            if ($id === '' || $amount !== $amountPaise) {
                continue;
            }
            if ($status === 'captured') {
                return $id;
            }
            if ($status === 'authorized') {
                $api->payment->fetch($id)->capture([
                    'amount' => $amountPaise,
                    'currency' => 'INR',
                ]);

                return $id;
            }
        }

        return null;
    }
}
