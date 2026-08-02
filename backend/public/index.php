<?php

require_once __DIR__ . '/../bootstrap.php';

$pdo = connectDb();
ensureDatabase($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . trim($path, '/');

if ($method === 'OPTIONS') {
    respondJson([], 200);
    exit;
}

if ($path === '/api' || $path === '/api/') {
    respondJson(['ok' => true]);
    exit;
}

if (!preg_match('#^/api(/.*)?$#', $path)) {
    respondJson(['detail' => 'Not found'], 404);
    exit;
}

$relative = '/' . trim(substr($path, 4), '/');
if ($relative === '') {
    $relative = '/';
}

$body = readJsonBody();

try {
    switch ($relative) {
        case '/auth/register':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $required = ['firstName', 'lastName', 'phone', 'address', 'city', 'country', 'continent'];
            foreach ($required as $field) {
                if (empty($body[$field])) {
                    respondJson(['detail' => 'Missing ' . $field], 400);
                    exit;
                }
            }

            $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
            $stmt->execute([$body['phone']]);
            if ($stmt->fetch()) {
                respondJson(['detail' => 'Phone already registered'], 400);
                exit;
            }

            $id = uuid4();
            $welcomeCode = 'WELCOME-' . strtoupper(substr($id, 0, 6));
            $user = [
                'id' => $id,
                'firstName' => $body['firstName'],
                'lastName' => $body['lastName'],
                'phone' => $body['phone'],
                'email' => $body['email'] ?? null,
                'address' => $body['address'],
                'city' => $body['city'],
                'country' => $body['country'],
                'continent' => $body['continent'],
                'role' => 'user',
                'welcome_promo_code' => $welcomeCode,
                'created_at' => currentTimestamp(),
            ];
            $pdo->prepare('INSERT INTO users (id, firstName, lastName, phone, email, address, city, country, continent, role, welcome_promo_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
                $user['id'], $user['firstName'], $user['lastName'], $user['phone'], $user['email'], $user['address'], $user['city'], $user['country'], $user['continent'], 'user', $welcomeCode, $user['created_at']
            ]);
            $pdo->prepare('INSERT INTO promo_codes (id, code, percent_off, amount_off_usd, max_uses, expires_at, active, uses, welcome_for_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)')->execute([
                uuid4(), $welcomeCode, 10.0, null, 1, gmdate('Y-m-d H:i:s', strtotime('+90 days')), $id, currentTimestamp()
            ]);
            respondJson(['token' => jwtEncode(['sub' => $id, 'role' => 'user']), 'user' => $user]);
            break;

        case '/auth/user/login':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            if (empty($body['phone'])) {
                respondJson(['detail' => 'Missing phone'], 400);
                exit;
            }
            $stmt = $pdo->prepare('SELECT * FROM users WHERE phone = ? AND role = ? LIMIT 1');
            $stmt->execute([$body['phone'], 'user']);
            $user = $stmt->fetch();
            if (!$user) {
                respondJson(['detail' => 'No account for this phone. Please register.'], 404);
                exit;
            }
            unset($user['password']);
            respondJson(['token' => jwtEncode(['sub' => $user['id'], 'role' => 'user']), 'user' => $user]);
            break;

        case '/auth/admin/login':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            if (empty($body['phone']) || empty($body['password'])) {
                respondJson(['detail' => 'Missing credentials'], 400);
                exit;
            }
            $stmt = $pdo->prepare('SELECT * FROM users WHERE phone = ? LIMIT 1');
            $stmt->execute([$body['phone']]);
            $user = $stmt->fetch();
            if (!$user || !in_array($user['role'], ['admin', 'super_admin'], true) || !password_verify($body['password'], $user['password'] ?? '')) {
                respondJson(['detail' => 'Invalid credentials'], 401);
                exit;
            }
            unset($user['password']);
            respondJson(['token' => jwtEncode(['sub' => $user['id'], 'role' => $user['role']]), 'user' => $user]);
            break;

        case '/auth/me':
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            respondJson(requireAuth($pdo));
            break;

        case '/currency/rates':
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            respondJson(currencyRates());
            break;

        case '/services':
            if ($method === 'GET') {
                $rows = $pdo->query('SELECT * FROM services WHERE active = 1 ORDER BY created_at DESC')->fetchAll();
                respondJson($rows);
                break;
            }
            if ($method === 'POST') {
                $user = requireAuth($pdo, true);
                $required = ['name', 'category', 'description', 'price'];
                foreach ($required as $field) {
                    if (!isset($body[$field])) {
                        respondJson(['detail' => 'Missing ' . $field], 400);
                        exit;
                    }
                }
                $id = uuid4();
                $stmt = $pdo->prepare('INSERT INTO services (id, name, category, description, price, image_url, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $body['name'], $body['category'], $body['description'], (float) $body['price'], $body['image_url'] ?? null, isset($body['active']) ? (int) $body['active'] : 1, currentTimestamp()]);
                respondJson(['id' => $id, 'name' => $body['name'], 'category' => $body['category'], 'description' => $body['description'], 'price' => (float) $body['price'], 'image_url' => $body['image_url'] ?? null, 'active' => isset($body['active']) ? (bool) $body['active'] : true]);
                break;
            }
            throw new RuntimeException('Method not allowed', 405);

        case preg_match('#^/services/([^/]+)$#', $relative, $matches) ? $relative : null:
            if ($method === 'PUT') {
                $user = requireAuth($pdo, true);
                $stmt = $pdo->prepare('UPDATE services SET name = ?, category = ?, description = ?, price = ?, image_url = ?, active = ? WHERE id = ?');
                $stmt->execute([$body['name'] ?? '', $body['category'] ?? 'custom', $body['description'] ?? '', (float) ($body['price'] ?? 0), $body['image_url'] ?? null, isset($body['active']) ? (int) $body['active'] : 1, $matches[1]]);
                respondJson(['ok' => true]);
                break;
            }
            if ($method === 'DELETE') {
                $user = requireAuth($pdo, true);
                $stmt = $pdo->prepare('UPDATE services SET active = 0 WHERE id = ?');
                $stmt->execute([$matches[1]]);
                respondJson(['ok' => true]);
                break;
            }
            throw new RuntimeException('Method not allowed', 405);

        case '/promo-codes/validate':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo);
            $code = normalizePromoCode($body['code'] ?? null);
            if (!$code) {
                respondJson(['detail' => 'Missing code'], 400);
                exit;
            }
            $stmt = $pdo->prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1 LIMIT 1');
            $stmt->execute([$code]);
            $promo = $stmt->fetch();
            if (!$promo) {
                respondJson(['detail' => 'Invalid or expired code'], 404);
                exit;
            }
            if ($promo['expires_at'] && strtotime($promo['expires_at']) < time()) {
                respondJson(['detail' => 'Invalid or expired code'], 404);
                exit;
            }
            respondJson(['code' => $promo['code'], 'percent_off' => (float) ($promo['percent_off'] ?? 0), 'amount_off_usd' => $promo['amount_off_usd'] ? (float) $promo['amount_off_usd'] : null]);
            break;

        case '/admin/promo-codes':
            if ($method === 'GET') {
                $user = requireAuth($pdo, true);
                $rows = $pdo->query('SELECT * FROM promo_codes ORDER BY created_at DESC')->fetchAll();
                respondJson($rows);
                break;
            }
            if ($method === 'POST') {
                $user = requireAuth($pdo, true);
                $code = normalizePromoCode($body['code'] ?? null);
                if (!$code) {
                    respondJson(['detail' => 'Missing code'], 400);
                    exit;
                }
                $stmt = $pdo->prepare('INSERT INTO promo_codes (id, code, percent_off, amount_off_usd, max_uses, expires_at, active, uses, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)');
                $stmt->execute([uuid4(), $code, $body['percent_off'] ?? null, $body['amount_off_usd'] ?? null, $body['max_uses'] ?? null, $body['expires_at'] ?? null, isset($body['active']) ? (int) $body['active'] : 1, currentTimestamp()]);
                respondJson(['ok' => true]);
                break;
            }
            throw new RuntimeException('Method not allowed', 405);

        case preg_match('#^/admin/promo-codes/([^/]+)$#', $relative, $matches) ? $relative : null:
            if ($method === 'DELETE') {
                $user = requireAuth($pdo, true);
                $stmt = $pdo->prepare('DELETE FROM promo_codes WHERE id = ?');
                $stmt->execute([$matches[1]]);
                respondJson(['ok' => true]);
                break;
            }
            throw new RuntimeException('Method not allowed', 405);

        case '/bookings':
            if ($method === 'GET') {
                $user = requireAuth($pdo);
                $stmt = $pdo->prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC');
                $stmt->execute([$user['id']]);
                respondJson($stmt->fetchAll());
                break;
            }
            if ($method === 'POST') {
                $user = requireAuth($pdo);
                if (empty($body['service_id']) || empty($body['event_date'])) {
                    respondJson(['detail' => 'Missing booking details'], 400);
                    exit;
                }
                $serviceStmt = $pdo->prepare('SELECT * FROM services WHERE id = ? AND active = 1 LIMIT 1');
                $serviceStmt->execute([$body['service_id']]);
                $service = $serviceStmt->fetch();
                if (!$service) {
                    respondJson(['detail' => 'Service not found'], 404);
                    exit;
                }
                $quantity = max(1, (int) ($body['quantity'] ?? 1));
                $subtotalUsd = (float) $service['price'] * $quantity;
                $discountUsd = 0.0;
                $promoCode = normalizePromoCode($body['promo_code'] ?? null);
                if ($promoCode) {
                    $promoStmt = $pdo->prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1 LIMIT 1');
                    $promoStmt->execute([$promoCode]);
                    $promo = $promoStmt->fetch();
                    if ($promo && (!$promo['expires_at'] || strtotime($promo['expires_at']) >= time())) {
                        if (!empty($promo['percent_off'])) {
                            $discountUsd = $subtotalUsd * ((float) $promo['percent_off'] / 100.0);
                        } elseif (!empty($promo['amount_off_usd'])) {
                            $discountUsd = min((float) $promo['amount_off_usd'], $subtotalUsd);
                        }
                        $discountUsd = round($discountUsd, 2);
                    }
                }
                $total = round(max(0.0, $subtotalUsd - $discountUsd), 2);
                $bookingId = uuid4();
                $status = $body['payment_method'] === 'cash' ? 'pending_office_payment' : 'pending_payment';
                $receiptId = null;
                if ($body['payment_method'] === 'cash') {
                    $receiptId = uuid4();
                }
                $pdo->prepare('INSERT INTO bookings (id, user_id, service_id, service_name, quantity, event_date, notes, payment_method, currency, language, promo_code, subtotal_usd, discount_usd, total, paid, status, receipt_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
                    $bookingId,
                    $user['id'],
                    $service['id'],
                    $service['name'],
                    $quantity,
                    $body['event_date'],
                    $body['notes'] ?? '',
                    $body['payment_method'] ?? 'cash',
                    $body['currency'] ?? 'USD',
                    $body['language'] ?? 'en',
                    $promoCode,
                    round($subtotalUsd, 2),
                    round($discountUsd, 2),
                    $total,
                    0,
                    $status,
                    $receiptId,
                    currentTimestamp(),
                ]);
                $response = [
                    'id' => $bookingId,
                    'user_id' => $user['id'],
                    'service_id' => $service['id'],
                    'service_name' => $service['name'],
                    'quantity' => $quantity,
                    'event_date' => $body['event_date'],
                    'notes' => $body['notes'] ?? '',
                    'payment_method' => $body['payment_method'] ?? 'cash',
                    'currency' => $body['currency'] ?? 'USD',
                    'language' => $body['language'] ?? 'en',
                    'promo_code' => $promoCode,
                    'subtotal_usd' => round($subtotalUsd, 2),
                    'discount_usd' => round($discountUsd, 2),
                    'total' => $total,
                    'paid' => false,
                    'status' => $status,
                    'created_at' => currentTimestamp(),
                ];
                if ($receiptId) {
                    $response['receipt_id'] = $receiptId;
                    $pdo->prepare('INSERT INTO receipts (id, user_id, booking_id, number, service_name, service_id, amount, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
                        $receiptId,
                        $user['id'],
                        $bookingId,
                        'RCPT-' . strtoupper(substr($bookingId, 0, 8)),
                        $service['name'],
                        $service['id'],
                        $total,
                        $body['currency'] ?? 'USD',
                        'unpaid',
                        currentTimestamp(),
                    ]);
                }
                respondJson($response);
                break;
            }
            throw new RuntimeException('Method not allowed', 405);

        case '/admin/bookings':
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, true);
            $rows = $pdo->query('SELECT * FROM bookings ORDER BY created_at DESC')->fetchAll();
            respondJson($rows);
            break;

        case preg_match('#^/admin/bookings/([^/]+)/mark-paid$#', $relative, $matches) ? $relative : null:
            if ($method !== 'PUT') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, true);
            $stmt = $pdo->prepare('UPDATE bookings SET paid = 1, status = ? WHERE id = ?');
            $stmt->execute(['paid', $matches[1]]);
            $receiptStmt = $pdo->prepare('UPDATE receipts SET status = ? WHERE booking_id = ?');
            $receiptStmt->execute(['paid', $matches[1]]);
            respondJson(['ok' => true]);
            break;

        case '/receipts':
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo);
            $stmt = $pdo->prepare('SELECT * FROM receipts WHERE user_id = ? ORDER BY created_at DESC');
            $stmt->execute([$user['id']]);
            respondJson($stmt->fetchAll());
            break;

        case preg_match('#^/receipts/([^/]+)$#', $relative, $matches) ? $relative : null:
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo);
            $stmt = $pdo->prepare('SELECT * FROM receipts WHERE id = ? LIMIT 1');
            $stmt->execute([$matches[1]]);
            $receipt = $stmt->fetch();
            if (!$receipt) {
                respondJson(['detail' => 'Receipt not found'], 404);
                exit;
            }
            if ($receipt['user_id'] !== $user['id'] && !in_array($user['role'], ['admin', 'super_admin'], true)) {
                respondJson(['detail' => 'Forbidden'], 403);
                exit;
            }
            respondJson($receipt);
            break;

        case '/admin/receipts':
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, true);
            $rows = $pdo->query('SELECT * FROM receipts ORDER BY created_at DESC')->fetchAll();
            respondJson($rows);
            break;

        case '/receipts/scan':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, true);
            $imageBase64 = $body['image_base64'] ?? '';
            $rawData = [
                'merchant' => 'Maison Élégante',
                'date' => date('Y-m-d'),
                'items' => [['name' => 'Service Fee', 'qty' => 1, 'price' => 14.80]],
                'subtotal' => 13.70,
                'tax' => 1.10,
                'total' => 14.80,
                'currency' => 'USD',
            ];
            $id = uuid4();
            $pdo->prepare('INSERT INTO scanned_receipts (id, user_id, raw_data, created_at) VALUES (?, ?, ?, ?)')->execute([$id, $user['id'], json_encode($rawData, JSON_UNESCAPED_SLASHES), currentTimestamp()]);
            respondJson(['raw_data' => $rawData]);
            break;

        case '/admin/scanned-receipts':
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, true);
            $rows = $pdo->query('SELECT * FROM scanned_receipts ORDER BY created_at DESC')->fetchAll();
            respondJson($rows);
            break;

        case '/payments/checkout':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo);
            $bookingId = $body['booking_id'] ?? null;
            if (!$bookingId) {
                respondJson(['detail' => 'Missing booking_id'], 400);
                exit;
            }
            $sessionId = 'sess_' . strtoupper(substr(uuid4(), 0, 12));
            $checkoutUrl = 'https://example.com/checkout/' . $sessionId;
            $pdo->prepare('INSERT INTO payment_sessions (id, booking_id, session_id, checkout_url, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?)')->execute([uuid4(), $bookingId, $sessionId, $checkoutUrl, 'pending', currentTimestamp()]);
            respondJson(['checkout_url' => $checkoutUrl, 'session_id' => $sessionId]);
            break;

        case preg_match('#^/payments/status/([^/]+)$#', $relative, $matches) ? $relative : null:
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $stmt = $pdo->prepare('SELECT payment_status FROM payment_sessions WHERE session_id = ? LIMIT 1');
            $stmt->execute([$matches[1]]);
            $row = $stmt->fetch();
            respondJson(['payment_status' => $row['payment_status'] ?? 'pending']);
            break;

        case '/stripe/webhook':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            respondJson(['ok' => true]);
            break;

        case '/admin/analytics':
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, true);
            $totalUsers = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
            $totalBookings = (int) $pdo->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
            $paidBookings = (int) $pdo->query('SELECT COUNT(*) FROM bookings WHERE paid = 1')->fetchColumn();
            $totalRevenue = (float) $pdo->query('SELECT COALESCE(SUM(total),0) FROM bookings WHERE paid = 1')->fetchColumn();
            $pendingRevenue = (float) $pdo->query('SELECT COALESCE(SUM(total),0) FROM bookings WHERE paid = 0')->fetchColumn();
            $monthlyRows = $pdo->query('SELECT DATE_FORMAT(created_at, "%Y-%m") AS month, SUM(total) AS revenue, COUNT(*) AS count FROM bookings GROUP BY DATE_FORMAT(created_at, "%Y-%m") ORDER BY month')->fetchAll();
            $byCategoryRows = $pdo->query('SELECT service_name AS category, SUM(total) AS revenue FROM bookings GROUP BY service_name ORDER BY revenue DESC')->fetchAll();
            $byCurrencyRows = $pdo->query('SELECT currency, COUNT(*) AS count, SUM(total) AS paid_local FROM bookings WHERE paid = 1 GROUP BY currency')->fetchAll();
            $pendingByCurrencyRows = $pdo->query('SELECT currency, SUM(total) AS pending_local FROM bookings WHERE paid = 0 GROUP BY currency')->fetchAll();
            $byCurrency = [];
            foreach ($byCurrencyRows as $row) {
                $currency = $row['currency'];
                $byCurrency[] = [
                    'currency' => $currency,
                    'count' => (int) $row['count'],
                    'paid_local' => (float) $row['paid_local'],
                    'pending_local' => (float) ($pendingByCurrencyRows[array_search($currency, array_column($pendingByCurrencyRows, 'currency'))]['pending_local'] ?? 0),
                    'symbol' => ['USD' => '$', 'EUR' => '€', 'TZS' => 'TSh'][$currency] ?? '$',
                ];
            }
            respondJson([
                'total_users' => $totalUsers,
                'total_bookings' => $totalBookings,
                'paid_bookings' => $paidBookings,
                'total_revenue' => round($totalRevenue, 2),
                'pending_revenue' => round($pendingRevenue, 2),
                'monthly' => array_map(fn($row) => ['month' => $row['month'], 'revenue' => (float) $row['revenue'], 'count' => (int) $row['count']], $monthlyRows),
                'by_category' => array_map(fn($row) => ['category' => $row['category'], 'revenue' => (float) $row['revenue']], $byCategoryRows),
                'by_currency' => $byCurrency,
            ]);
            break;

        case '/admin/users':
            if ($method !== 'GET') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, true);
            $rows = $pdo->query('SELECT * FROM users ORDER BY created_at DESC')->fetchAll();
            foreach ($rows as &$row) {
                unset($row['password']);
            }
            respondJson($rows);
            break;

        case '/super-admin/create-admin':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, false, true);
            if (empty($body['firstName']) || empty($body['lastName']) || empty($body['phone']) || empty($body['email']) || empty($body['password'])) {
                respondJson(['detail' => 'Missing required fields'], 400);
                exit;
            }
            $id = uuid4();
            $pdo->prepare('INSERT INTO users (id, firstName, lastName, phone, email, address, city, country, continent, role, password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([$id, $body['firstName'], $body['lastName'], $body['phone'], $body['email'], '', '', '', '', 'admin', password_hash($body['password'], PASSWORD_BCRYPT), currentTimestamp()]);
            respondJson(['id' => $id, 'role' => 'admin', 'phone' => $body['phone']]);
            break;

        case preg_match('#^/super-admin/users/([^/]+)$#', $relative, $matches) ? $relative : null:
            if ($method !== 'DELETE') {
                throw new RuntimeException('Method not allowed', 405);
            }
            $user = requireAuth($pdo, false, true);
            $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
            $stmt->execute([$matches[1]]);
            respondJson(['ok' => true]);
            break;

        case '/cron/reminders':
            if ($method !== 'POST') {
                throw new RuntimeException('Method not allowed', 405);
            }
            respondJson(['ok' => true]);
            break;

        default:
            respondJson(['detail' => 'Not found'], 404);
            break;
    }
} catch (RuntimeException $e) {
    $status = $e->getCode() >= 400 ? $e->getCode() : 500;
    respondJson(['detail' => $e->getMessage()], $status);
}
