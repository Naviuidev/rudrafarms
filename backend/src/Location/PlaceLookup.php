<?php

declare(strict_types=1);

namespace App\Location;

final class PlaceLookup
{
    public function __construct(private ServiceArea $areas, private string $apiKey)
    {
    }

    public function placesAvailable(): bool
    {
        return $this->apiKey !== '';
    }

    /** @return list<array{id: string, label: string, secondary: string}> */
    public function suggest(string $input): array
    {
        if ($this->apiKey === '' || mb_strlen(trim($input)) < 3) {
            return [];
        }

        $payload = $this->request('https://places.googleapis.com/v1/places:autocomplete', [
            'input' => trim($input),
            'includedRegionCodes' => ['in'],
            'languageCode' => 'en',
        ], ['X-Goog-Api-Key: ' . $this->apiKey]);

        if ($payload === null) {
            return [];
        }

        $suggestions = [];
        foreach ($payload['suggestions'] ?? [] as $suggestion) {
            if (!is_array($suggestion)) {
                continue;
            }
            $prediction = $suggestion['placePrediction'] ?? null;
            if (!is_array($prediction) || !isset($prediction['placeId'])) {
                continue;
            }
            $main = $prediction['structuredFormat']['mainText']['text'] ?? $prediction['text']['text'] ?? '';
            $secondary = $prediction['structuredFormat']['secondaryText']['text'] ?? '';
            $suggestions[] = [
                'id' => (string) $prediction['placeId'],
                'label' => (string) $main,
                'secondary' => (string) $secondary,
            ];
        }

        return $suggestions;
    }

    /** @param array<string, mixed> $input */
    public function resolve(array $input): array
    {
        $placeId = trim((string) ($input['placeId'] ?? ''));
        if ($placeId !== '') {
            if ($this->apiKey === '') {
                return $this->miss('Place search needs the Google key on the server.');
            }

            $place = $this->placeDetails($placeId);
            if ($place === null) {
                return $this->miss('That place could not be loaded. Try the map pin or a PIN code.');
            }

            return $place;
        }

        $pin = preg_replace('/\D/', '', (string) ($input['pin'] ?? '')) ?? '';
        $latitude = self::coordinate($input['latitude'] ?? null);
        $longitude = self::coordinate($input['longitude'] ?? null);

        if ($pin !== '' && !preg_match('/^[1-9][0-9]{5}$/', $pin)) {
            return $this->miss('Enter a 6-digit PIN code.');
        }

        if ($pin !== '' && $latitude === null && $longitude === null) {
            $known = $this->areas->pin($pin);
            if ($known !== null) {
                return $this->found(
                    $pin,
                    (string) $known['city'],
                    (string) $known['state'],
                    (float) $known['latitude'],
                    (float) $known['longitude'],
                );
            }

            if ($this->apiKey !== '') {
                $geocoded = $this->geocode('components=' . rawurlencode('postal_code:' . $pin . '|country:IN'));
                if ($geocoded !== null) {
                    return $geocoded;
                }
            }

            return $this->lookupIndianPin($pin);
        }

        if ($latitude === null || $longitude === null) {
            return $this->miss('Choose a point on the map or enter a PIN code.');
        }

        if ($this->apiKey !== '') {
            $reversed = $this->geocode('latlng=' . rawurlencode($latitude . ',' . $longitude));
            if ($reversed !== null) {
                $reversed['latitude'] = $latitude;
                $reversed['longitude'] = $longitude;
                $reversed['serviceability'] = $this->areas->check($latitude, $longitude);

                return $reversed;
            }
        }

        $near = $this->areas->nearestPin($latitude, $longitude, 12);
        if ($near !== null) {
            return $this->found(
                (string) $near['pin'],
                (string) $near['city'],
                (string) $near['state'],
                $latitude,
                $longitude,
            );
        }

        return $this->found('', '', '', $latitude, $longitude);
    }

    /** @return array<string, mixed> */
    private function lookupIndianPin(string $pin): array
    {
        $office = $this->postalOffice($pin);
        $point = $this->nominatimPin($pin);
        if ($point === null) {
            if ($office !== null) {
                return $this->miss('This PIN was found, but its map point could not be loaded. Try again.');
            }

            return $this->miss('This PIN could not be found. Check the 6-digit code and try again.');
        }

        $city = $office !== null && $office['city'] !== '' ? $office['city'] : $point['city'];
        $state = $office !== null && $office['state'] !== '' ? $office['state'] : $point['state'];
        $locality = $office !== null && $office['locality'] !== '' ? $office['locality'] : $city;
        $result = $this->found($pin, $city, $state, $point['latitude'], $point['longitude']);
        $result['locality'] = $locality;

        return $result;
    }

    /** @return array{locality: string, city: string, state: string}|null */
    private function postalOffice(string $pin): ?array
    {
        $payload = $this->request(
            'https://api.postalpincode.in/pincode/' . rawurlencode($pin),
            null,
            [],
            'RudrasFarmFresh/1.0',
        );
        $entry = is_array($payload) ? ($payload[0] ?? null) : null;
        if (!is_array($entry) || ($entry['Status'] ?? '') !== 'Success' || !is_array($entry['PostOffice'] ?? null)) {
            return null;
        }

        $office = $entry['PostOffice'][0] ?? null;
        if (!is_array($office)) {
            return null;
        }

        return [
            'locality' => trim((string) ($office['Name'] ?? '')),
            'city' => trim((string) ($office['District'] ?? '')),
            'state' => trim((string) ($office['State'] ?? '')),
        ];
    }

    /** @return array{latitude: float, longitude: float, city: string, state: string}|null */
    private function nominatimPin(string $pin): ?array
    {
        $query = http_build_query([
            'format' => 'jsonv2',
            'limit' => 1,
            'countrycodes' => 'in',
            'postalcode' => $pin,
            'addressdetails' => 1,
        ]);
        $payload = $this->request(
            'https://nominatim.openstreetmap.org/search?' . $query,
            null,
            ['Accept-Language: en'],
            'RudrasFarmFresh/1.0 (admin location lookup)',
        );
        $place = is_array($payload) ? ($payload[0] ?? null) : null;
        if (!is_array($place) || !is_numeric($place['lat'] ?? null) || !is_numeric($place['lon'] ?? null)) {
            return null;
        }

        $address = is_array($place['address'] ?? null) ? $place['address'] : [];
        $city = (string) ($address['city'] ?? $address['town'] ?? $address['state_district'] ?? $address['county'] ?? '');

        return [
            'latitude' => (float) $place['lat'],
            'longitude' => (float) $place['lon'],
            'city' => trim($city),
            'state' => trim((string) ($address['state'] ?? '')),
        ];
    }

    /** @return array<string, mixed>|null */
    private function placeDetails(string $placeId): ?array
    {
        $payload = $this->request(
            'https://places.googleapis.com/v1/places/' . rawurlencode($placeId),
            null,
            [
                'X-Goog-Api-Key: ' . $this->apiKey,
                'X-Goog-FieldMask: location,addressComponents',
            ],
        );

        if ($payload === null || !isset($payload['location']['latitude'], $payload['location']['longitude'])) {
            return null;
        }

        $parts = self::fromGoogleComponents($payload['addressComponents'] ?? [], true);

        return $this->found(
            $parts['pin'],
            $parts['city'],
            $parts['state'],
            (float) $payload['location']['latitude'],
            (float) $payload['location']['longitude'],
        );
    }

    /** @return array<string, mixed>|null */
    private function geocode(string $query): ?array
    {
        $payload = $this->request(
            'https://maps.googleapis.com/maps/api/geocode/json?' . $query . '&key=' . rawurlencode($this->apiKey),
        );

        if (!is_array($payload) || ($payload['status'] ?? '') !== 'OK') {
            return null;
        }

        $result = $payload['results'][0] ?? null;
        if (!is_array($result)) {
            return null;
        }

        $location = $result['geometry']['location'] ?? null;
        if (!is_array($location) || !isset($location['lat'], $location['lng'])) {
            return null;
        }

        $parts = self::fromGoogleComponents($result['address_components'] ?? [], false);

        return $this->found(
            $parts['pin'],
            $parts['city'],
            $parts['state'],
            (float) $location['lat'],
            (float) $location['lng'],
        );
    }

    /**
     * @param mixed $components
     * @return array{pin: string, city: string, state: string}
     */
    private static function fromGoogleComponents(mixed $components, bool $placesApi): array
    {
        $pin = '';
        $city = '';
        $state = '';
        if (!is_array($components)) {
            return ['pin' => '', 'city' => '', 'state' => ''];
        }

        foreach ($components as $component) {
            if (!is_array($component)) {
                continue;
            }
            $types = $component['types'] ?? [];
            if (!is_array($types)) {
                continue;
            }
            $name = $placesApi
                ? (string) ($component['longText'] ?? '')
                : (string) ($component['long_name'] ?? '');
            if (in_array('postal_code', $types, true)) {
                $pin = preg_replace('/\D/', '', $name) ?? '';
            } elseif ($city === '' && (in_array('locality', $types, true) || in_array('administrative_area_level_2', $types, true))) {
                $city = $name;
            } elseif (in_array('administrative_area_level_1', $types, true)) {
                $state = $name;
            }
        }

        return ['pin' => $pin, 'city' => $city, 'state' => $state];
    }

    /** @return array<string, mixed> */
    private function found(string $pin, string $city, string $state, float $latitude, float $longitude): array
    {
        return [
            'found' => true,
            'pin' => $pin,
            'city' => $city,
            'state' => $state,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'serviceability' => $this->areas->check($latitude, $longitude),
        ];
    }

    /** @return array{found: false, message: string} */
    private function miss(string $message): array
    {
        return ['found' => false, 'message' => $message];
    }

    private static function coordinate(mixed $value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }

        $number = (float) $value;
        if (!is_finite($number)) {
            return null;
        }

        return $number;
    }

    /** @param list<string> $headers */
    private function request(string $url, ?array $json = null, array $headers = [], ?string $userAgent = null): ?array
    {
        $handle = curl_init($url);
        if ($handle === false) {
            return null;
        }

        $httpHeaders = $headers;
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
        ];
        if ($userAgent !== null) {
            $options[CURLOPT_USERAGENT] = $userAgent;
        }
        curl_setopt_array($handle, $options);

        if ($json !== null) {
            $httpHeaders[] = 'Content-Type: application/json';
            curl_setopt($handle, CURLOPT_POST, true);
            curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($json));
        }

        if ($httpHeaders !== []) {
            curl_setopt($handle, CURLOPT_HTTPHEADER, $httpHeaders);
        }

        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);

        if (!is_string($body) || $status < 200 || $status >= 300) {
            return null;
        }

        $decoded = json_decode($body, true);

        return is_array($decoded) ? $decoded : null;
    }
}
