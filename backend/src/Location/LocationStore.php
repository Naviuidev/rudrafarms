<?php

declare(strict_types=1);

namespace App\Location;

use InvalidArgumentException;

final class LocationStore
{
    public static function path(): string
    {
        return dirname(__DIR__, 2) . '/storage/locations.json';
    }

    /** @return list<array<string, mixed>> */
    public static function all(): array
    {
        $path = self::path();
        if (!is_file($path)) {
            $locations = self::seed();
            self::write($locations);

            return $locations;
        }

        $raw = file_get_contents($path);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        $locations = is_array($decoded) ? ($decoded['locations'] ?? null) : null;

        return is_array($locations) ? array_values(array_filter($locations, 'is_array')) : [];
    }

    /** @param array<string, mixed> $input */
    public static function save(array $input): array
    {
        $locations = self::all();
        $location = self::validate($input, $locations);
        $replaced = false;

        foreach ($locations as $index => $current) {
            if (($current['id'] ?? '') === $location['id']) {
                $locations[$index] = $location;
                $replaced = true;
                break;
            }
        }

        if (!$replaced) {
            $locations[] = $location;
        }

        self::write($locations);

        return $location;
    }

    public static function delete(string $id): void
    {
        $id = trim($id);
        if ($id === '') {
            throw new InvalidArgumentException('Choose a location to delete.');
        }

        $locations = array_values(array_filter(
            self::all(),
            static fn (array $location): bool => ($location['id'] ?? '') !== $id,
        ));
        self::write($locations);
    }

    /** @param list<array<string, mixed>> $locations */
    private static function write(array $locations): void
    {
        $directory = dirname(self::path());
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new InvalidArgumentException('The server could not store locations.');
        }

        $encoded = json_encode(
            ['locations' => array_values($locations)],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
        if (!is_string($encoded) || file_put_contents(self::path(), $encoded . "\n", LOCK_EX) === false) {
            throw new InvalidArgumentException('The server could not store locations.');
        }
    }

    /**
     * @param list<array<string, mixed>> $locations
     * @return array<string, mixed>
     */
    private static function validate(array $input, array $locations): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
            throw new InvalidArgumentException('Enter a location name.');
        }

        $city = trim((string) ($input['city'] ?? ''));
        $state = trim((string) ($input['state'] ?? ''));
        if ($city === '' || $state === '') {
            throw new InvalidArgumentException('Enter the city and state.');
        }

        $pinSource = $input['pins'] ?? '';
        if (is_array($pinSource)) {
            $pinSource = implode(' ', array_map('strval', $pinSource));
        }
        $pins = [];
        foreach (preg_split('/[\s,]+/', (string) $pinSource) ?: [] as $pin) {
            $pin = preg_replace('/\D/', '', (string) $pin) ?? '';
            if ($pin === '') {
                continue;
            }
            if (!preg_match('/^[1-9][0-9]{5}$/', $pin)) {
                throw new InvalidArgumentException('Each PIN code must be 6 digits.');
            }
            $pins[] = $pin;
        }
        $pins = array_values(array_unique($pins));

        $circle = self::circle($input['circle'] ?? null);
        $polygon = self::polygon($input['polygon'] ?? null);
        if ($circle === null && $polygon === null) {
            throw new InvalidArgumentException('Add a center and radius, or a map outline of at least three points.');
        }

        $id = trim((string) ($input['id'] ?? ''));
        if ($id === '') {
            $id = self::uniqueId($name, $locations);
        }

        $priority = (int) ($input['priority'] ?? 0);

        return [
            'id' => $id,
            'name' => $name,
            'city' => $city,
            'state' => $state,
            'pins' => $pins,
            'quick' => filter_var($input['quick'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'subscription' => filter_var($input['subscription'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'priority' => $priority,
            'circle' => $circle,
            'polygon' => $polygon,
        ];
    }

    /** @param list<array<string, mixed>> $locations */
    private static function uniqueId(string $name, array $locations): string
    {
        $base = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $name) ?? '', '-')) ?: 'location';
        $ids = array_map(static fn (array $location): string => (string) ($location['id'] ?? ''), $locations);
        $id = $base;
        $suffix = 2;
        while (in_array($id, $ids, true)) {
            $id = $base . '-' . $suffix;
            $suffix++;
        }

        return $id;
    }

    /** @return array{latitude: float, longitude: float, radiusKm: float}|null */
    private static function circle(mixed $value): ?array
    {
        if (!is_array($value)) {
            return null;
        }

        $latitude = self::number($value['latitude'] ?? null);
        $longitude = self::number($value['longitude'] ?? null);
        $radius = self::number($value['radiusKm'] ?? null);
        if ($latitude === null && $longitude === null && ($radius === null || $radius === 0.0)) {
            return null;
        }
        if ($latitude === null || $longitude === null || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
            throw new InvalidArgumentException('Enter a valid center latitude and longitude.');
        }
        if ($radius === null || $radius <= 0 || $radius > 100) {
            throw new InvalidArgumentException('Enter a radius between 0 and 100 kilometres.');
        }

        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'radiusKm' => $radius,
        ];
    }

    /** @return list<array{0: float, 1: float}>|null */
    private static function polygon(mixed $value): ?array
    {
        if (!is_array($value) || $value === []) {
            return null;
        }

        $points = [];
        foreach ($value as $point) {
            if (!is_array($point) || count($point) < 2) {
                throw new InvalidArgumentException('Each outline point needs a latitude and longitude.');
            }
            $latitude = self::number($point[0]);
            $longitude = self::number($point[1]);
            if ($latitude === null || $longitude === null || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
                throw new InvalidArgumentException('The map outline has a point outside the valid range.');
            }
            $points[] = [$latitude, $longitude];
        }

        if (count($points) < 3) {
            throw new InvalidArgumentException('A map outline needs at least three points.');
        }

        return $points;
    }

    private static function number(mixed $value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }
        $number = (float) $value;

        return is_finite($number) ? $number : null;
    }

    /** @return list<array<string, mixed>> */
    private static function seed(): array
    {
        /** @var array{pins: array<string, array<string, mixed>>, zones: list<array<string, mixed>>} $config */
        $config = require dirname(__DIR__, 2) . '/config/service_areas.php';
        $locations = [];
        $assigned = [];

        foreach ($config['zones'] as $zone) {
            if (!is_array($zone)) {
                continue;
            }
            $pins = [];
            $city = '';
            $state = '';
            foreach ($config['pins'] as $code => $place) {
                if (!is_array($place) || isset($assigned[(string) $code])) {
                    continue;
                }
                if (!self::contains($zone, (float) $place['latitude'], (float) $place['longitude'])) {
                    continue;
                }
                if (self::tighterZone($config['zones'], $zone, (float) $place['latitude'], (float) $place['longitude'])) {
                    continue;
                }
                $pins[] = (string) $code;
                $assigned[(string) $code] = true;
                if ($city === '') {
                    $city = (string) ($place['city'] ?? '');
                    $state = (string) ($place['state'] ?? '');
                }
            }
            $locations[] = [
                'id' => (string) ($zone['id'] ?? ''),
                'name' => (string) ($zone['name'] ?? 'Service area'),
                'city' => $city,
                'state' => $state,
                'pins' => $pins,
                'subscription' => !empty($zone['subscription']),
                'circle' => is_array($zone['circle'] ?? null) ? $zone['circle'] : null,
                'polygon' => is_array($zone['polygon'] ?? null) ? $zone['polygon'] : null,
            ];
        }

        return $locations;
    }

    /** @param list<array<string, mixed>> $zones @param array<string, mixed> $zone */
    private static function tighterZone(array $zones, array $zone, float $latitude, float $longitude): bool
    {
        foreach ($zones as $other) {
            if (!is_array($other) || ($other['id'] ?? '') === ($zone['id'] ?? '')) {
                continue;
            }
            if (!self::contains($other, $latitude, $longitude)) {
                continue;
            }
            $otherPolygon = isset($other['polygon']) && is_array($other['polygon']);
            $zonePolygon = isset($zone['polygon']) && is_array($zone['polygon']);
            if ($otherPolygon && !$zonePolygon) {
                return true;
            }
            $otherRadius = is_array($other['circle'] ?? null) ? (float) $other['circle']['radiusKm'] : 1000;
            $zoneRadius = is_array($zone['circle'] ?? null) ? (float) $zone['circle']['radiusKm'] : 1000;
            if (!$otherPolygon && !$zonePolygon && $otherRadius < $zoneRadius) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $zone */
    private static function contains(array $zone, float $latitude, float $longitude): bool
    {
        if (isset($zone['polygon']) && is_array($zone['polygon']) && ServiceArea::pointInPolygon($latitude, $longitude, $zone['polygon'])) {
            return true;
        }
        if (!isset($zone['circle']) || !is_array($zone['circle'])) {
            return false;
        }

        $distance = ServiceArea::distanceKm(
            $latitude,
            $longitude,
            (float) $zone['circle']['latitude'],
            (float) $zone['circle']['longitude'],
        );

        return $distance <= (float) $zone['circle']['radiusKm'];
    }
}
