<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '1');

$envPath = dirname(__DIR__) . '/.env';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        putenv(trim($key) . '=' . trim($value));
    }
}

function env(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function currentTimestamp(): string
{
    return gmdate('Y-m-d H:i:s');
}

function uuid4(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function base64Url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function jwtEncode(array $payload): string
{
    $header = base64Url(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
    $data = base64Url(json_encode($payload, JSON_UNESCAPED_SLASHES));
    $signature = hash_hmac('sha256', $header . '.' . $data, env('JWT_SECRET', 'change-me'), true);
    return $header . '.' . $data . '.' . base64Url($signature);
}

function jwtDecode(string $token): array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new RuntimeException('Invalid token');
    }

    [$header, $payload, $signature] = $parts;
    $expected = hash_hmac('sha256', $header . '.' . $payload, env('JWT_SECRET', 'change-me'), true);
    if (!hash_equals($expected, base64_decode(strtr($signature, '-_', '+/'), true) ?: '')) {
        throw new RuntimeException('Invalid signature');
    }

    $decoded = json_decode(base64_decode(strtr($payload, '-_', '+/'), true) ?: '', true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid payload');
    }

    return $decoded;
}

function connectDb(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . env('DB_HOST', '127.0.0.1') . ';port=' . env('DB_PORT', '3306') . ';dbname=' . env('DB_NAME', 'uvira_db') . ';charset=utf8mb4';
    $pdo = new PDO($dsn, env('DB_USER', 'root'), env('DB_PASSWORD', ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function ensureDatabase(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  firstName VARCHAR(100) NOT NULL,
  lastName VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL UNIQUE,
  email VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  country VARCHAR(100) NULL,
  continent VARCHAR(100) NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'user',
  password VARCHAR(255) NULL,
  welcome_promo_code VARCHAR(50) NULL,
  created_at DATETIME NOT NULL
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(512) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS promo_codes (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  percent_off DECIMAL(10,2) NULL,
  amount_off_usd DECIMAL(10,2) NULL,
  max_uses INT NULL,
  expires_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  uses INT NOT NULL DEFAULT 0,
  welcome_for_user_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  service_id VARCHAR(36) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  event_date DATETIME NOT NULL,
  notes TEXT NULL,
  payment_method VARCHAR(20) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  promo_code VARCHAR(100) NULL,
  subtotal_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  paid TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL,
  receipt_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS receipts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  booking_id VARCHAR(36) NOT NULL,
  number VARCHAR(100) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  service_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS scanned_receipts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  raw_data TEXT NOT NULL,
  created_at DATETIME NOT NULL
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS payment_sessions (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  session_id VARCHAR(100) NOT NULL UNIQUE,
  checkout_url VARCHAR(512) NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL
);
SQL);

    seedDefaults($pdo);
}

function seedDefaults(PDO $pdo): void
{
    $adminPhone = env('ADMIN_PHONE', '+10000000000');
    $adminEmail = env('ADMIN_EMAIL', 'lundengel@gmail.com');
    $adminPassword = env('ADMIN_PASSWORD', 'Admin@Elegante2026');

    $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
    $stmt->execute([$adminPhone]);
    if (!$stmt->fetch()) {
        $pdo->prepare('INSERT INTO users (id, firstName, lastName, phone, email, address, city, country, continent, role, password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
            uuid4(),
            'Lund',
            'Engel',
            $adminPhone,
            $adminEmail,
            'HQ',
            '—',
            '—',
            '—',
            'super_admin',
            password_hash($adminPassword, PASSWORD_BCRYPT),
            currentTimestamp(),
        ]);
    }

    $count = (int) $pdo->query('SELECT COUNT(*) FROM services')->fetchColumn();
    if ($count === 0) {
        $services = [
            ['Elegant Party Rentals', 'rental', 'Premium chairs, linens, glassware and decor for events up to 50 guests.', 250.0, 'https://images.unsplash.com/photo-1530023367847-a683933f4172?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000'],
            ['Bespoke Party Organization', 'party', 'End-to-end party planning: lighting, music, staff, and atmosphere.', 850.0, 'https://images.unsplash.com/photo-1763553113391-a659bee36e06?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000'],
            ['Private Catering & Cooking', 'catering', 'Chef-crafted menus prepared on-site for your celebration.', 480.0, 'https://images.unsplash.com/photo-1740047602722-b4993b79e4b7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000'],
            ['Signature Birthday Gift Delivery', 'gift', 'Hand-wrapped birthday gifts delivered to the recipient with a personal note.', 120.0, 'https://images.pexels.com/photos/29873585/pexels-photo-29873585.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'],
        ];
        $insert = $pdo->prepare('INSERT INTO services (id, name, category, description, price, image_url, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)');
        foreach ($services as $service) {
            $insert->execute([uuid4(), $service[0], $service[1], $service[2], $service[3], $service[4], currentTimestamp()]);
        }
    }
}

function readJsonBody(): array
{
    $body = file_get_contents('php://input');
    if ($body === '') {
        return [];
    }

    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : [];
}

function respondJson(mixed $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
}

function requireAuth(PDO $pdo, bool $admin = false, bool $superAdmin = false): array
{
    $token = null;
    if (isset($_SERVER['HTTP_AUTHORIZATION']) && str_starts_with($_SERVER['HTTP_AUTHORIZATION'], 'Bearer ')) {
        $token = substr($_SERVER['HTTP_AUTHORIZATION'], 7);
    } elseif (isset($_COOKIE['token'])) {
        $token = $_COOKIE['token'];
    }

    if (!$token) {
        respondJson(['detail' => 'Missing token'], 401);
        exit;
    }

    try {
        $data = jwtDecode($token);
    } catch (Throwable $e) {
        respondJson(['detail' => 'Invalid token'], 401);
        exit;
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$data['sub'] ?? '']);
    $user = $stmt->fetch();
    if (!$user) {
        respondJson(['detail' => 'User not found'], 401);
        exit;
    }

    if ($admin && !in_array($user['role'], ['admin', 'super_admin'], true)) {
        respondJson(['detail' => 'Admin only'], 403);
        exit;
    }

    if ($superAdmin && $user['role'] !== 'super_admin') {
        respondJson(['detail' => 'Super admin only'], 403);
        exit;
    }

    unset($user['password']);
    return $user;
}

function normalizePromoCode(?string $code): ?string
{
    if (!$code) {
        return null;
    }
    return strtoupper(trim($code));
}

function currencyRates(): array
{
    return [
        'rates' => ['USD' => 1.0, 'EUR' => 0.92, 'TZS' => 2600.0],
        'decimals' => ['USD' => 2, 'EUR' => 2, 'TZS' => 0],
        'symbols' => ['USD' => '$', 'EUR' => '€', 'TZS' => 'TSh'],
    ];
}

function formatMoney(float $amount, string $currency): string
{
    $rates = currencyRates()['rates'];
    $rate = $rates[$currency] ?? 1.0;
    $value = round($amount * $rate, 2);
    $symbol = ['USD' => '$', 'EUR' => '€', 'TZS' => 'TSh'][$currency] ?? '$';
    return $symbol . number_format($value, 2);
}
