# 🚀 DateMe – Backend API

REST API cho ứng dụng hẹn hò **DateMe**, xây dựng bằng **Node.js + Express + MongoDB Atlas**.

---

## 📦 Tech Stack

| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Node.js | ≥ 18 | Runtime |
| Express | ^4.18 | Web framework |
| MongoDB Atlas | - | Database (cloud) |
| Mongoose | ^8.2 | ODM |
| bcryptjs | ^2.4 | Hash password |
| jsonwebtoken | ^9.0 | JWT auth |
| dotenv | ^16.4 | Biến môi trường |
| nodemon | ^3.1 | Dev server auto-reload |

---

## 📁 Cấu Trúc Thư Mục

```
backend/
├── config/
│   └── db.js               # Kết nối MongoDB Atlas
├── middleware/
│   └── auth.js             # Middleware xác thực JWT (verifyToken)
├── models/
│   ├── User.js             # Schema user (name, email, passwordHash, age, gender, bio)
│   ├── Like.js             # Schema like (fromUser → toUser)
│   ├── Match.js            # Schema match (users: [A, B])
│   └── Availability.js     # Schema lịch hẹn (matchId, userId, slots[])
├── routes/
│   ├── auth.js             # POST /register, POST /login
│   ├── profile.js          # GET & PATCH /profile
│   ├── feed.js             # GET /feed (danh sách gợi ý)
│   ├── likes.js            # POST /likes/:userId, GET /likes/sent
│   ├── matches.js          # GET /matches
│   └── availability.js     # POST & GET /availability/:matchId
├── .env                    # Biến môi trường (KHÔNG commit)
├── .env.example            # Mẫu .env
├── server.js               # Entry point
└── package.json
```

---

## ⚙️ Cài Đặt & Chạy

### 1. Cài dependencies

```bash
npm install
```

### 2. Tạo file `.env`

Sao chép từ `.env.example`:

```bash
cp .env.example .env
```

Điền vào các giá trị:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<App>
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
```

### 3. Chạy development server

```bash
npm run dev        # nodemon – auto-reload khi sửa file
```

### 4. Chạy production

```bash
npm start          # node server.js
```

Server mặc định chạy tại: **http://localhost:5000**

---

## 🌐 API Endpoints

### 🔐 Auth — `/api/auth`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/api/auth/register` | Đăng ký tài khoản mới | ❌ |
| POST | `/api/auth/login` | Đăng nhập, nhận JWT | ❌ |

**Body đăng ký:**
```json
{ "name": "Thien", "email": "user@gmail.com", "password": "123456" }
```

**Body đăng nhập:**
```json
{ "email": "user@gmail.com", "password": "123456" }
```

**Response thành công:**
```json
{ "token": "<JWT>", "user": { "_id": "...", "name": "Thien", "email": "..." } }
```

---

### 👤 Profile — `/api/profile`

> Tất cả đều yêu cầu `Authorization: Bearer <token>`

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/profile` | Lấy thông tin profile của mình |
| PATCH | `/api/profile` | Cập nhật age, gender, bio |

**Body PATCH:**
```json
{ "age": 23, "gender": "male", "bio": "Thích cà phê và du lịch" }
```

---

### 🔍 Feed — `/api/feed`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/api/feed` | Danh sách user gợi ý (chưa like, đã hoàn thiện profile) | ✅ |

---

### ❤️ Likes — `/api/likes`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/api/likes/:userId` | Like một user. Nếu mutual → tạo Match | ✅ |
| GET | `/api/likes/sent` | Lấy danh sách user mình đã like | ✅ |

**Response khi match:**
```json
{ "matched": true, "matchId": "64f3...", "message": "It's a Match! 🎉" }
```

---

### 💞 Matches — `/api/matches`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/api/matches` | Danh sách tất cả matches của user hiện tại | ✅ |

---

### 📅 Availability — `/api/availability`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/api/availability/:matchId` | Lưu/cập nhật các time slot | ✅ |
| GET | `/api/availability/:matchId` | Lấy time slot của mình trong match | ✅ |
| GET | `/api/availability/:matchId/common-slot` | Tìm slot trùng sớm nhất giữa 2 người | ✅ |

**Body POST:**
```json
{
  "slots": [
    { "date": "2026-03-01", "startTime": "14:00", "endTime": "17:00" },
    { "date": "2026-03-03", "startTime": "09:00", "endTime": "11:00" }
  ]
}
```

**Response common-slot khi tìm thấy:**
```json
{
  "ready": true,
  "found": true,
  "message": "Hai bạn có date hẹn vào: Thứ Bảy, 1 tháng 3 năm 2026 14:00",
  "slot": { "date": "2026-03-01", "startTime": "14:00", "endTime": "16:00" }
}
```

---

### 🏥 Health Check

```
GET /api/health
```
```json
{ "status": "ok", "timestamp": "2026-02-24T07:00:00.000Z" }
```

---

## 🗃️ Database Models

### User
```
name          String   required
email         String   required, unique, lowercase
passwordHash  String   required (bcrypt hash, tự động khi save)
age           Number   18–99
gender        String   enum: male | female | non-binary | other
bio           String   max 500 ký tự
profileComplete Boolean default: false
```

### Like
```
fromUser  ObjectId → User   required
toUser    ObjectId → User   required
Index unique: { fromUser, toUser }
```

### Match
```
users  [ObjectId → User]   (2 phần tử)
Index: { users }
```

### Availability
```
matchId  ObjectId → Match   required
userId   ObjectId → User    required
slots    [{ date, startTime, endTime }]
Index unique: { matchId, userId }
```

---

## 🔒 Authentication Flow

```
1. Client gửi POST /api/auth/login  →  Server trả JWT (7 ngày)
2. Client lưu token vào localStorage
3. Mọi request sau: Header "Authorization: Bearer <token>"
4. Middleware verifyToken:
     - Giải mã JWT
     - Tìm user trong DB
     - Gắn vào req.user
     - Nếu lỗi → 401 Unauthorized
```

---

## 🔁 Match Flow

```
User A like B  →  Like { fromUser: A, toUser: B } được lưu
User B like A  →  Kiểm tra mutual like
                  → Match { users: [A, B] } được tạo
Cả 2 vào Schedule → Mỗi người submit Availability
                  → Server tìm slot trùng sớm nhất
                  → Trả về thời gian hẹn
```

---

## 🛠️ Development Notes

- `passwordHash` được hash tự động bởi Mongoose **pre-save hook** (bcrypt, 12 rounds).
- `toJSON()` của User tự động xóa `passwordHash` trước khi gửi về client.
- Feed loại trừ: chính mình, người đã like, người đã match, user chưa `profileComplete`.
- Availability dùng thuật toán **O(n²) overlap** – đủ dùng với số slot nhỏ (≤ 7 slot mỗi người).

---

## 📌 Biến Môi Trường

| Biến | Bắt buộc | Mô tả |
|------|---------|-------|
| `PORT` | ❌ | Port server (default: 5000) |
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Secret key để ký JWT (nên dài ≥ 32 ký tự) |
| `JWT_EXPIRES_IN` | ❌ | Thời hạn token (default: `7d`) |
| `CLIENT_URL` | ❌ | Origin frontend cho CORS (default: `http://localhost:5173`) |
