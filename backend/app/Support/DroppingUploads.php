<?php

namespace App\Support;

use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DroppingUploads
{
    public const TYPES = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    public const MAX_FILES = 12;

    public const MAX_BYTES = 2 * 1024 * 1024;

    public const MAX_TOTAL_BYTES = 7 * 1024 * 1024;

    public static function metadataRules(bool $withKey = false): array
    {
        $fields = $withKey ? 'name,mime,size,key' : 'name,mime,size';
        $rules = [
            'files' => ['required', 'array', 'list', 'min:1', 'max:'.self::MAX_FILES],
            'files.*' => ['required', 'array:'.$fields],
            'files.*.name' => ['required', 'string', 'max:255', 'not_regex:~[/\\\\\x00-\x1f\x7f]~'],
            'files.*.mime' => ['required', 'string', Rule::in(array_keys(self::TYPES))],
            'files.*.size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
        ];
        if ($withKey) {
            $rules['files.*.key'] = ['required', 'string', 'max:255', 'distinct:strict'];
        }

        return $rules;
    }

    public static function assertTotalSize(array $files): void
    {
        if (array_sum(array_column($files, 'size')) > self::MAX_TOTAL_BYTES) {
            throw ValidationException::withMessages(['files' => 'The documents must be 7 MB or less in total.']);
        }
    }

    public static function makeKey(int $studentId, int $enrollmentId, string $mime): string
    {
        return "dropping/pending/{$studentId}/{$enrollmentId}/".Str::uuid().'.'.self::TYPES[$mime];
    }

    public static function ownsKey(string $key, int $studentId, int $enrollmentId, ?string $mime = null): bool
    {
        $pattern = "~\Adropping/pending/{$studentId}/{$enrollmentId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.([a-z]+)\z~";
        if (! preg_match($pattern, $key, $matches)) {
            return false;
        }

        return $mime === null
            ? in_array($matches[1], self::TYPES, true)
            : $matches[1] === (self::TYPES[$mime] ?? null);
    }
}
