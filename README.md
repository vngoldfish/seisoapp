# 🏨 OUTINKS / SeisoApp — Hotel Housekeeping Management

Ứng dụng quản lý dọn phòng khách sạn đa chi nhánh, hỗ trợ Admin, Lễ tân, Kacho, Checker và Housekeeping. Giao diện responsive/PWA, đa ngôn ngữ Việt/Nhật/Anh, có thể chạy ở 3 chế độ dữ liệu: Local Storage, Firebase Firestore hoặc Express + PostgreSQL.

> Lưu ý product: cơ chế đăng nhập hiện tại vẫn là demo/client-side để vận hành nội bộ hoặc thử nghiệm. Nếu triển khai Internet/public production, cần bổ sung authentication thật sự ở backend/Firebase Auth và database security rules.

## Tính năng chính

- Quản lý nhiều chi nhánh khách sạn.
- Phân quyền vai trò: Admin, Front Desk, Kacho, Checker, Housekeeping.
- Sơ đồ phòng realtime theo ngày làm việc.
- Phân công nhân sự dọn phòng theo ngày.
- Luồng housekeeping/checker/front desk cho phòng dirty/clean/checked/reclean/DND/ECO/maintenance.
- Khóa/chốt ngày làm việc để đóng băng dữ liệu sau khi hoàn tất.
- Báo cáo thống kê và lịch sử chốt ngày.
- PWA/service worker cho production build.

## Công nghệ

- React 19 + TypeScript + Vite.
- Tailwind CSS 4 plugin + CSS custom variables.
- Lucide React icons, Canvas Confetti.
- Data providers:
  - Local Storage/BroadcastChannel mặc định.
  - Firebase Firestore khi cấu hình Firebase env vars.
  - Express + PostgreSQL khi `VITE_USE_POSTGRES=true`.
- Backend: Express, Socket.IO, pg/PostgreSQL.
- Docker/Nginx cho triển khai frontend + backend + database.

## Cài đặt frontend

```bash
npm install
npm run dev
```

Mặc định app chạy ở `http://localhost:5173/`.

Build production:

```bash
npm run build
npm run preview
```

Kiểm tra chất lượng:

```bash
npm run lint
npm run build
```

Nếu test tooling được cài trong môi trường của bạn:

```bash
npm run test:run
```

## Cấu hình môi trường

Copy `.env.example` thành `.env` và chỉnh theo mode chạy.

### Local Storage mode

Không cần Firebase/Postgres. Để trống Firebase vars và không bật Postgres:

```env
VITE_USE_POSTGRES=false
```

### Firebase mode

Điền đầy đủ các biến Firebase trong `.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Khi Firebase vars hợp lệ, app tự dùng Firestore provider.

### PostgreSQL/backend mode

```env
VITE_USE_POSTGRES=true
VITE_BACKEND_URL=http://localhost:4000
DATABASE_URL=postgres://postgres:change_me_before_deploy@localhost:5432/seisoapp
PORT=4000
CORS_ORIGIN=http://localhost:5173
```

Chạy backend thủ công:

```bash
cd server
npm install
npm start
```

Healthcheck backend:

```text
GET http://localhost:4000/health
```

## Docker Compose

Tạo `.env` từ `.env.example`, bắt buộc đổi mật khẩu database:

```env
POSTGRES_PASSWORD=your_real_secure_password
CORS_ORIGIN=http://localhost:8085
```

Sau đó chạy:

```bash
docker compose up -d --build
```

Frontend sẽ được phục vụ qua Nginx ở port `8085`, backend ở `4000`.

## Tài khoản demo mặc định

Local demo seed có Admin:

- `admin` / `admin123`

Các tài khoản branch demo phụ thuộc data seed hiện tại trong `src/db/localDB.ts` hoặc dữ liệu đã tạo trong database. Mật khẩu demo theo pattern trong client hiện tại: username + `123`, với một số ngoại lệ cũ như `front1/front123`.

## Verification smoke test

Sau khi sửa hoặc deploy, nên kiểm tra:

1. Clear/corrupt localStorage rồi reload: app không trắng màn hình.
2. Login admin/front desk/checker/kacho/housekeeping.
3. Chuyển hotel và active date; rooms/logs/stats phải theo đúng ngày.
4. Housekeeping finish/revert room; dữ liệu không lẫn giữa hotel/date/user.
5. Admin lock date rồi thử mutate từ housekeeping/front desk/checker: không được đổi dữ liệu và hiển thị cảnh báo rõ.
6. Firebase/Postgres mode: admin stats và housekeeping active-staff login không đọc nhầm localStorage.
7. Production preview/PWA: chỉ `/sw.js` là service worker chính, cache cũ được cleanup.

## Ghi chú bảo mật production

- Không commit `.env` thật.
- Không dùng password mặc định trong Docker Compose.
- Không public app nếu chưa có auth/server-side authorization thực sự.
- Cấu hình `CORS_ORIGIN` theo domain frontend thật, không dùng `*` cho production public.
- Production sourcemap mặc định tắt; chỉ bật `VITE_ENABLE_SOURCEMAP=true` khi thật sự cần debug deploy.
