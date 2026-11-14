<?php

namespace Tests\Feature;

use App\Models\DroppingRequest;
use App\Services\DroppingUploadStorage;
use App\Support\DroppingUploads;
use Aws\CommandInterface;
use Aws\Exception\AwsException;
use Aws\MockHandler;
use Aws\Result;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\StreamInterface;
use Tests\TestCase;

class DroppingUploadStorageTest extends TestCase
{
    private mixed $sink = null;

    private ?StreamInterface $body = null;

    private ?string $copiedPath = null;

    public function test_native_s3_copy_uses_private_defaults_and_reads_the_permanent_document_into_memory(): void
    {
        $pdf = "%PDF-1.4\nSigned dropping form\n%%EOF";
        [$dropping, $file] = $this->prepareStorage($pdf);
        $stored = [];

        app(DroppingUploadStorage::class)->store($dropping, [$file], $stored);

        $this->assertCount(1, $stored);
        $this->assertSame('application/pdf', $stored[0]['mime']);
        $this->assertSame(strlen($pdf), $stored[0]['size']);
        $this->assertSame('uploads/'.$stored[0]['path'], $this->copiedPath);
        $this->assertFalse(is_resource($this->sink));
        $this->assertFalse($this->body->isReadable());
    }

    public function test_native_s3_rejects_wrong_permanent_bytes_even_when_head_metadata_matches(): void
    {
        [$dropping, $file] = $this->prepareStorage('This is plain text with a PDF extension.');
        $stored = [];

        try {
            app(DroppingUploadStorage::class)->store($dropping, [$file], $stored);
            $this->fail('A text object must not be accepted as a PDF.');
        } catch (ValidationException $error) {
            $this->assertArrayHasKey('files.0', $error->errors());
        }

        $this->assertCount(1, $stored, 'The copied destination remains available for rollback cleanup.');
        $this->assertSame('uploads/'.$stored[0]['path'], $this->copiedPath);
        $this->assertFalse(is_resource($this->sink));
        $this->assertFalse($this->body->isReadable());
    }

    public function test_native_s3_closes_the_memory_sink_when_the_download_fails(): void
    {
        [$dropping, $file] = $this->prepareStorage("%PDF-1.4\nSigned form\n%%EOF", failDownload: true);
        $stored = [];

        try {
            app(DroppingUploadStorage::class)->store($dropping, [$file], $stored);
            $this->fail('The download error must reach the submission rollback handler.');
        } catch (AwsException $error) {
            $this->assertSame('Document download failed.', $error->getMessage());
        }

        $this->assertFalse(is_resource($this->sink));
        $this->assertCount(1, $stored);
    }

    private function prepareStorage(string $contents, bool $failDownload = false): array
    {
        $file = [
            'key' => DroppingUploads::makeKey(4, 8, 'application/pdf'),
            'name' => 'signed-form.pdf',
            'mime' => 'application/pdf',
            'size' => strlen($contents),
        ];
        $metadata = new Result(['ContentLength' => strlen($contents), 'ContentType' => 'application/pdf']);
        $handler = new MockHandler([
            clone $metadata,
            clone $metadata,
            function (CommandInterface $command, RequestInterface $request) use ($file) {
                $this->assertSame('CopyObject', $command->getName());
                $this->assertArrayNotHasKey('ACL', $command->toArray());
                $this->assertFalse($request->hasHeader('x-amz-acl'));
                $this->assertSame('dropping-test-bucket/'.rawurlencode('uploads/'.$file['key']), $command['CopySource']);
                $this->assertStringStartsWith('uploads/dropping/12/1/', $command['Key']);
                $this->assertSame('REPLACE', $command['MetadataDirective']);
                $this->assertSame('application/pdf', $command['ContentType']);
                $this->copiedPath = $command['Key'];

                return new Result;
            },
            clone $metadata,
            function (CommandInterface $command) use ($contents, $failDownload) {
                $this->assertSame('GetObject', $command->getName());
                $this->assertSame($this->copiedPath, $command['Key']);
                $this->assertSame('bytes=0-'.DroppingUploads::MAX_BYTES, $command['Range']);
                $this->assertTrue($command['@http']['stream']);
                $this->sink = $command['@http']['sink'] ?? null;
                $this->assertIsResource($this->sink);
                $this->assertSame('php://memory', stream_get_meta_data($this->sink)['uri']);
                if ($failDownload) {
                    return new AwsException('Document download failed.', $command);
                }
                $this->body = Utils::streamFor($contents);

                return new Result(['Body' => $this->body]);
            },
        ]);
        $disk = Storage::build([
            'driver' => 's3', 'region' => 'us-east-1', 'key' => 'test-key', 'secret' => 'test-secret',
            'bucket' => 'dropping-test-bucket', 'root' => 'uploads', 'handler' => $handler, 'retries' => 0,
        ]);
        $this->assertInstanceOf(AwsS3V3Adapter::class, $disk);
        Storage::set('s3', $disk);
        $dropping = new DroppingRequest(['student_id' => 4, 'enrollment_id' => 8, 'submissions' => []]);
        $dropping->id = 12;

        return [$dropping, $file];
    }
}
