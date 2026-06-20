# 🏨 Hệ Thống Quản Lý Dọn Phòng Khách Sạn (Hotel Housekeeping Management)

Hệ thống quản lý dọn phòng khách sạn chuyên nghiệp, tối ưu hóa giao diện đa thiết bị (Desktop, Tablet, Mobile) với thiết kế **Glassmorphic** hiện đại. Hỗ trợ đa chi nhánh khách sạn, đa ngôn ngữ và phân quyền vai trò chi tiết giúp nâng cao hiệu suất làm việc của bộ phận Buồng phòng, Kiểm phòng và Quản lý.

---

## 🌟 Tính Năng Nổi Bật

### 1. Phân Quyền Vai Trò Chi Tiết (Role-Based Access)
- **Quản lý phân khu (Kacho):** Giám sát tiến độ dọn dẹp, phân công nhân sự trực hằng ngày, xem báo cáo thống kê lỗi và năng suất.
- **Giám sát / Kiểm phòng (Checker):** Kiểm tra phòng sau khi nhân viên dọn xong, ghi nhận danh sách lỗi (Defect Checklist), phê duyệt phòng sạch (Approve) hoặc yêu cầu dọn lại (Reclean).
- **Lễ tân (Front Desk):** Theo dõi sơ đồ phòng thời gian thực, thực hiện check-out nhanh, xem danh sách và trạng thái tải công việc của nhân viên dọn dẹp trong ngày.
- **Nhân viên dọn dẹp (Housekeeper):** Giao diện mobile-first tối giản. Nhận phòng cần dọn, bắt đầu dọn phòng, hoàn thành dọn phòng kèm ghi chú và ảnh chụp nghiệm thu thực tế (được nén tối ưu dung lượng).
- **Quản trị viên (Admin):** Toàn quyền cấu hình khách sạn, phòng, nhân sự và xem thống kê tổng hợp toàn hệ thống.

### 2. Quản Lý Đa Chi Nhánh (Multi-Tenancy)
- Phân tách dữ liệu cô lập hoàn toàn giữa các chi nhánh khách sạn (ví dụ: `ks1` - Sakura Hotel, `ks2` - Fuji Hotel) thông qua cơ chế prefix thông minh trong `localStorage` hoặc phân vùng database Firestore.
- Cổng chọn khách sạn (Portal) động và tự động điều hướng người dùng dựa trên danh sách chi nhánh được cấp phép.
- Trình chọn chi nhánh tiện lợi tích hợp trên Header dành cho Admin và các tài khoản được liên kết nhiều khách sạn.

### 3. Tối Ưu Hóa Trải Nghiệm Mobile & PWA
- Thiết kế Responsive mượt mà chuyển đổi sidebar trên Desktop thành các ngăn kéo (collapsible drawers) và menu ngang tiện lợi trên Mobile.
- Các cửa sổ Popup chuyển đổi thành dạng **Bottom-Sheet** vuốt lên từ dưới màn hình trên thiết bị di động, cải thiện tối đa khoảng chạm tay của người dùng.
- Hỗ trợ cài đặt ứng dụng trực tiếp trên Android/iOS dưới dạng **PWA** nhờ cấu hình Service Worker lưu bộ nhớ đệm ngoại tuyến.

### 4. Báo Cáo & Phân Tích Trực Quan
- Biểu đồ thống kê hiệu suất dọn dẹp trung bình (phút) của nhân sự dưới dạng biểu đồ thanh SVG.
- Biểu đồ tròn SVG thể hiện phân bố trạng thái phòng (Sạch, Bẩn, Đang dọn, Bảo trì,...).
- Xuất báo cáo lịch sử dọn dẹp hằng ngày ra tệp **CSV mã hóa UTF-8 BOM** (hỗ trợ hiển thị ký tự tiếng Việt và tiếng Nhật chính xác trên Microsoft Excel).

---

## 🛠️ Công Nghệ Sử Dụng

- **Core:** React 18, TypeScript, Vite.
- **Styling:** CSS Custom Variables & Utilities (Sạch sẽ, không phụ thuộc TailwindCSS).
- **Icons:** Lucide-React.
- **Hiệu ứng:** Canvas-Confetti.
- **Database:** Hỗ trợ song song 2 chế độ:
  - **Local Mode (Mặc định):** Đồng bộ thời gian thực giữa các tab thông qua `BroadcastChannel` và lưu dữ liệu trong `localStorage`.
  - **Firebase Mode:** Kết nối trực tiếp cơ sở dữ liệu đám mây Firestore (khi cấu hình các khóa Firebase trong tệp `.env`).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Cài đặt các gói phụ thuộc:
```bash
npm install
```

### 2. Chạy môi trường phát triển (Development Mode):
```bash
npm run dev
```
Truy cập ứng dụng tại đường dẫn mặc định: `http://localhost:5173/`

### 3. Biên dịch phiên bản sản phẩm (Build for Production):
```bash
npm run build
```
Mã nguồn sau khi tối ưu và đóng gói sẽ nằm trong thư mục `/dist`.

---

## 🔑 Danh Sách Tài Khoản Demo Mặc Định

Hệ thống được cấu hình sẵn dữ liệu mẫu cho hai chi nhánh khách sạn để kiểm thử nhanh chóng:

### 🌸 Khách Sạn Sakura Hotel (Mã chi nhánh: `ks1`)
- **Admin Hệ Thống:** Tài khoản: `admin` / Mật khẩu: `admin123`
- **Quản lý Phân Khu (Kacho):** Tài khoản: `kacho1` / Mật khẩu: `kacho1123`
- **Giám sát / Kiểm phòng:** Tài khoản: `check1` / Mật khẩu: `check1123`
- **Lễ tân:** Tài khoản: `front1` / Mật khẩu: `front123`
- **Nhân viên dọn phòng:**
  - Nguyễn Văn A: Tài khoản: `cleaner1` / Mật khẩu: `cleaner1123`
  - Trần Thị B: Tài khoản: `cleaner2` / Mật khẩu: `cleaner2123`

### 🗻 Khách Sạn Fuji Hotel (Mã chi nhánh: `ks2`)
- **Admin Hệ Thống:** Tài khoản: `admin` / Mật khẩu: `admin123`
- **Quản lý Phân Khu (Kacho):** Tài khoản: `kacho2` / Mật khẩu: `kacho2123`
- **Giám sát / Kiểm phòng:** Tài khoản: `check2` / Mật khẩu: `check2123`
- **Lễ tân:** Tài khoản: `front2` / Mật khẩu: `front2123`
- **Nhân viên dọn phòng:**
  - Saito Tanaka: Tài khoản: `cleaner3` / Mật khẩu: `cleaner3123`
  - Nguyễn Thị C: Tài khoản: `cleaner4` / Mật khẩu: `cleaner4123`

---

## ⚙️ Cấu Hình Firebase (Tùy chọn)

Nếu bạn muốn chuyển ứng dụng từ chạy Offline (`localStorage`) sang chạy Online đồng bộ hóa qua đám mây Firebase:

1. Tạo một project trên **Firebase Console**.
2. Kích hoạt dịch vụ **Cloud Firestore**.
3. Nhân bản tệp `.env.example` thành tệp `.env` tại thư mục gốc.
4. Điền các tham số cấu hình Firebase của bạn vào tệp `.env`:
```env
VITE_USE_FIREBASE=true
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
5. Hệ thống sẽ tự động chuyển đổi driver kết nối dữ liệu sang Firebase khi chạy lại dự án.
