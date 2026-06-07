#!/usr/bin/env php
<?php
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

$args = array_slice($argv, 1);
$port = isset($args[0]) && is_numeric($args[0]) ? (int)$args[0] : 3000;
$hostAll = getOption($args, '--host') || getOption($args, '-h');
$releaseUrl = getenv('LLMCHEF_RELEASE_URL') ?: 'https://wan0.net/llmchef/release/latest.zip';

$scriptDir = dirname(__FILE__);
$tempDir = getenv('LLMCHEF_RUNNER_APP_DIR') ?: ($scriptDir . '/llmchef-app');
safeMkdir($tempDir);

$zipPath = $tempDir . '/llmchef.zip';
echo "Downloading LLMChef release...\n";

$context = stream_context_create([
    'http' => [
        'follow_location' => true,
    ],
]);

$zipContent = file_get_contents($releaseUrl, false, $context);
if ($zipContent === false) {
    echo "Error downloading LLMChef.\n";
    exit(1);
}

file_put_contents($zipPath, $zipContent);
echo "Download complete. Extracting...\n";

$zip = new ZipArchive();
if ($zip->open($zipPath) === TRUE) {
    $zip->extractTo($tempDir);
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
