<?php

declare(strict_types=1);

namespace App\Auth;

use App\Admin\MailSettings;
use PHPMailer\PHPMailer\PHPMailer;

final class Mail
{
    public static function configured(): bool
    {
        $mail = self::credentials();

        return $mail['username'] !== '' && $mail['password'] !== '' && $mail['fromEmail'] !== '';
    }

    public static function send(string $email, string $name, string $subject, string $body): bool
    {
        $settings = self::credentials();
        if ($settings['username'] === '' || $settings['password'] === '' || $settings['fromEmail'] === '') {
            return false;
        }

        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $settings['host'];
        $mail->SMTPAuth = true;
        $mail->Username = $settings['username'];
        $mail->Password = $settings['password'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $settings['port'];
        $mail->CharSet = 'UTF-8';
        $mail->Timeout = 15;
        $mail->setFrom($settings['fromEmail'], $settings['fromName']);
        $mail->addAddress($email, $name);
        $mail->Subject = $subject;
        $mail->Body = $body;
        try {
            $mail->send();
        } catch (\Throwable) {
            return false;
        }

        return true;
    }

    /** @return array{host: string, port: int, username: string, password: string, fromEmail: string, fromName: string} */
    private static function credentials(): array
    {
        $saved = MailSettings::credentials();
        if ($saved !== null) {
            return $saved;
        }

        return [
            'host' => trim((string) ($_ENV['SMTP_HOST'] ?? '')) !== '' ? (string) $_ENV['SMTP_HOST'] : 'smtp.gmail.com',
            'port' => (int) ($_ENV['SMTP_PORT'] ?? 587) > 0 ? (int) $_ENV['SMTP_PORT'] : 587,
            'username' => trim((string) ($_ENV['SMTP_USERNAME'] ?? '')),
            'password' => (string) ($_ENV['SMTP_PASSWORD'] ?? ''),
            'fromEmail' => trim((string) ($_ENV['SMTP_FROM_EMAIL'] ?? '')),
            'fromName' => trim((string) ($_ENV['SMTP_FROM_NAME'] ?? '')) !== '' ? (string) $_ENV['SMTP_FROM_NAME'] : 'RudrasFarmFresh',
        ];
    }
}
