<?php

declare(strict_types=1);

namespace App\Location;

final class ServiceArea
{
    public const OUTSIDE_SERVICE_MESSAGE = 'We deliver only in Visakhapatnam (Vizag). Choose an address inside our service area.';

    /** @param array{pins: array<string, array<string, mixed>>, zones: list<array<string, mixed>>} $config */
    public function __construct(private array $config)
    {
    }

    public static function load(): self
    {
        $pins = [];
        $zones = [];

        foreach (LocationStore::all() as $location) {
            $center = self::centerOf($location);
            if ($center !== null) {
                foreach ($location['pins'] ?? [] as $pin) {
                    $code = (string) $pin;
                    if ($code === '' || isset($pins[$code])) {
                        continue;
                    }
                    $pins[$code] = [
                        'city' => (string) ($location['city'] ?? ''),
                        'state' => (string) ($location['state'] ?? ''),
                        'latitude' => $center[0],
                        'longitude' => $center[1],
                    ];
                }
            }

            $zone = [
                'id' => (string) ($location['id'] ?? ''),
                'name' => (string) ($location['name'] ?? 'Service area'),
                'quick' => !empty($location['quick']),
                'subscription' => !empty($location['subscription']),
                'priority' => (int) ($location['priority'] ?? 0),
                'pins' => array_values(array_filter(array_map(
                    static fn (mixed $pin): string => preg_replace('/\D/', '', (string) $pin) ?? '',
                    is_array($location['pins'] ?? null) ? $location['pins'] : [],
                ))),
            ];
            if (is_array($location['polygon'] ?? null)) {
                $zone['polygon'] = $location['polygon'];
            }
            if (is_array($location['circle'] ?? null)) {
                $zone['circle'] = $location['circle'];
            }
            $zones[] = $zone;
        }

        /** @var array{pins: array<string, array<string, mixed>>} $directory */
        $directory = require dirname(__DIR__, 2) . '/config/service_areas.php';
        foreach ($directory['pins'] as $code => $place) {
            if (!isset($pins[$code]) && is_array($place)) {
                $pins[(string) $code] = $place;
            }
        }

        usort($zones, static function (array $a, array $b): int {
            return ($b['priority'] ?? 0) <=> ($a['priority'] ?? 0);
        });

        return new self(['pins' => $pins, 'zones' => $zones]);
    }

    /** @param array<string, mixed> $location @return array{0: float, 1: float}|null */
    private static function centerOf(array $location): ?array
    {
        $circle = $location['circle'] ?? null;
        if (is_array($circle) && isset($circle['latitude'], $circle['longitude'])) {
            return [(float) $circle['latitude'], (float) $circle['longitude']];
        }

        $polygon = $location['polygon'] ?? null;
        if (!is_array($polygon) || $polygon === []) {
            return null;
        }

        $latitude = 0.0;
        $longitude = 0.0;
        $count = 0;
        foreach ($polygon as $point) {
            if (!is_array($point) || count($point) < 2) {
                continue;
            }
            $latitude += (float) $point[0];
            $longitude += (float) $point[1];
            $count++;
        }

        return $count > 0 ? [$latitude / $count, $longitude / $count] : null;
    }

    /** @return array<string, mixed>|null */
    public function pin(string $pin): ?array
    {
        $place = $this->config['pins'][$pin] ?? null;

        return is_array($place) ? $place : null;
    }

    /** @return array<string, mixed>|null */
    public function nearestPin(float $latitude, float $longitude, float $withinKm = 20): ?array
    {
        $best = null;
        $bestKm = $withinKm;

        foreach ($this->config['pins'] as $code => $place) {
            if (!is_array($place)) {
                continue;
            }

            $km = self::distanceKm(
                $latitude,
                $longitude,
                (float) $place['latitude'],
                (float) $place['longitude'],
            );

            if ($km <= $bestKm) {
                $bestKm = $km;
                $best = ['pin' => (string) $code, 'distanceKm' => round($km, 2)] + $place;
            }
        }

        return $best;
    }

    /**
     * @return array{quick: bool, subscription: bool, quickZones: list<string>, subscriptionZones: list<string>, selectedQuickZone: string, selectedSubscriptionZone: string}
     */
    public function check(?float $latitude, ?float $longitude, string $pin = ''): array
    {
        $quickZones = [];
        $subscriptionZones = [];
        $selectedQuick = '';
        $selectedSubscription = '';
        $pin = preg_replace('/\D/', '', $pin) ?? '';

        if ($latitude !== null && $longitude !== null || $pin !== '') {
            foreach ($this->config['zones'] as $zone) {
                $listedPin = $pin !== '' && in_array($pin, $zone['pins'] ?? [], true);
                $inside = $latitude !== null && $longitude !== null && $this->zoneContains($zone, $latitude, $longitude);
                if (!$listedPin && !$inside) {
                    continue;
                }

                $name = (string) ($zone['name'] ?? 'Service area');
                if (!empty($zone['quick'])) {
                    $quickZones[] = $name;
                    if ($selectedQuick === '') {
                        $selectedQuick = $name;
                    }
                }
                if (!empty($zone['subscription'])) {
                    $subscriptionZones[] = $name;
                    if ($selectedSubscription === '') {
                        $selectedSubscription = $name;
                    }
                }
            }
        }

        return [
            'quick' => $quickZones !== [],
            'subscription' => $subscriptionZones !== [],
            'quickZones' => array_values(array_unique($quickZones)),
            'subscriptionZones' => array_values(array_unique($subscriptionZones)),
            'selectedQuickZone' => $selectedQuick,
            'selectedSubscriptionZone' => $selectedSubscription,
        ];
    }

    /**
     * checkout — quick delivery: must be inside a zone marked for quick delivery.
     * subscription — must be inside a zone marked for subscription.
     * address — inside any store service zone (quick or subscription).
     *
     * @return array<string, mixed>
     */
    public function checkForPurpose(?float $latitude, ?float $longitude, string $pin, string $purpose): array
    {
        $result = $this->check($latitude, $longitude, $pin);
        $hasPoint = $latitude !== null && $longitude !== null;

        if ($purpose === 'subscription') {
            $result['allowed'] = $result['subscription'];
            $result['purpose'] = 'subscription';
        } elseif ($purpose === 'checkout') {
            $result['allowed'] = $result['quick'];
            $result['purpose'] = 'checkout';
        } else {
            $result['allowed'] = $result['quick'] || $result['subscription'];
            $result['purpose'] = 'address';
        }

        $result['message'] = $result['allowed'] || !$hasPoint
            ? ''
            : self::outsideMessage($result, $purpose);

        return $result;
    }

    /** @param array<string, mixed> $result */
    public static function outsideMessage(array $result, string $purpose = ''): string
    {
        $zones = array_values(array_unique(array_merge(
            is_array($result['quickZones'] ?? null) ? $result['quickZones'] : [],
            is_array($result['subscriptionZones'] ?? null) ? $result['subscriptionZones'] : [],
        )));
        if ($zones !== []) {
            $label = implode(', ', $zones);

            return 'This location is outside our delivery area. We currently serve: ' . $label . '.';
        }
        if ($purpose === 'subscription') {
            return self::OUTSIDE_SERVICE_MESSAGE;
        }

        return self::OUTSIDE_SERVICE_MESSAGE;
    }

    /** @param array<string, mixed> $zone */
    private function zoneContains(array $zone, float $latitude, float $longitude): bool
    {
        if (isset($zone['polygon']) && is_array($zone['polygon']) && self::pointInPolygon($latitude, $longitude, $zone['polygon'])) {
            return true;
        }

        if (!isset($zone['circle']) || !is_array($zone['circle'])) {
            return false;
        }

        $circle = $zone['circle'];
        $km = self::distanceKm(
            $latitude,
            $longitude,
            (float) $circle['latitude'],
            (float) $circle['longitude'],
        );

        return $km <= (float) $circle['radiusKm'];
    }

    public static function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earth = 6371.0;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);
        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return $earth * (2 * atan2(sqrt($a), sqrt(1 - $a)));
    }

    /** @param list<array{0: float|int, 1: float|int}> $polygon */
    public static function pointInPolygon(float $latitude, float $longitude, array $polygon): bool
    {
        $inside = false;
        $count = count($polygon);
        if ($count < 3) {
            return false;
        }

        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            $latI = (float) $polygon[$i][0];
            $lngI = (float) $polygon[$i][1];
            $latJ = (float) $polygon[$j][0];
            $lngJ = (float) $polygon[$j][1];
            $lngDelta = $lngJ - $lngI;
            $intersects = ($lngI > $longitude) !== ($lngJ > $longitude)
                && ($latitude < ($latJ - $latI) * ($longitude - $lngI) / ($lngDelta === 0.0 ? 1e-12 : $lngDelta) + $latI);
            if ($intersects) {
                $inside = !$inside;
            }
        }

        return $inside;
    }
}
