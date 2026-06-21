# 🏨 Claude Developer Guide - Hotel Housekeeping Management (Seisoapp / OUTINKS)

Chào mừng bạn đến với tài liệu hướng dẫn phát triển dự án **Hotel Housekeeping Management (Seisoapp)**. Tài liệu này được biên soạn chi tiết nhằm giúp các AI Assistant (như Claude, Gemini) nhanh chóng nắm bắt cấu trúc dự án, luồng dữ liệu, cách thức vận hành và các tiêu chuẩn coding để thực hiện nhiệm vụ một cách chuẩn xác nhất.

---

## 📌 1. Tổng Quan Dự Án

Dự án là một hệ thống quản lý dọn phòng khách sạn chuyên nghiệp, tối ưu hóa giao diện đa thiết bị (Desktop, Tablet, Mobile) với thiết kế **Glassmorphic** hiện đại. Giao diện sang trọng và sống động nhờ các lớp kính mờ và phối hợp màu sắc tinh tế. Hệ thống được xây dựng để hỗ trợ:
*   **Đa chi nhánh khách sạn (Multi-Tenancy):** Phân tách dữ liệu cô lập giữa các chi nhánh (`ks1`, `ks2`,...) thông qua cơ chế prefix hoặc phân vùng database.
*   **Phân quyền chi tiết (Role-Based Access Control):** Admin, Kacho (Quản lý phân khu), Checker (Giám sát/Kiểm phòng), Front Desk (Lễ tân), Housekeeping (Nhân viên dọn phòng).
*   **Đa chế độ Database:** Chạy offline hoàn toàn qua LocalStorage + BroadcastChannel, hoặc chạy online đồng bộ qua Firestore / PostgreSQL.
*   **Realtime Synchronization:** Đồng bộ dữ liệu thời gian thực giữa các tab hoặc các thiết bị bằng Socket.io (chế độ Postgres) và Firestore Listeners (chế độ Firebase).
*   **Tối ưu hóa Mobile & PWA:** Responsive mượt mà, popup chuyển đổi thành Bottom-Sheet trên điện thoại, cài đặt dạng PWA với Service Worker.

---

## 📁 2. Cấu Trúc Thư Mục Dự Án

Dưới đây là sơ đồ cấu trúc thư mục chính của dự án:

```
OUTINKS/
├── .github/                   # Cấu hình GitHub Actions
├── server/                    # Backend Server (Node.js/Express + PostgreSQL + Socket.io)
│   ├── db.js                  # Cấu hình Pool kết nối PostgreSQL
│   ├── index.js               # REST API & WebSocket Server
│   ├── init.sql               # File khởi tạo Database Schema cho PostgreSQL
│   └── package.json
├── src/                       # Frontend Source Code (React + TypeScript + Vite)
│   ├── assets/                # Tài nguyên tĩnh (Hình ảnh, Âm thanh, v.v.)
│   ├── components/            # Các React Components phân chia theo vai trò
│   │   ├── Admin/             # Giao diện cho Admin hệ thống
│   │   │   ├── components/    # Các tab chức năng trong Admin Dashboard
│   │   │   └── AdminDashboard.tsx
│   │   ├── Checker/           # Giao diện cho Checker (Giám sát)
│   │   │   └── CheckerDashboard.tsx
│   │   ├── Common/            # Các thành phần dùng chung (Login, Header, Contexts, v.v.)
│   │   │   ├── AppContext.tsx # Context quản lý State toàn cục (Auth, Language, Theme, Locks)
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Login.tsx
│   │   │   └── ToastList.tsx
│   │   ├── FrontDesk/         # Giao diện cho Lễ tân
│   │   │   └── FrontDeskDashboard.tsx
│   │   └── Housekeeping/      # Giao diện cho Nhân viên dọn phòng (Mobile-First)
│   │       └── HousekeepingDashboard.tsx
│   ├── db/                    # Lớp trừu tượng hóa Cơ sở dữ liệu (Database Drivers)
│   │   ├── dbInterface.ts     # Interface định nghĩa các phương thức DB bắt buộc
│   │   ├── firebaseDB.ts      # Driver kết nối Firebase Firestore & Proxy DB router
│   │   ├── localDB.ts         # Driver chạy offline sử dụng LocalStorage + BroadcastChannel
│   │   └── postgresDB.ts      # Driver kết nối PostgreSQL thông qua REST API & Socket.io
│   ├── i18n/                  # Hỗ trợ đa ngôn ngữ (Vietnamese, Japanese, English)
│   │   └── translations.ts
│   ├── styles/                # Stylesheets của dự án
│   │   ├── variables.css      # CSS Variables (Màu sắc, Glassmorphic variables)
│   │   ├── main.css           # Cấu hình bố cục, Reset CSS và Utility classes
│   │   └── components.css     # CSS cho các Custom UI Components (Card, Table, Button, Dialog)
│   ├── App.tsx                # Component gốc điều hướng vai trò và quản lý layout
│   ├── index.css              # File CSS chính import Tailwind & CSS files khác
│   ├── main.tsx               # Điểm khởi đầu của ứng dụng React
│   └── vite-env.d.ts
├── Dockerfile                 # Dockerfile cho Frontend
├── Dockerfile.backend         # Dockerfile cho Backend
├── docker-compose.yml         # Container hóa toàn bộ hệ thống (Frontend + Backend + Postgres)
├── nginx.conf                 # Cấu hình Nginx phục vụ PWA Frontend
├── package.json               # Cấu hình gói và script của Frontend
├── tsconfig.json              # Cấu hình TypeScript
└── vite.config.ts             # Cấu hình Vite (Tích hợp Tailwind CSS v4 & Path Aliases)
```

---

## 💾 3. Kiến Trúc Cơ Sở Dữ Liệu (Database Architecture)

Hệ thống sử dụng mô hình trừu tượng hóa cơ sở dữ liệu để hỗ trợ linh hoạt 3 chế độ lưu trữ: **Local Storage** (Offline), **Firebase Firestore** (Serverless), và **PostgreSQL** (Self-hosted).

### 3.1. Các Đối Tượng Dữ Liệu Chính (Data Models)

Các model được định nghĩa trong [dbInterface.ts](file:///c:/Users/Admin/Desktop/server/OUTINKS/src/db/dbInterface.ts):

*   **User:**
    ```typescript
    export interface User {
      id: string;
      username: string;
      role: 'admin' | 'front_desk' | 'housekeeping' | 'checka' | 'kacho';
      pin?: string;
      name: string;
      language: 'ja' | 'vi' | 'en';
      hotelIds?: string[]; // Danh sách ID khách sạn được phép truy cập
      status?: 'working' | 'quit';
    }
    ```
*   **Room:**
    ```typescript
    export interface Room {
      id: string; // Định dạng "{hotelId}_{roomNumber}" hoặc chỉ "roomNumber"
      roomNumber: string;
      floor: number;
      type: string; // Ví dụ: "SSn", "TWn", "JAPn", "STW"
      status: 'vacant' | 'occupied' | 'dirty' | 'cleaning' | 'clean' | 'maintenance' | 'eco' | 'dnd';
      isStay: boolean; // Phòng khách ở tiếp (true = hiển thị tag [S]) hay Checkout (false = hiển thị tag [O])
      guestCount: number; // Số lượng khách dự kiến
      notes?: string;
      assignedTo?: string; // ID của Housekeeper được phân công
      cleanerName?: string; // Tên hiển thị của Housekeeper
      isChecked?: boolean; // Đã được Checker nghiệm thu chưa
      checkedBy?: string;
      checkedAt?: string;
      priority?: 'normal' | 'rush'; // Độ ưu tiên dọn dẹp
      photoDefect?: string; // Ảnh chụp lỗi nếu Checker yêu cầu dọn lại (base64)
      updatedAt: string;
      updatedBy: string;
    }
    ```
*   **CleaningLog (Lịch sử dọn phòng):**
    ```typescript
    export interface CleaningLog {
      id: string;
      roomId: string;
      roomNumber: string;
      floor: number;
      cleanerId: string;
      cleanerName: string;
      startedAt: string; // ISO String
      endedAt: string; // ISO String
      durationMinutes: number;
      photoBefore?: string; // Ảnh chụp trước khi dọn (base64)
      photoAfter?: string; // Ảnh chụp sau khi dọn xong (base64)
      notes?: string;
      errors?: string[]; // Danh sách lỗi checker phát hiện
      checkedBy?: string;
      checkedAt?: string;
    }
    ```

### 3.2. Cấu Trúc Database Schema (PostgreSQL)

Được định nghĩa trong [init.sql](file:///c:/Users/Admin/Desktop/server/OUTINKS/server/init.sql):
*   `hotels`: Lưu thông tin khách sạn, phòng ban mặc định và cấu hình thời gian dọn trung bình.
*   `users`: Lưu thông tin nhân sự và phân quyền.
*   `daily_rooms`: Lưu trạng thái phòng dọn dẹp hàng ngày. Định danh chính (`id`) là `{hotel_id}_{room_number}_{date}` để hỗ trợ lưu lịch sử trạng thái từng ngày.
*   `cleaning_logs`: Lưu chi tiết các lượt dọn phòng của Housekeeper.
*   `active_staff`: Nhân viên được phân công làm việc trong ngày (Housekeeper cần phải có tên trong bảng này mới có thể đăng nhập vào ngày đó).
*   `day_locks`: Khóa ngày làm việc, ngăn không cho sửa đổi trạng thái phòng hoặc tạo log sau khi ngày đã chốt.
*   `finalized_day_reports`: Báo cáo tổng kết cuối ngày sau khi chốt sổ.

### 3.3. Cơ Chế Phân Phối Query qua Proxy DB

Một lớp proxy thông minh `DatabaseProxy` trong [firebaseDB.ts](file:///c:/Users/Admin/Desktop/server/OUTINKS/src/db/firebaseDB.ts) tự động định tuyến các yêu cầu gọi cơ sở dữ liệu dựa trên các biến môi trường:
*   Nếu `import.meta.env.VITE_USE_POSTGRES === 'true'`: Sử dụng `PostgresDB`.
*   Nếu Firebase được cấu hình đầy đủ trong `.env`: Sử dụng `FirebaseDB`.
*   Mặc định: Sử dụng `LocalDB` (chạy offline trên trình duyệt).

---

## 🔐 4. Xác Thực & Cơ Chế Đăng Nhập (Authentication & Security)

Hệ thống có cơ chế kiểm tra tài khoản và phân quyền đặc thù:

1.  **Dữ Liệu Mẫu Đăng Nhập:**
    *   **Sakura Hotel (`ks1`):**
        *   System Admin: `admin` / `admin123`
        *   Kacho (Manager): `kacho1` / `kacho1123`
        *   Checker: `check1` / `check1123`
        *   Front Desk: `front1` / `front123` hoặc `front1123`
        *   Cleaner: `cleaner1` / `cleaner1123` hoặc `cleaner2` / `cleaner2123`
    *   **Fuji Hotel (`ks2`):**
        *   Front Desk: `front2` / `front2123`
        *   Cleaner: `cleaner3` / `cleaner3123` hoặc `cleaner4` / `cleaner4123`
    *   **Quy luật mật khẩu mặc định chung:** `username` + `123` (trừ một số tài khoản đặc biệt ở trên).

2.  **Ràng Buộc Đăng Nhập Đối Với Housekeeper (Nhân Viên Dọn Phòng):**
    *   Để đăng nhập thành công vào ngày hiện tại, tài khoản Housekeeper phải nằm trong danh sách **Active Staff** của ngày đó (được Kacho hoặc Admin cấu hình).
    *   Nếu không có lịch làm việc, hệ thống sẽ chặn đăng nhập kèm thông báo: *"Hôm nay bạn không có lịch dọn phòng. Vui lòng liên hệ Lễ tân/Admin."*
    *   Khi đăng nhập thành công, hệ thống tự động khóa ngày làm việc của Housekeeper là ngày hôm nay (họ không thể xem dữ liệu lịch sử ngày khác).

3.  **Điều Hướng Sau Đăng Nhập (Routing):**
    *   Tất cả tài khoản phi-admin (Front Desk, Checker, Kacho, Cleaner) sau khi đăng nhập sẽ được chuyển hướng tới trang chọn chi nhánh khách sạn (**Portal**).
    *   Tài khoản Admin sẽ được tự động chuyển hướng thẳng tới dashboard quản trị của khách sạn mặc định.

---

## 🎨 5. Giao Diện & Tiêu Chuẩn Thiết Kế (UI & Glassmorphism Styling)

Giao diện của ứng dụng được xây dựng theo phong cách **Glassmorphism** sang trọng, hiện đại, mang lại trải nghiệm cao cấp cho người dùng.

### 5.1. Các Token CSS Chủ Đạo

Các biến CSS được định nghĩa trong [variables.css](file:///c:/Users/Admin/Desktop/server/OUTINKS/src/styles/variables.css):
*   `--bg-glass`: Nền mờ kính cường lực (`rgba(255, 255, 255, 0.45)` cho Light mode, `rgba(30, 30, 40, 0.5)` cho Dark mode).
*   `--border-glass`: Viền kính mảnh sắc nét (`rgba(255, 255, 255, 0.3)` cho Light, `rgba(255, 255, 255, 0.08)` cho Dark).
*   `--blur-glass`: Bộ lọc nhòe nền kính (`blur(16px)`).
*   `--shadow-glass`: Bóng đổ sâu tạo chiều nổi (`0 8px 32px 0 rgba(31, 38, 135, 0.08)`).
*   `--glass-gradient`: Hiệu ứng chuyển màu nền kính nhẹ nhàng.

### 5.2. Nguyên Tắc Thiết Kế Trực Quan
*   **Không sử dụng Tailwind CSS tràn lan:** Mặc dù dự án có cài đặt Tailwind CSS v4, nhưng hầu hết cấu trúc giao diện glassmorphic cốt lõi được định nghĩa thông qua các CSS class tùy biến trong `components.css`. Tránh sử dụng quá nhiều các ad-hoc Tailwind class để giữ code gọn gàng và dễ bảo trì.
*   **Trải nghiệm Mobile-First:** Giao diện của Housekeeper và các popup trên Mobile phải hoạt động như một ứng dụng Native:
    *   Thay thế các hộp thoại Modal lớn bằng **Bottom Sheets** (ngăn kéo kéo vuốt từ dưới lên) trên thiết bị di động.
    *   Nút bấm lớn (`padding` rộng, khoảng cách chạm tối thiểu 44px) để dễ dàng thao tác bằng ngón tay cái.
*   **Trạng Thái Phòng Bằng Màu Sắc Tiêu Chuẩn:**
    *   `dirty` (Bẩn): Đỏ nhạt / Đỏ cam (`#fee2e2` / `#ef4444`)
    *   `cleaning` (Đang dọn): Vàng hổ phách (`#fef3c7` / `#f59e0b`)
    *   `clean` (Đã dọn sạch): Xanh dương nhẹ (`#dbeafe` / `#3b82f6`)
    *   `vacant` (Phòng trống sạch): Xanh lá cây nhạt (`#dcfce7` / `#10b981`)
    *   `occupied` (Có khách ở): Tím/Hồng nhạt (`#faf5ff` / `#a855f7`)
    *   `maintenance` (Bảo trì): Xám tối (`#f3f4f6` / `#6b7280`)

---

## 🌐 6. Bản Địa Hóa & Đa Ngôn Ngữ (Internationalization - i18n)

Dự án hỗ trợ 3 ngôn ngữ: Tiếng Nhật (`ja` - mặc định), Tiếng Việt (`vi`), và Tiếng Anh (`en`).
*   Toàn bộ nhãn văn bản (Labels), thông báo (Toasts), lỗi và mô tả đều được cấu hình tập trung tại tệp [translations.ts](file:///c:/Users/Admin/Desktop/server/OUTINKS/src/i18n/translations.ts).
*   **Quy tắc:** Khi viết mã nguồn cho các React components mới hoặc sửa đổi component cũ, **không bao giờ** hardcode chuỗi hiển thị. Luôn sử dụng hàm dịch từ đối tượng `translations` dựa trên state `language` từ `useApp()`.
    *   *Ví dụ đúng:* `translations[language].dirty`
    *   *Ví dụ sai:* `"Phòng bẩn"` hoặc `"Dirty"`

---

## 🛠️ 7. Hướng Dẫn Phát Triển & Sửa Đổi Code (Developer Workflow)

Khi được giao nhiệm vụ viết thêm tính năng hoặc sửa lỗi, hãy tuân thủ quy trình sau:

### Step 1: Xác định phạm vi ảnh hưởng
*   Nếu thay đổi liên quan đến dữ liệu (thêm trường thông tin vào Phòng, thêm trạng thái mới):
    1.  Cập nhật interface trong `src/db/dbInterface.ts`.
    2.  Cập nhật cấu trúc DB mẫu và truy vấn trong `src/db/localDB.ts`.
    3.  Cập nhật logic đồng bộ Firebase trong `src/db/firebaseDB.ts`.
    4.  Cập nhật lớp kết nối REST API trong `src/db/postgresDB.ts`.
    5.  Cập nhật bảng trong file schema SQL `server/init.sql` và REST API endpoint trong `server/index.js`.

### Step 2: Cập nhật i18n
*   Mọi thông báo hoặc văn bản giao diện mới cần được bổ sung vào `src/i18n/translations.ts` cho cả 3 ngôn ngữ `ja`, `vi`, và `en`.

### Step 3: Thiết kế UI đồng nhất
*   Sử dụng các class CSS đã định nghĩa sẵn trong `src/styles/components.css` (`.glass-card`, `.glass-button`, `.glass-input`, `.glass-modal`, `.bottom-sheet`).
*   Đảm bảo hiệu ứng hover mượt mà (`transition: all 0.3s ease`).
*   Kiểm tra khả năng hiển thị responsive (co giãn màn hình để test giao diện Mobile).

### Step 4: Chạy thử và xác minh
*   Chạy dev server: `npm run dev`.
*   Nếu có thay đổi backend, hãy khởi động server Node.js: `cd server && npm start`.
*   Đảm bảo build không bị lỗi TypeScript bằng lệnh: `npm run build`.

---

## 🚀 8. Hướng Dẫn Chạy & Debug Dự Án

### Khởi Chạy Frontend (React + Vite)
```bash
# Cài đặt thư viện
npm install

# Khởi chạy môi trường Dev
npm run dev
```

### Khởi Chạy Backend (Node.js/Express + Postgres)
```bash
# Di chuyển vào thư mục server
cd server

# Cài đặt thư viện backend
npm install

# Khởi chạy backend server
npm start
```
*Lưu ý:* Cần cấu hình biến môi trường trong tệp `.env` ở thư mục gốc nếu muốn kết nối với Firebase hoặc PostgreSQL. Hãy xem `.env.example` để biết định dạng cấu hình chi tiết.

### Chạy Toàn Bộ Hệ Hệ Thống Bằng Docker Compose (Khuyên Dùng)
Để khởi chạy đồng thời Frontend, Backend và database PostgreSQL đã được thiết lập sẵn bảng biểu:
```bash
docker-compose up --build
```
Hệ thống sẽ tự động cấu hình các container kết nối với nhau thông qua mạng nội bộ Docker.
