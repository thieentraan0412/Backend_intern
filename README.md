# DateMe — Backend API

> REST API cho ứng dụng hẹn hò mini — Node.js + Express + MongoDB Atlas

---

## 1. Tổ Chức Hệ Thống

### Kiến trúc tổng thể

```
Client (React)  ──HTTP/JSON──►  Express API  ──Mongoose──►  MongoDB Atlas
                                      │
                               JWT Middleware
                               (xác thực token)
```

Ứng dụng chia thành 3 tầng rõ ràng:

| Tầng | Vai trò |
|---|---|
| **Routing** (`routes/`) | Nhận request, validate input, trả response |
| **Middleware** (`middleware/`) | Xác thực JWT trước khi vào route bảo vệ |
| **Model** (`models/`) | Schema dữ liệu, tương tác với MongoDB |

### Cấu trúc thư mục

```
backend/
├── config/db.js          ← Kết nối MongoDB Atlas qua Mongoose
├── middleware/auth.js     ← Xác thực JWT, gắn req.user
├── models/
│   ├── User.js            ← Người dùng (tên, email, mật khẩu hash, hồ sơ)
│   ├── Like.js            ← Lượt thích giữa 2 người dùng
│   ├── Match.js           ← Cặp đôi đã match
│   └── Availability.js   ← Lịch trống của từng người trong một match
├── routes/
│   ├── auth.js            ← Đăng ký / Đăng nhập
│   ├── profile.js         ← Xem / cập nhật hồ sơ
│   ├── feed.js            ← Danh sách người dùng khác
│   ├── likes.js           ← Thích và phát hiện match
│   ├── matches.js         ← Danh sách match
│   └── availability.js   ← Lịch hẹn & tìm slot trùng
└── server.js              ← Entry point, mount routes, cấu hình CORS
```

---

## 2. Lưu Trữ Dữ Liệu

**Tất cả dữ liệu được lưu trên MongoDB Atlas** (cloud database) thông qua thư viện Mongoose.

Không dùng localStorage — localStorage chỉ được dùng ở **client** để lưu JWT token tạm thời.

### Các collection trong database

| Collection | Mô tả |
|---|---|
| `users` | Thông tin tài khoản và hồ sơ người dùng |
| `likes` | Ai đã thích ai (unique index ngăn like trùng) |
| `matches` | Cặp đôi đã match thành công |
| `availabilities` | Lịch trống của từng người trong từng match |

### Schema chi tiết

**User**
```
name, email, passwordHash (bcrypt), age, gender, bio, profileComplete
```

**Like**
```
fromUser (ref User), toUser (ref User)
Index unique: (fromUser, toUser)
```

**Match**
```
users: [ObjectId, ObjectId]  ← đúng 2 người dùng
```

**Availability**
```
matchId, userId,
slots: [{ date: "YYYY-MM-DD", startTime: "HH:MM", endTime: "HH:MM" }]
Index unique: (matchId, userId) ← mỗi người chỉ có 1 bản ghi per match
```

---

## 3. Logic Match Hoạt Động Thế Nào

Khi người dùng A nhấn "Like" người dùng B, hệ thống thực hiện theo thứ tự:

```
1. Kiểm tra A không tự like chính mình

2. Lưu Like { fromUser: A, toUser: B }
   (dùng upsert → không tạo bản ghi trùng)

3. Truy vấn: Có tồn tại Like { fromUser: B, toUser: A } không?
   │
   ├── KHÔNG có → trả về { matched: false }
   │              (chờ B like lại)
   │
   └── CÓ → Match đã xảy ra!
            │
            ├── Kiểm tra Match { users: [A, B] } đã tồn tại chưa?
            │   ├── ĐÃ có → trả về matchId hiện tại
            │   └── CHƯA → tạo Match mới → trả về matchId mới
            │
            └── Trả về { matched: true, matchId }
```

**Đặc điểm:**
- Phát hiện mutual like ngay tức thì, không cần polling
- Tự động tạo Match record một lần duy nhất
- Idempotent: like nhiều lần không tạo dữ liệu thừa

---

## 4. Logic Tìm Slot Trùng (First Common Slot)

Khi cả hai người trong match đều đã submit lịch trống, hệ thống tìm khung giờ chung sớm nhất.

### Thuật toán

```
Input:  slotsA = [...], slotsB = [...]

Bước 1: Sắp xếp cả hai danh sách theo (date ASC, startTime ASC)
        → Đảm bảo tìm được slot sớm nhất, không phụ thuộc thứ tự nhập

Bước 2: Duyệt từng cặp (slotA, slotB) cùng ngày:
        overlapStart = max(startA_phút, startB_phút)
        overlapEnd   = min(endA_phút,   endB_phút)

        Nếu overlapStart < overlapEnd:
          → Tìm thấy! Return { date, startTime, endTime }

Bước 3: Nếu không có cặp nào thỏa → Return null
```

### Ví dụ minh họa

```
A rảnh: 25/02  09:00 → 12:00
B rảnh: 25/02  10:30 → 14:00

overlapStart = max(540, 630) = 630  → 10:30
overlapEnd   = min(720, 840) = 720  → 12:00

Kết quả: "Hai bạn có date hẹn vào: 25/02/2026 10:30"
```

### Lý do dùng số phút thay vì Date object

- Tránh hoàn toàn lỗi timezone
- So sánh số nguyên đơn giản, nhanh, chính xác
- Không phụ thuộc locale của máy chủ

---

## 5. Tính Năng Đề Xuất: Gợi Ý Profile Thông Minh

### Ý tưởng

Thay vì hiển thị feed ngẫu nhiên, hệ thống tính **điểm tương thích** cho từng cặp người dùng và sắp xếp theo thứ tự giảm dần.

### Công thức tính điểm (0–100)

| Tiêu chí | Trọng số | Cách tính |
|---|---|---|
| **Giới tính** | 40% | Nam ↔ Nữ → 40đ; các trường hợp khác → 0đ |
| **Tuổi** | 30% | Chênh lệch 0–3 tuổi → 30đ; giảm dần theo khoảng cách |
| **Bio** | 30% | Đếm số từ khóa chung (sau khi lọc stop words) |

### Điểm tuổi chi tiết

```
Δage = |tuổi_A - tuổi_B|
Điểm = max(0, 30 - Δage * 3)
→ Chênh 0-2 tuổi: 30-24đ (gần lý tưởng)
→ Chênh 10 tuổi: 0đ
```

### Điểm bio

```
Tách bio thành từ khóa (bỏ stop words tiếng Việt: "và", "là", "của", ...)
Điểm = (số từ chung / max(lenA, lenB)) * 30

Ví dụ:
  A bio: "thích du lịch cà phê âm nhạc"
  B bio: "yêu du lịch và nghe nhạc cuối tuần"
  Từ chung: "du lịch", "âm nhạc/nhạc" → 2 từ
  Điểm ≈ (2/4) * 30 = 15đ
```

### Triển khai

- **Backend:** Thêm route `GET /api/feed/recommended` — tính điểm server-side, trả về danh sách đã sắp xếp kèm `compatibilityScore`
- **Frontend:** Tab "✨ Gợi ý" / "👥 Tất cả" trên FeedPage; badge `"92% phù hợp"` trên card; highlight từ khóa chung dưới dạng tag màu tím

---

## 6. Mô Tả API

Tất cả route bảo vệ yêu cầu header:
```
Authorization: Bearer <jwt_token>
```

### Auth

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Tạo tài khoản mới, trả về JWT |
| POST | `/api/auth/login` | Đăng nhập, trả về JWT |

**Register body:** `{ name, email, password }`
**Login body:** `{ email, password }`

---

### Profile 🔒

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/profile/me` | Lấy thông tin hồ sơ hiện tại |
| PUT | `/api/profile/me` | Cập nhật tên, tuổi, giới tính, bio |

**PUT body:** `{ name?, age?, gender?, bio? }` — tất cả không bắt buộc

---

### Feed 🔒

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/feed` | Danh sách tất cả người dùng trừ bản thân |

**Response:** `{ users: [...] }` — không bao gồm `passwordHash`

---

### Likes 🔒

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/likes/:userId` | Thích người dùng, tự động tạo Match nếu mutual |
| GET | `/api/likes/sent` | Danh sách những người mình đã thích |

**POST response:**
```json
{ "matched": true, "matchId": "..." }   // nếu trùng
{ "matched": false }                    // nếu chưa trùng
```

---

### Matches 🔒

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/matches` | Tất cả cặp đôi của người dùng hiện tại |

**Response:** `{ matches: [{ _id, users: [A, B], createdAt }] }`

---

### Availability 🔒

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/availability/:matchId` | Lưu (hoặc cập nhật) lịch trống |
| GET | `/api/availability/:matchId` | Lấy lịch trống của bản thân trong match |
| GET | `/api/availability/:matchId/common-slot` | Tìm khung giờ trùng nhau |

**POST body:**
```json
{
  "slots": [
    { "date": "2026-03-05", "startTime": "09:00", "endTime": "12:00" }
  ]
}
```

**GET common-slot response:**
```json
// Cả hai đã submit + có slot trùng
{ "ready": true, "found": true, "message": "Hai bạn có date hẹn vào: ..." }

// Cả hai đã submit + không có slot trùng
{ "ready": true, "found": false, "message": "Chưa tìm được thời gian trùng..." }

// Đối phương chưa submit
{ "ready": false }
```

---

### Mã Lỗi

| Status | Ý nghĩa |
|---|---|
| 400 | Thiếu/sai dữ liệu đầu vào |
| 401 | Chưa đăng nhập hoặc token hết hạn |
| 403 | Không có quyền truy cập tài nguyên này |
| 404 | Không tìm thấy |
| 409 | Xung đột (ví dụ: email đã tồn tại) |
| 500 | Lỗi server |

---

*Được xây dựng cho bài kiểm tra tuyển dụng Web Developer Intern tại Clique83.com*
