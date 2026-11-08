<?php

declare(strict_types=1);

namespace App\Design;

use App\Auth\Support;
use InvalidArgumentException;

final class HeroStore
{
    public static function path(): string
    {
        return dirname(__DIR__, 2) . '/storage/hero.json';
    }

    /** @return array<string, mixed> */
    public static function get(): array
    {
        $document = self::document();
        $publishedId = (string) ($document['publishedId'] ?? '');
        foreach ($document['sections'] as $section) {
            if (!is_array($section)) {
                continue;
            }
            if (($section['id'] ?? '') === $publishedId) {
                return self::normalizeHero($section);
            }
        }
        $first = $document['sections'][0] ?? null;

        return self::normalizeHero(is_array($first) ? $first : self::defaults());
    }

    /** @return array{publishedId: string, sections: list<array<string, mixed>>} */
    public static function library(): array
    {
        $document = self::document();

        return [
            'publishedId' => (string) ($document['publishedId'] ?? ''),
            'sections' => array_map(static fn (array $section): array => self::presentSection($section), $document['sections']),
        ];
    }

    /** @param array<string, mixed> $input @return array{publishedId: string, sections: list<array<string, mixed>>} */
    public static function saveSection(array $input): array
    {
        $document = self::document();
        $id = trim((string) ($input['id'] ?? ''));
        if ($id === '') {
            throw new InvalidArgumentException('That hero section could not be found.');
        }

        $hero = self::normalizeHero($input);
        $name = self::text($input['name'] ?? '', 80) ?: self::sectionName($hero);
        $now = Support::now();
        $replaced = false;
        foreach ($document['sections'] as $index => $section) {
            if (!is_array($section) || ($section['id'] ?? '') !== $id) {
                continue;
            }
            $document['sections'][$index] = array_merge($hero, [
                'id' => $id,
                'name' => $name,
                'updatedAt' => $now,
            ]);
            $replaced = true;
            break;
        }
        if (!$replaced) {
            throw new InvalidArgumentException('That hero section could not be found.');
        }

        self::writeDocument($document);

        return self::library();
    }

    /** @param array<string, mixed> $input @return array{publishedId: string, sections: list<array<string, mixed>>} */
    public static function createSection(array $input = []): array
    {
        $document = self::document();
        $layout = self::layoutId($input['layout'] ?? 'split');
        $hero = self::preset($layout);
        $section = array_merge($hero, [
            'id' => Support::uuid(),
            'name' => self::layoutName($layout),
            'updatedAt' => Support::now(),
        ]);
        $document['sections'][] = $section;
        if ($document['publishedId'] === '') {
            $document['publishedId'] = (string) $section['id'];
        }
        self::writeDocument($document);

        return self::library();
    }

    /** @return array{publishedId: string, sections: list<array<string, mixed>>} */
    public static function publish(string $id): array
    {
        $document = self::document();
        $id = trim($id);
        $found = false;
        foreach ($document['sections'] as $section) {
            if (is_array($section) && ($section['id'] ?? '') === $id) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            throw new InvalidArgumentException('That hero section could not be found.');
        }
        $document['publishedId'] = $id;
        self::writeDocument($document);

        return self::library();
    }

    /** @return array{publishedId: string, sections: list<array<string, mixed>>} */
    public static function deleteSection(string $id): array
    {
        $document = self::document();
        $id = trim($id);
        $remaining = array_values(array_filter(
            $document['sections'],
            static fn (mixed $section): bool => is_array($section) && ($section['id'] ?? '') !== $id,
        ));
        if (count($remaining) === count($document['sections'])) {
            throw new InvalidArgumentException('That hero section could not be found.');
        }
        if ($remaining === []) {
            $id = Support::uuid();
            $remaining = [array_merge(self::defaults(), [
                'id' => $id,
                'name' => 'Home hero',
                'updatedAt' => Support::now(),
            ])];
            $document['publishedId'] = $id;
        }
        $document['sections'] = $remaining;
        if ($document['publishedId'] === $id) {
            $document['publishedId'] = (string) ($remaining[0]['id'] ?? '');
        }
        self::writeDocument($document);

        return self::library();
    }

    /** @return array{publishedId: string, sections: list<array<string, mixed>>} */
    private static function document(): array
    {
        $path = self::path();
        if (!is_file($path)) {
            $document = self::seedDocument();
            self::writeDocument($document);

            return $document;
        }

        $raw = file_get_contents($path);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($decoded)) {
            $document = self::seedDocument();
            self::writeDocument($document);

            return $document;
        }

        if (isset($decoded['sections']) && is_array($decoded['sections'])) {
            return self::normalizeDocument($decoded);
        }

        if (isset($decoded['hero']) && is_array($decoded['hero'])) {
            $id = Support::uuid();
            $document = [
                'publishedId' => $id,
                'sections' => [array_merge(self::normalizeHero($decoded['hero']), [
                    'id' => $id,
                    'name' => 'Home hero',
                    'updatedAt' => Support::now(),
                ])],
            ];
            self::writeDocument($document);

            return $document;
        }

        $document = self::seedDocument();
        self::writeDocument($document);

        return $document;
    }

    /** @return array{publishedId: string, sections: list<array<string, mixed>>} */
    private static function seedDocument(): array
    {
        $id = Support::uuid();
        $hero = self::defaults();

        return [
            'publishedId' => $id,
            'sections' => [array_merge($hero, [
                'id' => $id,
                'name' => 'Home hero',
                'updatedAt' => Support::now(),
            ])],
        ];
    }

    /** @param array<string, mixed> $decoded @return array{publishedId: string, sections: list<array<string, mixed>>} */
    private static function normalizeDocument(array $decoded): array
    {
        $sections = [];
        foreach ($decoded['sections'] as $section) {
            if (!is_array($section)) {
                continue;
            }
            $id = trim((string) ($section['id'] ?? ''));
            if ($id === '') {
                $id = Support::uuid();
            }
            $hero = self::normalizeHero($section);
            $sections[] = array_merge($hero, [
                'id' => $id,
                'name' => self::text($section['name'] ?? '', 80) ?: self::sectionName($hero),
                'updatedAt' => (string) ($section['updatedAt'] ?? Support::now()),
            ]);
        }
        if ($sections === []) {
            return self::seedDocument();
        }
        $publishedId = trim((string) ($decoded['publishedId'] ?? ''));
        $ids = array_map(static fn (array $section): string => (string) $section['id'], $sections);
        if ($publishedId === '' || !in_array($publishedId, $ids, true)) {
            $publishedId = $ids[0];
        }

        return ['publishedId' => $publishedId, 'sections' => $sections];
    }

    /** @param array<string, mixed> $section @return array<string, mixed> */
    private static function presentSection(array $section): array
    {
        $hero = self::normalizeHero($section);

        return array_merge($hero, [
            'id' => (string) ($section['id'] ?? ''),
            'name' => self::text($section['name'] ?? '', 80) ?: self::sectionName($hero),
            'updatedAt' => (string) ($section['updatedAt'] ?? ''),
        ]);
    }

    /** @param array<string, mixed> $hero */
    private static function sectionName(array $hero): string
    {
        $title = trim((string) ($hero['title'] ?? ''));
        if ($title !== '') {
            return strlen($title) > 48 ? substr($title, 0, 48) . '…' : $title;
        }

        return 'Hero section';
    }

    private static function layoutId(mixed $value): string
    {
        $layout = strtolower(trim((string) $value));

        return in_array($layout, ['split', 'banner', 'portrait', 'center'], true) ? $layout : 'split';
    }

    private static function layoutName(string $layout): string
    {
        return match ($layout) {
            'banner' => 'Photo banner',
            'portrait' => 'Portrait banner',
            'center' => 'Centered hero',
            default => 'Split hero',
        };
    }

    /** @return array<string, mixed> */
    private static function preset(string $layout): array
    {
        $hero = self::defaults();
        $hero['layout'] = $layout;
        if ($layout === 'banner') {
            $hero['title'] = 'Fresh from the farm, every morning.';
            $hero['description'] = 'Milk, curd, and produce delivered to your door.';
            $hero['primaryCta'] = ['label' => 'Shop the farm', 'to' => '/shop'];
            $hero['secondaryCta'] = ['label' => '', 'to' => '/shop'];
            $hero['showHeroImage'] = false;
            $hero['backgroundMode'] = 'image';
            $hero['backgroundImage'] = '/images/hero.svg';
        }
        if ($layout === 'portrait') {
            $hero['title'] = 'Farm fresh, at your door.';
            $hero['description'] = 'A daily drop of milk and pantry staples.';
            $hero['primaryCta'] = ['label' => 'Start a subscription', 'to' => '/subscriptions'];
            $hero['secondaryCta'] = ['label' => '', 'to' => '/shop'];
            $hero['showHeroImage'] = true;
            $hero['backgroundMode'] = 'image';
            $hero['backgroundImage'] = '/images/hero.svg';
        }
        if ($layout === 'center') {
            $hero['eyebrow'] = 'Rudras Farm Fresh';
            $hero['title'] = 'The morning farm, delivered.';
            $hero['description'] = 'Subscribe once. We bring the farm to your door.';
            $hero['primaryCta'] = ['label' => 'Start a subscription', 'to' => '/subscriptions'];
            $hero['secondaryCta'] = ['label' => 'Order for today', 'to' => '/quick-delivery'];
            $hero['showHeroImage'] = false;
            $hero['backgroundMode'] = 'image';
            $hero['backgroundImage'] = '/images/hero.svg';
        }

        return $hero;
    }

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        return [
            'eyebrow' => 'Farm to home',
            'title' => 'Fresh from the farm, at your door every morning.',
            'description' => 'Cow milk, buffalo milk, curd, vegetables, and pantry staples. Subscribe for a daily drop, or place a quick order when you need something today.',
            'primaryCta' => ['label' => 'Start a subscription', 'to' => '/subscriptions'],
            'secondaryCta' => ['label' => 'Order for today', 'to' => '/quick-delivery'],
            'showHeroImage' => true,
            'heroImage' => '/images/hero.svg',
            'heroImageAlt' => 'A morning farm with green fields and a bottle of milk',
            'layout' => 'split',
            'backgroundMode' => 'none',
            'backgroundImage' => '',
            'sliderImages' => ['', '', ''],
            'badges' => [
                ['enabled' => true, 'title' => 'Before 7 AM', 'subtitle' => 'Daily subscription drop', 'image' => ''],
                ['enabled' => false, 'title' => '', 'subtitle' => '', 'image' => ''],
                ['enabled' => false, 'title' => '', 'subtitle' => '', 'image' => ''],
            ],
        ];
    }

    /** @param array{publishedId: string, sections: list<array<string, mixed>>} $document */
    private static function writeDocument(array $document): void
    {
        $directory = dirname(self::path());
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new InvalidArgumentException('The server could not store the hero design.');
        }

        $encoded = json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || file_put_contents(self::path(), $encoded . "\n") === false) {
            throw new InvalidArgumentException('The hero design could not be saved.');
        }
    }

    /** @param array<string, mixed> $hero @return array<string, mixed> */
    private static function normalizeHero(array $hero): array
    {
        $defaults = self::defaults();
        $badges = [];
        $incoming = is_array($hero['badges'] ?? null) ? $hero['badges'] : [];
        for ($index = 0; $index < 3; $index++) {
            $item = is_array($incoming[$index] ?? null) ? $incoming[$index] : [];
            $badges[] = [
                'enabled' => !empty($item['enabled']),
                'title' => self::text($item['title'] ?? '', 80),
                'subtitle' => self::text($item['subtitle'] ?? '', 120),
                'image' => self::pathOrEmpty($item['image'] ?? ''),
            ];
        }

        $mode = strtolower(trim((string) ($hero['backgroundMode'] ?? 'none')));
        if (!in_array($mode, ['none', 'image', 'slider'], true)) {
            $mode = 'none';
        }
        $layout = self::layoutId($hero['layout'] ?? 'split');

        $slider = [];
        $rawSlider = is_array($hero['sliderImages'] ?? null) ? $hero['sliderImages'] : [];
        for ($index = 0; $index < 3; $index++) {
            $slider[] = self::pathOrEmpty($rawSlider[$index] ?? '');
        }

        return [
            'eyebrow' => self::text($hero['eyebrow'] ?? $defaults['eyebrow'], 60),
            'title' => self::text($hero['title'] ?? $defaults['title'], 160),
            'description' => self::text($hero['description'] ?? $defaults['description'], 480),
            'primaryCta' => self::cta($hero['primaryCta'] ?? $defaults['primaryCta'], $defaults['primaryCta']),
            'secondaryCta' => self::cta($hero['secondaryCta'] ?? $defaults['secondaryCta'], $defaults['secondaryCta']),
            'showHeroImage' => filter_var($hero['showHeroImage'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'heroImage' => self::pathOrEmpty($hero['heroImage'] ?? $defaults['heroImage']) ?: (string) $defaults['heroImage'],
            'heroImageAlt' => self::text($hero['heroImageAlt'] ?? $defaults['heroImageAlt'], 160),
            'layout' => $layout,
            'backgroundMode' => $mode,
            'backgroundImage' => self::pathOrEmpty($hero['backgroundImage'] ?? ''),
            'sliderImages' => $slider,
            'badges' => $badges,
        ];
    }

    /** @param mixed $cta @param array{label: string, to: string} $fallback @return array{label: string, to: string} */
    private static function cta(mixed $cta, array $fallback): array
    {
        if (!is_array($cta)) {
            return $fallback;
        }

        $label = array_key_exists('label', $cta)
            ? self::text($cta['label'], 48)
            : self::text($fallback['label'], 48);
        $to = self::text($cta['to'] ?? $fallback['to'], 120);
        if ($to === '') {
            $to = $fallback['to'];
        }
        if ($to[0] !== '/') {
            $to = '/' . ltrim($to, '/');
        }

        return ['label' => $label, 'to' => $to];
    }

    private static function text(mixed $value, int $max): string
    {
        $text = trim((string) $value);
        if (strlen($text) <= $max) {
            return $text;
        }

        return substr($text, 0, $max);
    }

    private static function pathOrEmpty(mixed $value): string
    {
        $path = trim((string) $value);
        if ($path === '') {
            return '';
        }
        if (str_starts_with($path, '/images/') || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return '';
    }
}
