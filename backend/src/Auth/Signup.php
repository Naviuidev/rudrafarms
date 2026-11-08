<?php

declare(strict_types=1);

namespace App\Auth;

use App\Database\Connection;

final class Signup
{
    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function requestCode(array $input): array
    {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new AuthException('Enter a valid email address.', 422, [
                'email' => 'Enter a valid email address.',
            ]);
        }
        if (Customers::emailTaken($email)) {
            throw new AuthException('An account with this email already exists.', 422, [
                'email' => 'An account with this email already exists. Sign in instead.',
            ]);
        }

        $pdo = Connection::pdo();
        $pdo->prepare('UPDATE signup_challenges SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL')
            ->execute([Support::now(), $email]);

        $id = Support::uuid();
        $code = (string) random_int(100000, 999999);
        $pdo->prepare(
            'INSERT INTO signup_challenges (id, email, code_hash, attempts, expires_at, created_at)
             VALUES (?, ?, ?, 0, ?, ?)',
        )->execute([$id, $email, Support::hashToken($code), Support::plus(600), Support::now()]);

        $sent = Mail::send(
            $email,
            $email,
            'Your RudrasFarmFresh signup code',
            "Your signup code is {$code}. It expires in 10 minutes.\n",
        );
        if (!$sent && (Mail::configured() || !Support::local())) {
            throw new AuthException('The code could not be emailed. Check the mail settings and try again.', 503);
        }

        $response = [
            'challengeId' => $id,
            'message' => 'We sent a 6-digit code to that email. It expires in 10 minutes.',
        ];
        if (!$sent) {
            $response['previewCode'] = $code;
        }

        return $response;
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function verifyCode(array $input): array
    {
        $id = trim((string) ($input['challengeId'] ?? ''));
        $code = preg_replace('/\D/', '', (string) ($input['code'] ?? '')) ?? '';
        if ($id === '' || !preg_match('/^\d{6}$/', $code)) {
            throw new AuthException('Enter the 6-digit code.', 422, [
                'code' => 'Enter the 6-digit code.',
            ]);
        }

        $statement = Connection::pdo()->prepare(
            'SELECT * FROM signup_challenges
             WHERE id = ? AND consumed_at IS NULL AND verified_at IS NULL AND expires_at > UTC_TIMESTAMP()
             LIMIT 1',
        );
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!is_array($row) || (int) $row['attempts'] >= 5) {
            throw new AuthException('That code is incorrect or has expired.', 422, [
                'code' => 'That code is incorrect or has expired.',
            ]);
        }
        if (!hash_equals((string) $row['code_hash'], Support::hashToken($code))) {
            $attempts = (int) $row['attempts'] + 1;
            Connection::pdo()->prepare(
                'UPDATE signup_challenges SET attempts = ?, consumed_at = IF(? >= 5, ?, consumed_at) WHERE id = ?',
            )->execute([$attempts, $attempts, Support::now(), $id]);
            throw new AuthException('That code is incorrect or has expired.', 422, [
                'code' => 'That code is incorrect or has expired.',
            ]);
        }

        $proof = bin2hex(random_bytes(32));
        Connection::pdo()->prepare(
            'UPDATE signup_challenges SET proof_hash = ?, verified_at = ?, expires_at = ? WHERE id = ?',
        )->execute([Support::hashToken($proof), Support::now(), Support::plus(1800), $id]);

        return ['signupToken' => $proof];
    }

    public static function consume(string $proof): string
    {
        $proof = trim($proof);
        if ($proof === '') {
            throw new AuthException('Confirm the email code before creating the account.', 422);
        }

        $statement = Connection::pdo()->prepare(
            'SELECT * FROM signup_challenges
             WHERE proof_hash = ? AND verified_at IS NOT NULL AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()
             LIMIT 1',
        );
        $statement->execute([Support::hashToken($proof)]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new AuthException('Confirm the email code again. This step has expired.', 422);
        }

        $mark = Connection::pdo()->prepare(
            'UPDATE signup_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL',
        );
        $mark->execute([Support::now(), $row['id']]);
        if ($mark->rowCount() !== 1) {
            throw new AuthException('Confirm the email code again. This step has expired.', 422);
        }

        return (string) $row['email'];
    }
}
