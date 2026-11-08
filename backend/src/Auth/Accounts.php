<?php

declare(strict_types=1);

namespace App\Auth;

use App\Http\Json;

final class Accounts
{
    public static function boot(): void
    {
        Schema::ensure();
    }

    /** @param callable(): array<string, mixed> $action */
    public static function handle(callable $action): never
    {
        try {
            self::boot();
            Json::send($action());
        } catch (AuthException $exception) {
            $payload = ['message' => $exception->getMessage()];
            if ($exception->errors() !== []) {
                $payload['errors'] = $exception->errors();
            }
            if ($exception->codeName() !== '') {
                $payload['code'] = $exception->codeName();
            }
            Json::send($payload, $exception->status());
        } catch (\Throwable) {
            Json::send(['message' => 'The account service is unavailable.'], 500);
        }
    }

    /** @return array<string, mixed> */
    public static function config(): array
    {
        return [
            'emailVerification' => Mail::configured(),
            'otp' => Support::otpEnabled(),
        ];
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function register(array $input): array
    {
        $first = trim((string) ($input['firstName'] ?? ''));
        $last = trim((string) ($input['lastName'] ?? ''));
        $name = trim($first . ' ' . $last);
        $password = (string) ($input['password'] ?? '');
        $errors = [];
        if (mb_strlen($first) < 1 || mb_strlen($first) > 40) {
            $errors['firstName'] = 'Enter your first name.';
        }
        if (mb_strlen($last) < 1 || mb_strlen($last) > 40) {
            $errors['lastName'] = 'Enter your last name.';
        }
        if ($errors === [] && (mb_strlen($name) < 2 || mb_strlen($name) > 80)) {
            $errors['firstName'] = 'Enter a shorter name.';
        }
        if (strlen($password) < 8 || strlen($password) > 72) {
            $errors['password'] = 'Use a password between 8 and 72 characters.';
        }
        if ($errors !== []) {
            throw new AuthException('Check the highlighted fields.', 422, $errors);
        }

        $email = Signup::consume((string) ($input['signupToken'] ?? ''));
        if (Customers::emailTaken($email)) {
            throw new AuthException('An account with this email already exists.', 422, [
                'email' => 'An account with this email already exists.',
            ]);
        }

        $id = Customers::create([
            'name' => $name,
            'email' => $email,
            'phone' => null,
            'password' => $password,
            'verified' => true,
        ]);
        $customer = Customers::find($id);
        if ($customer === null) {
            throw new AuthException('The account could not be created.', 500);
        }

        return [
            'created' => true,
            'message' => 'Your account is ready. Sign in with this email and password.',
        ];
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function login(array $input): array
    {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $row = Customers::findByEmail($email);
        if (!Customers::verifyPassword($password, $row) || !is_array($row)) {
            throw new AuthException('The email or password is incorrect.', 401);
        }
        if (Mail::configured() && ($row['email_verified_at'] === null || $row['email_verified_at'] === '')) {
            throw new AuthException(
                'Verify your email before signing in. Use the link from your inbox, or send a new one.',
                403,
                [],
                'email_unverified',
            );
        }

        return self::afterPassword($row);
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function confirmOtp(array $input): array
    {
        $id = trim((string) ($input['challengeId'] ?? ''));
        $code = preg_replace('/\D/', '', (string) ($input['code'] ?? '')) ?? '';
        if ($id === '' || !preg_match('/^\d{6}$/', $code)) {
            throw new AuthException('Enter the 6-digit code.', 422, ['code' => 'Enter the 6-digit code.']);
        }
        $customer = Tokens::confirmOtp($id, $code);
        if ($customer === null) {
            throw new AuthException('That code is incorrect or has expired.', 422, [
                'code' => 'That code is incorrect or has expired.',
            ]);
        }

        return self::session($customer);
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function forgot(array $input): array
    {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $response = ['message' => 'If an account exists for that email, a reset link is on its way.'];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new AuthException('Enter a valid email address.', 422, [
                'email' => 'Enter a valid email address.',
            ]);
        }
        $customer = Customers::findByEmail($email);
        if ($customer === null) {
            return $response;
        }

        $token = Tokens::issue((string) $customer['id'], 'reset', 3600);
        $url = Support::customerUrl() . '/reset-password?token=' . rawurlencode($token);
        $sent = Mail::send(
            (string) $customer['email'],
            (string) $customer['name'],
            'Reset your RudrasFarmFresh password',
            "Use this link within one hour to choose a new password:\n{$url}\n",
        );
        if (!$sent && Support::local()) {
            $response['previewUrl'] = $url;
        }

        return $response;
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function reset(array $input): array
    {
        $token = trim((string) ($input['token'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        Support::password($password);
        $row = $token === '' ? null : Tokens::consume($token, 'reset');
        if ($row === null) {
            throw new AuthException('This reset link is invalid or has expired.');
        }
        $id = (string) $row['customer_id'];
        Customers::updatePassword($id, $password);
        Tokens::revoke($id, 'session');

        return ['message' => 'Your password has been updated. Sign in with the new password.'];
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function verifyEmail(array $input): array
    {
        $token = trim((string) ($input['token'] ?? ''));
        $row = $token === '' ? null : Tokens::consume($token, 'verify');
        if ($row === null) {
            throw new AuthException('This verification link is invalid or has expired.');
        }
        Customers::markVerified((string) $row['customer_id']);

        return ['message' => 'Your email is verified. You can sign in.'];
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function resendVerification(array $input): array
    {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new AuthException('Enter a valid email address.', 422, [
                'email' => 'Enter a valid email address.',
            ]);
        }
        $customer = Customers::findByEmail($email);
        if (!is_array($customer) || $customer['email_verified_at'] !== null) {
            return ['message' => 'If the account still needs verification, a new link is on its way.'];
        }

        return self::verificationChallenge($customer) + [
            'message' => 'If the account still needs verification, a new link is on its way.',
        ];
    }

    /** @param array<string, mixed> $customer @param array<string, mixed> $input @return array<string, mixed> */
    public static function updateProfile(array $customer, array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $phone = self::optionalPhone($input['phone'] ?? '');
        $errors = [];
        if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
            $errors['name'] = 'Enter your name.';
        }
        if ($phone === false) {
            $errors['phone'] = 'Enter a 10-digit mobile number, or leave it blank.';
        }
        if ($errors !== []) {
            throw new AuthException('Check the highlighted fields.', 422, $errors);
        }
        Customers::updateProfile((string) $customer['id'], $name, $phone === '' ? null : $phone);
        $fresh = Customers::find((string) $customer['id']);
        if ($fresh === null) {
            throw new AuthException('The profile could not be saved.', 500);
        }

        return ['customer' => Support::customer($fresh)];
    }

    /** @param array<string, mixed> $customer @param array<string, mixed> $input @return array<string, mixed> */
    public static function changePassword(array $customer, array $input): array
    {
        $current = (string) ($input['currentPassword'] ?? '');
        $password = (string) ($input['password'] ?? '');
        Support::password($password);
        $row = Customers::find((string) $customer['id']);
        if (!Customers::verifyPassword($current, $row)) {
            throw new AuthException('The current password is incorrect.', 422, [
                'currentPassword' => 'The current password is incorrect.',
            ]);
        }
        Customers::updatePassword((string) $customer['id'], $password);
        Tokens::revoke((string) $customer['id'], 'session');

        return self::session($row ?? $customer);
    }

    /** @return array<string, mixed> */
    public static function bearerCustomer(): array
    {
        $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/^Bearer\s+(\S+)$/i', $header, $match) !== 1) {
            throw new AuthException('Sign in to continue.', 401);
        }
        $customer = Tokens::sessionCustomer($match[1]);
        if ($customer === null) {
            throw new AuthException('Sign in to continue.', 401);
        }

        return $customer;
    }

    public static function logout(): array
    {
        $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/^Bearer\s+(\S+)$/i', $header, $match) === 1) {
            Tokens::revokeSession($match[1]);
        }

        return ['ok' => true];
    }

    /** @param array<string, mixed> $customer @return array<string, mixed> */
    public static function current(array $customer): array
    {
        return [
            'customer' => Support::customer($customer),
            'addresses' => Addresses::all((string) $customer['id']),
        ];
    }

    /** @param array<string, mixed> $customer @return array<string, mixed> */
    private static function afterPassword(array $customer): array
    {
        if (!Support::otpEnabled()) {
            return self::session($customer);
        }

        $otp = Tokens::issueOtp((string) $customer['id']);
        $response = [
            'otpRequired' => true,
            'challengeId' => $otp['id'],
        ];
        $sent = Mail::send(
            (string) $customer['email'],
            (string) $customer['name'],
            'Your RudrasFarmFresh sign-in code',
            "Your sign-in code is {$otp['code']}. It expires in 10 minutes.\n",
        );
        if (!$sent && Support::local()) {
            $response['previewCode'] = $otp['code'];
        }

        return $response;
    }

    /** @param array<string, mixed> $customer @return array<string, mixed> */
    private static function session(array $customer): array
    {
        $token = Tokens::issue((string) $customer['id'], 'session', 60 * 60 * 24 * 30);

        return [
            'token' => $token,
            'customer' => Support::customer($customer),
            'addresses' => Addresses::all((string) $customer['id']),
        ];
    }

    /** @param array<string, mixed> $customer @return array<string, mixed> */
    private static function verificationChallenge(array $customer): array
    {
        $token = Tokens::issue((string) $customer['id'], 'verify', 60 * 60 * 24);
        $url = Support::customerUrl() . '/verify-email?token=' . rawurlencode($token);
        $sent = Mail::send(
            (string) $customer['email'],
            (string) $customer['name'],
            'Verify your RudrasFarmFresh email',
            "Confirm your email within 24 hours:\n{$url}\n",
        );
        $response = [
            'verificationRequired' => true,
            'message' => 'Check your email for a verification link before signing in.',
        ];
        if (!$sent && Support::local()) {
            $response['previewUrl'] = $url;
        }

        return $response;
    }

    private static function optionalPhone(mixed $value): string|false|null
    {
        $phone = preg_replace('/\D/', '', (string) $value) ?? '';
        if ($phone === '') {
            return '';
        }
        if (!preg_match('/^[6-9]\d{9}$/', $phone)) {
            return false;
        }

        return $phone;
    }
}
