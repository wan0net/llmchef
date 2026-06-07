#!/usr/bin/env php
<?php
const DEFAULT_RELEASE_URL = 'https://wan0.net/llmchef/release/latest.zip';

function safeMkdir($dir) {
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
    }
}

function getOption($args, $option, $default = false) {
    foreach ($args as $arg) {
        if ($arg === $option) {
            return true;
        }
    }
    return $default;
}

function resolveReleaseUrl() {
    $rawUrl = getenv('LLMCHEF_RELEASE_URL');
    if ($rawUrl === false || $rawUrl === '') {
        return DEFAULT_RELEASE_URL;
    }

    if ($rawUrl === DEFAULT_RELEASE_URL) {
        return $rawUrl;
    }

    $parts = parse_url($rawUrl);
    if ($parts === false) {
        fwrite(STDERR, "Invalid LLMCHEF_RELEASE_URL.\n");
        exit(1);
    }

    $scheme = strtolower($parts['scheme'] ?? '');
    if ($scheme !== 'http' && $scheme !== 'https') {
        fwrite(STDERR, "LLMCHEF_RELEASE_URL only supports http(s) loopback overrides.\n");
        exit(1);
    }

    $host = strtolower($parts['host'] ?? '');
    if ($host === '') {
        fwrite(STDERR, "LLMCHEF_RELEASE_URL must include a hostname.\n");
        exit(1);
    }

    $isLoopback = $host === 'localhost' || $host === '127.0.0.1' || $host === '::1';

    if (!$isLoopback) {
        fwrite(STDERR, "LLMCHEF_RELEASE_URL must stay on the default release origin or a loopback host.\n");
        exit(1);
    }

    return $rawUrl;
}

function extractHeader(array $headers, string $headerName): ?string {
    foreach ($headers as $header) {
        $prefix = $headerName . ':';
        if (stripos($header, $prefix) === 0) {
            return trim(substr($header, strlen($prefix)));
        }
    }

    return null;
}

function resolveRedirectUrl(string $currentUrl, string $location): string {
    if (preg_match('#^https?://#i', $location)) {
        return $location;
    }

    $currentParts = parse_url($currentUrl);
    if ($currentParts === false || !isset($currentParts['scheme'], $currentParts['host'])) {
        throw new RuntimeException('Unable to resolve redirect target.');
    }

    $scheme = $currentParts['scheme'];
    $host = $currentParts['host'];
    $port = isset($currentParts['port']) ? ':' . $currentParts['port'] : '';

    if (str_starts_with($location, '/')) {
        return "{$scheme}://{$host}{$port}{$location}";
    }

    $basePath = $currentParts['path'] ?? '/';
    $baseDir = preg_replace('#/[^/]*$#', '/', $basePath) ?: '/';
    return "{$scheme}://{$host}{$port}{$baseDir}{$location}";
}

function downloadRelease(string $releaseUrl, string $zipPath): void {
    $allowRedirects = $releaseUrl === DEFAULT_RELEASE_URL;
    $currentUrl = $releaseUrl;

    for ($redirectCount = 0; $redirectCount <= 5; $redirectCount++) {
        $context = stream_context_create([
            'http' => [
                'follow_location' => 0,
                'ignore_errors' => true,
            ],
        ]);

        $zipContent = @file_get_contents($currentUrl, false, $context);
        $responseHeaders = $http_response_header ?? [];
        $statusLine = $responseHeaders[0] ?? '';
        $statusCode = preg_match('/\s(\d{3})\s/', $statusLine, $matches) ? (int)$matches[1] : 0;

        if ($statusCode >= 300 && $statusCode < 400) {
            if (!$allowRedirects) {
                throw new RuntimeException('Redirects are not allowed for LLMCHEF_RELEASE_URL overrides.');
            }

            $location = extractHeader($responseHeaders, 'Location');
            if ($location === null || $location === '') {
                throw new RuntimeException('Received redirect without Location header.');
            }

            $currentUrl = resolveRedirectUrl($currentUrl, $location);
            continue;
        }

        if ($statusCode === 200 && $zipContent !== false) {
            file_put_contents($zipPath, $zipContent);
            return;
        }

        if ($zipContent === false) {
            throw new RuntimeException('Error downloading LLMChef.');
        }

        throw new RuntimeException("Unexpected HTTP status {$statusCode} while downloading LLMChef.");
    }

    throw new RuntimeException('Too many redirects while downloading LLMChef release.');
}

function removeDirectoryContentsExcept(string $dir, string $keepPath): void {
    $entries = scandir($dir);
    if ($entries === false) {
        throw new RuntimeException("Unable to read {$dir}.");
    }

    $keepRealPath = realpath($keepPath) ?: $keepPath;

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $entry;
        if ((realpath($path) ?: $path) === $keepRealPath) {
            continue;
        }

        removePath($path);
    }
}

function removePath(string $path): void {
    if (is_link($path) || is_file($path)) {
        if (!unlink($path)) {
            throw new RuntimeException("Unable to remove {$path}.");
        }
        return;
    }

    if (is_dir($path)) {
        $entries = scandir($path);
        if ($entries === false) {
            throw new RuntimeException("Unable to read {$path}.");
        }

        foreach ($entries as $entry) {
            if ($entry !== '.' && $entry !== '..') {
                removePath($path . DIRECTORY_SEPARATOR . $entry);
            }
        }

        if (!rmdir($path)) {
            throw new RuntimeException("Unable to remove {$path}.");
        }
    }
}

function isAbsoluteZipEntry(string $entryName): bool {
    return str_starts_with($entryName, '/')
        || str_starts_with($entryName, "\\")
        || preg_match('/^[A-Za-z]:[\/\\\\]/', $entryName) === 1;
}

function resolveZipEntryPath(string $tempDir, string $entryName): string {
    if ($entryName === '' || isAbsoluteZipEntry($entryName)) {
        throw new RuntimeException("Unsafe zip entry path: {$entryName}");
    }

    $tempRealPath = realpath($tempDir);
    if ($tempRealPath === false) {
        throw new RuntimeException("Unable to resolve {$tempDir}.");
    }

    $parts = [];
    foreach (preg_split('#[\/\\\\]+#', $entryName) as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }

        if ($part === '..') {
            if (count($parts) === 0) {
                throw new RuntimeException("Unsafe zip entry path: {$entryName}");
            }
            array_pop($parts);
            continue;
        }

        $parts[] = $part;
    }

    if (count($parts) === 0) {
        throw new RuntimeException("Unsafe zip entry path: {$entryName}");
    }

    $targetPath = $tempRealPath;
    foreach ($parts as $part) {
        $targetPath .= DIRECTORY_SEPARATOR . $part;
    }

    $normalizedBase = rtrim($tempRealPath, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    $normalizedTarget = rtrim($targetPath, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if ($normalizedTarget !== $normalizedBase && !str_starts_with($normalizedTarget, $normalizedBase)) {
        throw new RuntimeException("Unsafe zip entry path: {$entryName}");
    }

    return $targetPath;
}

function extractZipSafely(ZipArchive $zip, string $tempDir): void {
    for ($index = 0; $index < $zip->numFiles; $index++) {
        $entryName = $zip->getNameIndex($index);
        if ($entryName === false) {
            throw new RuntimeException("Unable to read zip entry {$index}.");
        }

        $targetPath = resolveZipEntryPath($tempDir, $entryName);
        $isDirectory = str_ends_with($entryName, '/') || str_ends_with($entryName, "\\");

        if ($isDirectory) {
            safeMkdir($targetPath);
            continue;
        }

        safeMkdir(dirname($targetPath));
        $source = $zip->getStream($entryName);
        if ($source === false) {
            throw new RuntimeException("Unable to read zip entry {$entryName}.");
        }

        $target = fopen($targetPath, 'wb');
        if ($target === false) {
            fclose($source);
            throw new RuntimeException("Unable to write {$targetPath}.");
        }

        stream_copy_to_stream($source, $target);
        fclose($source);
        fclose($target);
    }
}

$args = array_slice($argv, 1);
$port = isset($args[0]) && is_numeric($args[0]) ? (int)$args[0] : 3000;
$hostAll = getOption($args, '--host') || getOption($args, '-h');
$releaseUrl = resolveReleaseUrl();

$scriptDir = dirname(__FILE__);
$tempDir = getenv('LLMCHEF_RUNNER_APP_DIR') ?: ($scriptDir . '/llmchef-app');
safeMkdir($tempDir);

$zipPath = $tempDir . '/llmchef.zip';
echo "Downloading LLMChef release...\n";

downloadRelease($releaseUrl, $zipPath);
echo "Download complete. Extracting...\n";

$zip = new ZipArchive();
if ($zip->open($zipPath) === TRUE) {
    removeDirectoryContentsExcept($tempDir, $zipPath);
    extractZipSafely($zip, $tempDir);
    $zip->close();
    echo "Extraction complete.\n";

    $host = $hostAll ? '0.0.0.0' : 'localhost';
    $accessUrl = $hostAll
        ? "http://" . gethostbyname(gethostname()) . ":{$port} (accessible from other devices)"
        : "http://localhost:{$port} (local access only)";

    echo "LLMChef is running at {$accessUrl}\n";

    $routerPath = $tempDir . '/router.php';
    $routerScript = <<<'PHP'
<?php
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
    http_response_code(405);
    header('Allow: GET, HEAD, OPTIONS');
    echo 'Method Not Allowed';
    return true;
}

if ($method === 'OPTIONS') {
    http_response_code(204);
    header('Allow: GET, HEAD, OPTIONS');
    return true;
}

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$normalizedPath = $requestPath ?: '/';
$segments = array_filter(explode('/', $normalizedPath), static fn ($segment) => $segment !== '');
$safeSegments = [];

foreach ($segments as $segment) {
    $decodedSegment = rawurldecode($segment);
    if (
        $decodedSegment === '' ||
        $decodedSegment === '.' ||
        $decodedSegment === '..' ||
        strpos($decodedSegment, DIRECTORY_SEPARATOR) !== false ||
        strpos($decodedSegment, '/') !== false ||
        strpos($decodedSegment, "\\") !== false
    ) {
        http_response_code(404);
        return true;
    }
    $safeSegments[] = $decodedSegment;
}

$filePath = __DIR__;
foreach ($safeSegments as $safeSegment) {
    $filePath .= DIRECTORY_SEPARATOR . $safeSegment;
}

if (is_file($filePath)) {
    return false;
}

include __DIR__ . '/index.html';
PHP;
    file_put_contents($routerPath, $routerScript);

    chdir($tempDir);
    $command = "php -S {$host}:{$port} router.php";
    system($command);
} else {
    echo "Failed to extract the zip file.\n";
    exit(1);
}
?>
