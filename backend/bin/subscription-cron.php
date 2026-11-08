<?php

declare(strict_types=1);

/**
 * Run daily from cron:
 * php /path/to/backend/bin/subscription-cron.php
 */

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Environment;
use App\Subscription\SubscriptionDeliveryGenerator;

$root = dirname(__DIR__);
Environment::boot($root);

$deliveries = SubscriptionDeliveryGenerator::runScheduledJobs();
$reminders = SubscriptionDeliveryGenerator::sendRenewalReminders();
$expired = SubscriptionDeliveryGenerator::expireSubscriptions();

fwrite(STDOUT, json_encode($deliveries + $reminders + $expired, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
