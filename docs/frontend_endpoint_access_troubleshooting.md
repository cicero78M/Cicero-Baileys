# Panduan Troubleshooting: Web Endpoint Tidak Bisa Diakses dari Frontend

> **Note**: Dokumen ini dibuat untuk membantu frontend developers mengatasi masalah koneksi dengan backend API Cicero V2.

## Ringkasan Masalah Umum

Ketika frontend tidak bisa mengakses web endpoint backend, biasanya disebabkan oleh salah satu dari:
1. **Konfigurasi CORS yang salah**
2. **Autentikasi/Token tidak valid**
3. **Request deduplication**
4. **Premium subscription expired**

---

## 1. Konfigurasi CORS

### Gejala
- Error di browser console: `CORS policy: No 'Access-Control-Allow-Origin' header`
- Network request status: `(failed)` atau `CORS error`
- Preflight OPTIONS request gagal

### Penyebab
- Environment variable `CORS_ORIGIN` tidak di-set atau kosong
- `CORS_ORIGIN` tidak match dengan origin frontend

### Solusi

#### Backend Configuration
Pastikan file `.env` di backend memiliki:
```bash
CORS_ORIGIN=http://localhost:3000
```

**Untuk Production:**
```bash
# Single origin
CORS_ORIGIN=https://dashboard.example.com

# Multiple origins (tidak disupport langsung, gunakan proxy atau custom logic)
```

**Default Value:** Jika tidak di-set, default adalah `*` (allow all origins) dari `src/config/env.js` line 15.

#### Frontend Configuration
Pastikan request menggunakan credentials jika diperlukan:
```javascript
// Fetch API
fetch('http://localhost:3000/api/endpoint', {
  credentials: 'include', // Penting untuk cookie-based auth
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
})

// Axios
axios.defaults.withCredentials = true;
```

#### Verifikasi
```bash
# Check CORS headers dari backend
curl -I -X OPTIONS http://localhost:3000/api/endpoint \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET"

# Response harus include:
# Access-Control-Allow-Origin: http://localhost:3000
# Access-Control-Allow-Credentials: true
```

---

## 2. Autentikasi & Token

### Gejala
- HTTP Status: `401 Unauthorized`
- Response: `{ "success": false, "message": "Token required" }` atau `"Invalid token"`
- Request berhasil tapi response tidak sesuai ekspektasi

### Penyebab
Sebagian besar `/api/*` routes memerlukan JWT token yang valid (kecuali `/api/auth`, `/api/claim`, `/api/password-reset`, `/api/health/wa`).

Lihat `app.js` line 111-112:
```javascript
// ===== ROUTE LAIN (WAJIB TOKEN) =====
app.use('/api', authRequired, routes);
```

### Solusi

#### 1. Login Terlebih Dahulu
```javascript
// Dashboard login
const response = await fetch('http://localhost:3000/api/auth/dashboard-login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const data = await response.json();
const token = data.token; // Simpan untuk request selanjutnya
```

#### 2. Kirim Token di Setiap Request
Ada 2 cara mengirim token:

**Opsi A: Authorization Header (Recommended)**
```javascript
fetch('http://localhost:3000/api/endpoint', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
})
```

**Opsi B: Cookie (Otomatis jika `credentials: 'include'`)**
```javascript
// Token otomatis dikirim jika:
// 1. Backend set cookie dengan nama 'token'
// 2. Frontend menggunakan credentials: 'include'
fetch('http://localhost:3000/api/endpoint', {
  credentials: 'include'
})
```

#### 3. Handle Token Expiry
```javascript
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': 'Bearer ' + getToken()
    }
  });

  if (response.status === 401) {
    // Token expired, redirect to login
    window.location.href = '/login';
    return;
  }

  return response.json();
}
```

---

## 3. Request Deduplication

### Gejala
- HTTP Status: `429 Too Many Requests`
- Response: `"Duplicate request detected"`
- Request POST/PUT kedua gagal dalam 5 menit

### Penyebab
Middleware `dedupRequest` mencegah request duplikat dalam 5 menit untuk POST/PUT requests (kecuali endpoint tertentu).

Lihat `src/middleware/dedupRequestMiddleware.js`.

### Solusi

#### Development/Testing
Nonaktifkan deduplication dengan set di `.env`:
```bash
ALLOW_DUPLICATE_REQUESTS=true
```

#### Production
Hindari mengirim request duplikat:
```javascript
// Gunakan request state untuk prevent double submit
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit() {
  if (isSubmitting) return; // Prevent duplicate
  
  setIsSubmitting(true);
  try {
    await apiRequest('/api/endpoint', { method: 'POST', ... });
  } finally {
    setIsSubmitting(false);
  }
}
```

#### Bypass untuk Endpoint Tertentu
Beberapa endpoint exempt dari deduplication:
- `/api/auth/dashboard-login`
- `/api/claim/*`
- Routes yang dimulai dengan `/api/insta/`
- Routes yang dimulai dengan `/api/tiktok/`

---

## 4. Premium Subscription Check

### Gejala
- HTTP Status: `403 Forbidden`
- Response: `{ "success": false, "message": "Premium subscription expired or invalid tier" }`
- Endpoint tertentu tidak bisa diakses

### Penyebab
Beberapa endpoint memerlukan premium subscription yang aktif:
- `/api/dashboard/anev`
- Routes dengan `dashboardPremiumGuard` middleware

### Solusi

#### Check Premium Status
```javascript
// Get user info termasuk premium status
const response = await fetch('http://localhost:3000/api/dashboard/user-info', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const userData = await response.json();
console.log('Premium tier:', userData.premium_tier);
console.log('Expires at:', userData.premium_expires_at);
```

#### Hubungi Admin
Jika premium expired atau tier tidak sesuai, hubungi administrator untuk upgrade/renewal.

---

## 5. Operator Role Restrictions

### Gejala
- HTTP Status: `403 Forbidden`
- Response: `{ "success": false, "message": "Forbidden" }`
- User dengan role `operator` tidak bisa akses endpoint tertentu

### Penyebab
Role `operator` hanya bisa akses endpoint tertentu dalam whitelist (lihat `src/middleware/authMiddleware.js` line 4-29).

### Solusi

#### Check Allowed Paths untuk Operator
Operator **HANYA** bisa akses:
- `/api/clients/profile` (exact)
- `/api/aggregator/*` (prefix)
- `/api/amplify/rekap` (exact)
- `/api/amplify/rekap-khusus` (exact)
- `/api/dashboard/stats` (exact)
- `/api/dashboard/komplain/insta` (exact)
- `/api/dashboard/komplain/tiktok` (exact)
- `/api/insta/rekap-likes` (exact)
- `/api/tiktok/rekap-komentar` (exact)
- `/api/users` (exact, GET only)
- `/api/users/create` (exact, POST)
- `/api/users/list` (exact, GET)
- `PUT /api/users/:id`
- `POST /api/link-reports`
- `PUT /api/link-reports/:id`

#### Solusi
Pastikan user memiliki role yang sesuai (`admin`, `client`, atau `direktorat`) untuk akses endpoint di luar whitelist.

---

## 6. Common Setup Issues

### Missing .env File
**Gejala:** Backend crash saat startup dengan error `JWT_SECRET required`

**Solusi:**
```bash
# Copy dari template
cp .env.example .env

# Edit dan isi nilai yang diperlukan
nano .env
```

### Redis Connection Error
**Gejala:** Error di console `Redis connection failed`

**Solusi:**
```bash
# Pastikan Redis running
redis-cli ping  # Should return PONG

# Atau start Redis
redis-server

# Update .env
REDIS_URL=redis://localhost:6379
```

### Port Already in Use
**Gejala:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solusi:**
```bash
# Check port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Atau gunakan port lain di .env
PORT=3001
```

---

## Debugging Checklist

Gunakan checklist ini untuk troubleshoot masalah koneksi frontend-backend:

### Backend
- [ ] `.env` file exists dan configured properly
- [ ] `CORS_ORIGIN` di-set (e.g., `http://localhost:3000`)
- [ ] `JWT_SECRET` di-set
- [ ] Redis running dan accessible
- [ ] Backend server running di port yang benar
- [ ] Check backend logs untuk error messages

### Frontend
- [ ] Using correct backend URL (e.g., `http://localhost:3000/api`)
- [ ] Sending `Authorization: Bearer <token>` header
- [ ] Using `credentials: 'include'` untuk cookie-based auth
- [ ] Token valid dan belum expired
- [ ] User memiliki role/permissions yang sesuai
- [ ] Tidak mengirim duplicate requests
- [ ] Check browser console untuk CORS errors

### Network
```bash
# Test basic connectivity
curl http://localhost:3000/
# Should return: {"status":"ok"}

# Test dengan token
curl http://localhost:3000/api/endpoint \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test CORS
curl -I -X OPTIONS http://localhost:3000/api/endpoint \
  -H "Origin: http://localhost:3000"
```

---

## Quick Reference: Endpoint Access

| Endpoint | Auth Required | Special Requirements |
|----------|---------------|---------------------|
| `GET /` | ❌ | None |
| `POST /api/auth/dashboard-login` | ❌ | None |
| `POST /api/claim/*` | ❌ | None |
| `POST /api/password-reset/*` | ❌ | None |
| `GET /api/health/wa` | ❌ | None |
| `GET /api/*` (other) | ✅ | Valid JWT token |
| `POST /api/dashboard/anev` | ✅ | Premium subscription + specific role |
| `POST /api/dashboard/komplain/*` | ✅ | Dashboard user + valid client_ids |

---

## Mendapatkan Bantuan

Jika masih mengalami masalah setelah mengikuti panduan ini:

1. **Check Backend Logs:**
   ```bash
   # Di terminal backend
   npm run dev
   # atau
   pm2 logs cicero
   ```

2. **Check Browser Console:**
   - Buka Developer Tools (F12)
   - Tab Console untuk JavaScript errors
   - Tab Network untuk request/response details

3. **Dokumentasi Terkait:**
   - [Frontend Complaint API Guide](./frontend_complaint_api_guide.md)
   - [Login API Guide](./login_api.md)
   - [Combined Overview](./combined_overview.md)

4. **Contact:**
   - Open issue di repository
   - Sertakan error message lengkap
   - Sertakan network request details (method, headers, payload)
