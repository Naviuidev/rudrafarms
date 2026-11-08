<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\Support;
use App\Database\Connection;
use PDO;

final class InventoryService
{
    /** @param array{variantId?: string, limit?: int} $filters */
    public static function movements(array $filters = []): array
    {
        AdminSchema::ensure();
        $variantId = trim((string) ($filters['variantId'] ?? ''));
        $limit = max(1, min(200, (int) ($filters['limit'] ?? 50)));
        $pdo = Connection::pdo();
        if ($variantId !== '') {
            $st = $pdo->prepare(
                'SELECT m.*, p.name AS product_name
                 FROM stock_movements m
                 INNER JOIN product_variants v ON v.id = m.variant_id
                 INNER JOIN products p ON p.id = v.product_id
                 WHERE m.variant_id = ?
                 ORDER BY m.created_at DESC
                 LIMIT ' . (int) $limit,
            );
            $st->execute([$variantId]);
        } else {
            $st = $pdo->query(
                'SELECT m.*, p.name AS product_name
                 FROM stock_movements m
                 INNER JOIN product_variants v ON v.id = m.variant_id
                 INNER JOIN products p ON p.id = v.product_id
                 ORDER BY m.created_at DESC
                 LIMIT ' . (int) $limit,
            );
        }
        $rows = $st ? $st->fetchAll(PDO::FETCH_ASSOC) : [];

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'variantId' => (string) $row['variant_id'],
            'productName' => (string) ($row['product_name'] ?? ''),
            'delta' => (int) $row['delta'],
            'reason' => (string) $row['reason'],
            'reference' => (string) $row['reference'],
            'createdAt' => (string) $row['created_at'],
        ], is_array($rows) ? $rows : []);
    }

    /**
     * Positive delta adds stock; negative reduces. Runs in a transaction.
     *
     * @return array{variantId: string, stock: int}
     */
    public static function adjust(string $variantId, int $delta, string $reason, string $reference = ''): array
    {
        AdminSchema::ensure();
        $variantId = trim($variantId);
        if ($variantId === '') {
            throw new \InvalidArgumentException('Choose a variant.');
        }
        if ($delta === 0) {
            throw new \InvalidArgumentException('Enter a non-zero quantity change.');
        }
        $reason = trim($reason);
        if ($reason === '') {
            $reason = 'adjustment';
        }
        $reference = trim($reference);

        $pdo = Connection::pdo();
        $pdo->beginTransaction();
        try {
            $lock = $pdo->prepare('SELECT stock FROM product_variants WHERE id = ? FOR UPDATE');
            $lock->execute([$variantId]);
            $stock = $lock->fetchColumn();
            if ($stock === false) {
                throw new \InvalidArgumentException('Variant not found.');
            }
            $next = (int) $stock + $delta;
            if ($next < 0) {
                throw new \InvalidArgumentException('Resulting stock cannot be negative.');
            }
            $upd = $pdo->prepare('UPDATE product_variants SET stock = ? WHERE id = ?');
            $upd->execute([$next, $variantId]);
            if ($upd->rowCount() !== 1) {
                throw new \RuntimeException('Stock could not be updated.');
            }
            $pdo->prepare(
                'INSERT INTO stock_movements (id, variant_id, delta, reason, reference, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)',
            )->execute([
                Support::uuid(),
                $variantId,
                $delta,
                $reason,
                $reference,
                Support::now(),
            ]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        return ['variantId' => $variantId, 'stock' => $next];
    }
}
