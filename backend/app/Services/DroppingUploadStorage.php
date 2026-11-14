<?php

namespace App\Services;

use App\Models\DroppingRequest;
use App\Support\DroppingUploads;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DroppingUploadStorage
{
    public function store(DroppingRequest $dropping, array $files, array &$stored): void
    {
        $disk = Storage::disk('s3');
        $version = count($dropping->submissions) + 1;
        foreach ($files as $index => $file) {
            if (! DroppingUploads::ownsKey($file['key'], $dropping->student_id, $dropping->enrollment_id, $file['mime'])) {
                throw ValidationException::withMessages(["files.$index" => 'This document does not belong to your enrollment. Upload it again.']);
            }
            if (! $disk->exists($file['key']) || $disk->size($file['key']) !== (int) $file['size']) {
                throw ValidationException::withMessages(["files.$index" => 'The uploaded document is missing or incomplete. Please upload it again.']);
            }

            $id = (string) Str::uuid();
            $path = "dropping/{$dropping->id}/{$version}/{$id}.".DroppingUploads::TYPES[$file['mime']];
            // Track the destination before copying, so a lost storage response can be cleaned up.
            $stored[] = ['id' => $id, 'path' => $path, 'disk' => 's3',
                'name' => $file['name'], 'mime' => $file['mime'], 'size' => (int) $file['size']];
            $this->copy($disk, $file['key'], $path, $file['mime']);

            // Validate the permanent copy. A still-valid PUT URL can overwrite the pending object.
            if ($disk->size($path) !== (int) $file['size']) {
                throw ValidationException::withMessages(["files.$index" => 'The uploaded document has changed. Please upload it again.']);
            }
            $contents = $this->read($disk, $path);
            if (strlen($contents) !== (int) $file['size'] || (new \finfo(FILEINFO_MIME_TYPE))->buffer($contents) !== $file['mime']) {
                throw ValidationException::withMessages(["files.$index" => 'The document must be a valid PDF, JPG, or PNG matching the selected file.']);
            }
        }
    }

    private function copy(FilesystemAdapter $disk, string $source, string $destination, string $mime): void
    {
        if ($disk instanceof AwsS3V3Adapter) {
            // Copy within S3 without an ACL header, including buckets with ACLs disabled.
            $disk->getClient()->copyObject([
                'Bucket' => $disk->getConfig()['bucket'],
                'Key' => $disk->path($destination),
                'CopySource' => $disk->getConfig()['bucket'].'/'.rawurlencode($disk->path($source)),
                'MetadataDirective' => 'REPLACE',
                'ContentType' => $mime,
            ]);

            return;
        }

        $disk->getDriver()->copy($source, $destination, ['visibility' => 'private']);
    }

    private function read(FilesystemAdapter $disk, string $path): string
    {
        if ($disk instanceof AwsS3V3Adapter) {
            // The memory sink also prevents disk buffering when Guzzle falls back to cURL.
            $sink = fopen('php://memory', 'w+');
            abort_unless(is_resource($sink), 503, 'The document could not be checked. Please try again.');
            $body = null;
            try {
                $object = $disk->getClient()->getObject([
                    'Bucket' => $disk->getConfig()['bucket'],
                    'Key' => $disk->path($path),
                    'Range' => 'bytes=0-'.DroppingUploads::MAX_BYTES,
                    '@http' => ['stream' => true, 'sink' => $sink],
                ]);
                $body = $object['Body'];

                return $body->getContents();
            } finally {
                $body?->close();
                if (is_resource($sink)) {
                    fclose($sink);
                }
            }
        }

        $stream = $disk->readStream($path);
        abort_unless(is_resource($stream), 503, 'The document could not be checked. Please try again.');
        try {
            $contents = stream_get_contents($stream, DroppingUploads::MAX_BYTES + 1);
            abort_if($contents === false, 503, 'The document could not be checked. Please try again.');

            return $contents;
        } finally {
            fclose($stream);
        }
    }

    public function discardPending(array $files, int $studentId, int $enrollmentId): void
    {
        $keys = array_column($files, 'key');
        $keys = array_filter($keys, fn ($key) => DroppingUploads::ownsKey($key, $studentId, $enrollmentId));
        if ($keys === []) {
            return;
        }

        // The request is already committed. Cleanup failure must not turn success into an error.
        try {
            if (! Storage::disk('s3')->delete(array_values($keys))) {
                report(new \RuntimeException('Could not remove pending dropping documents.'));
            }
        } catch (\Throwable $error) {
            report($error);
        }
    }
}
