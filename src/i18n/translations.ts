export type Language = 'ja' | 'vi' | 'en';

export const translations = {
  ja: {
    // Auth
    loginTitle: '客室清掃管理システム',
    loginSubtitle: 'ホテル清掃リアルタイム管理',
    username: 'ユーザー名',
    password: 'パスワード',
    pinCode: '4桁のPINコード',
    loginBtn: 'ログイン',
    invalidLogin: 'ユーザー名またはパスワードが正しくありません',
    selectRole: '権限を選択してください',
    roleAdmin: '管理者 (Admin)',
    roleFrontDesk: 'フロントデスク (Front Desk)',
    roleHousekeeping: '清掃スタッフ (Housekeeper)',
    roleChecker: '検査スタッフ (Checker)',
    roleKacho: '課長 (Kacho)',
    pinLoginPlaceholder: 'PINコードを入力 (例: 1234)',

    // Navigation & General
    logout: 'ログアウト',
    back: '戻る',
    save: '保存',
    cancel: 'キャンセル',
    loading: '読み込み中...',
    confirm: '確認',
    action: '操作',
    status: '状態',
    floor: '階',
    room: '部屋',
    all: 'すべて',
    noData: 'データがありません',

    // Room Statuses
    statusOccupied: '滞在中 (Occupied)',
    statusDirty: '清掃が必要 (Dirty)',
    statusCleaning: '清掃中 (Cleaning)',
    statusClean: '清掃済 (Clean/Ready)',
    statusMaintenance: 'メンテナンス中 (Maintenance)',
    statusEco: 'ECO (アメニティ吊り下げのみ)',
    statusDnd: '起こさないでください (DND)',

    // Front Desk
    fdDashboard: 'フロントデスク管理画面',
    checkoutBtn: 'チェックアウト & 清掃指示',
    checkoutConfirmTitle: 'チェックアウト確認',
    checkoutConfirmMsg: '部屋 {room} をチェックアウトし、清掃が必要（Dirty）としてマークしますか？',
    searchRoomPlaceholder: '部屋番号で検索...',
    filterFloor: 'フロア別',
    filterStatus: 'ステータス別',
    notificationNewDirty: '部屋 {room} がチェックアウトされました。清掃が必要です！',
    soundAlert: 'アラート音',

    // Housekeeping
    hkDashboard: '清掃指示一覧',
    cleanerName: '清掃担当者',
    myQueue: 'マイ清掃リスト',
    startCleaning: '清掃開始',
    finishCleaning: '清掃完了',
    uploadPhoto: '写真アップロード',
    takePhoto: '写真を撮影する',
    takeRealPhoto: 'カメラを起動して撮影',
    useDemoPhoto: 'デモ写真を使用',
    notes: 'メモ・特記事項',
    notesPlaceholder: '破損箇所や忘れ物などがあれば入力...',
    cleaningSummary: '清掃レポート',
    successClean: '清掃が完了しました！お疲れ様でした！',
    assignedToMe: '自分の担当',
    availableRooms: '清掃待ちの部屋',

    // Admin Dashboard
    adminDashboard: '管理者ダッシュボード',
    statsTotalRooms: '総部屋数',
    statsDirtyRooms: '清掃待ち',
    statsCleaningRooms: '清掃中',
    statsCleanRooms: '清掃完了',
    statsAvgTime: '平均清掃時間',
    statsMin: '分',
    cleanerLeaderboard: '清掃実績ランキング',
    roomsCleaned: '部屋清掃済',
    roomManagement: '部屋管理',
    userManagement: 'ユーザー管理',
    hotelManagement: 'ホテル管理',
    addHotel: 'ホテルを追加',
    hotelName: 'ホテル名',
    hotelCode: 'ホテルコード',
    activeHotel: '管理対象ホテル',
    description: '説明',
    addRoom: '部屋を追加',
    addUser: 'ユーザーを追加',
    roomNumber: '部屋番号',
    roomType: '部屋タイプ',
    actions: '操作',
    edit: '編集',
    delete: '削除',
    deleteConfirm: '本当に削除しますか？',

    // Additional Keys
    statusVacant: '空室 (Vacant)',
    duration: '所要時間',
    photo: '写真',
    viewPhoto: '写真を見る',
    noPhoto: '写真なし',
    resetDatabase: 'データベースリセット',
    resetDatabaseConfirm: 'データベースを初期状態にリセットしますか？',

    // Language Toggle
    langJa: '日本語',
    langVi: 'Tiếng Việt',
    langEn: 'English'
  },
  vi: {
    // Auth
    loginTitle: 'Hệ thống Quản lý Dọn phòng',
    loginSubtitle: 'Quản lý dọn dẹp khách sạn thời gian thực',
    username: 'Tên đăng nhập',
    password: 'Mật khẩu',
    pinCode: 'Mã PIN 4 số',
    loginBtn: 'Đăng nhập',
    invalidLogin: 'Tên đăng nhập hoặc mật khẩu không đúng',
    selectRole: 'Chọn vai trò đăng nhập',
    roleAdmin: 'Quản trị viên (Admin)',
    roleFrontDesk: 'Lễ tân (Front Desk)',
    roleHousekeeping: 'Nhân viên dọn phòng (Housekeeper)',
    roleChecker: 'Giám sát / Kiểm phòng (Checker)',
    roleKacho: 'Trưởng bộ phận (Kacho)',
    pinLoginPlaceholder: 'Nhập mã PIN (Ví dụ: 1234)',

    // Navigation & General
    logout: 'Đăng xuất',
    back: 'Quay lại',
    save: 'Lưu',
    cancel: 'Hủy',
    loading: 'Đang tải...',
    confirm: 'Xác nhận',
    action: 'Thao tác',
    status: 'Trạng thái',
    floor: 'Tầng',
    room: 'Phòng',
    all: 'Tất cả',
    noData: 'Không có dữ liệu',

    // Room Statuses
    statusOccupied: 'Có khách (Occupied)',
    statusDirty: 'Cần dọn (Dirty)',
    statusCleaning: 'Đang dọn (Cleaning)',
    statusClean: 'Sạch / Sẵn sàng (Clean/Ready)',
    statusMaintenance: 'Bảo trì (Maintenance)',
    statusEco: 'Chỉ treo đồ (Eco - không dọn)',
    statusDnd: 'Không làm phiền (DND)',

    // Front Desk
    fdDashboard: 'Màn hình Lễ tân',
    checkoutBtn: 'Check-out & Báo dọn phòng',
    checkoutConfirmTitle: 'Xác nhận Check-out',
    checkoutConfirmMsg: 'Bạn có chắc chắn muốn check-out phòng {room} và đánh dấu cần dọn (Dirty)?',
    searchRoomPlaceholder: 'Tìm số phòng...',
    filterFloor: 'Theo tầng',
    filterStatus: 'Theo trạng thái',
    notificationNewDirty: 'Phòng {room} đã check-out và cần dọn dẹp!',
    soundAlert: 'Âm thanh thông báo',

    // Housekeeping
    hkDashboard: 'Danh sách dọn phòng',
    cleanerName: 'Nhân viên dọn dẹp',
    myQueue: 'Danh sách của tôi',
    startCleaning: 'Bắt đầu dọn',
    finishCleaning: 'Dọn xong',
    uploadPhoto: 'Tải ảnh lên',
    takePhoto: 'Chụp ảnh',
    takeRealPhoto: 'Mở camera chụp ảnh',
    useDemoPhoto: 'Sử dụng ảnh mẫu',
    notes: 'Ghi chú / Sự cố',
    notesPlaceholder: 'Nhập đồ để quên, hư hỏng thiết bị nếu có...',
    cleaningSummary: 'Báo cáo dọn phòng',
    successClean: 'Đã dọn xong phòng! Cảm ơn bạn!',
    assignedToMe: 'Phòng của tôi',
    availableRooms: 'Phòng chờ dọn',

    // Admin Dashboard
    adminDashboard: 'Bảng điều khiển Admin',
    statsTotalRooms: 'Tổng số phòng',
    statsDirtyRooms: 'Phòng cần dọn',
    statsCleaningRooms: 'Phòng đang dọn',
    statsCleanRooms: 'Phòng đã dọn',
    statsAvgTime: 'Thời gian dọn TB',
    statsMin: 'phút',
    cleanerLeaderboard: 'Xếp hạng nhân viên dọn phòng',
    roomsCleaned: 'phòng dọn xong',
    roomManagement: 'Quản lý phòng',
    userManagement: 'Quản lý người dùng',
    hotelManagement: 'Quản lý khách sạn',
    addHotel: 'Thêm khách sạn',
    hotelName: 'Tên khách sạn',
    hotelCode: 'Mã khách sạn',
    activeHotel: 'Khách sạn quản lý',
    description: 'Mô tả',
    addRoom: 'Thêm phòng',
    addUser: 'Thêm người dùng',
    roomNumber: 'Số phòng',
    roomType: 'Loại phòng',
    actions: 'Hành động',
    edit: 'Sửa',
    delete: 'Xóa',
    deleteConfirm: 'Bạn có chắc chắn muốn xóa?',

    // Additional Keys
    statusVacant: 'Trống (Vacant)',
    duration: 'Thời lượng',
    photo: 'Ảnh',
    viewPhoto: 'Xem ảnh',
    noPhoto: 'Không có ảnh',
    resetDatabase: 'Reset dữ liệu',
    resetDatabaseConfirm: 'Bạn có chắc chắn muốn reset toàn bộ cơ sở dữ liệu về mặc định không?',

    // Language Toggle
    langJa: '日本語',
    langVi: 'Tiếng Việt',
    langEn: 'English'
  },
  en: {
    // Auth
    loginTitle: 'Room Cleaning Management',
    loginSubtitle: 'Real-time Hotel Housekeeping Management',
    username: 'Username',
    password: 'Password',
    pinCode: '4-digit PIN Code',
    loginBtn: 'Login',
    invalidLogin: 'Invalid username or password',
    selectRole: 'Select Role',
    roleAdmin: 'Administrator (Admin)',
    roleFrontDesk: 'Front Desk (Receptionist)',
    roleHousekeeping: 'Housekeeping (Cleaner)',
    roleChecker: 'Room Checker (Checker)',
    roleKacho: 'Section Manager (Kacho)',
    pinLoginPlaceholder: 'Enter PIN (e.g. 1234)',

    // Navigation & General
    logout: 'Logout',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    confirm: 'Confirm',
    action: 'Action',
    status: 'Status',
    floor: 'Floor',
    room: 'Room',
    all: 'All',
    noData: 'No data available',

    // Room Statuses
    statusOccupied: 'Occupied',
    statusDirty: 'Dirty (Need clean)',
    statusCleaning: 'Cleaning',
    statusClean: 'Clean / Ready',
    statusMaintenance: 'Maintenance',
    statusEco: 'Eco (Hang amenities only)',
    statusDnd: 'Do Not Disturb (DND)',

    // Front Desk
    fdDashboard: 'Front Desk Dashboard',
    checkoutBtn: 'Check-out & Mark Dirty',
    checkoutConfirmTitle: 'Confirm Check-out',
    checkoutConfirmMsg: 'Are you sure you want to check-out room {room} and mark it as Dirty?',
    searchRoomPlaceholder: 'Search room number...',
    filterFloor: 'Floor Filter',
    filterStatus: 'Status Filter',
    notificationNewDirty: 'Room {room} has checked out and needs cleaning!',
    soundAlert: 'Sound Alerts',

    // Housekeeping
    hkDashboard: 'Housekeeping Queue',
    cleanerName: 'Cleaner Name',
    myQueue: 'My Work List',
    startCleaning: 'Start Cleaning',
    finishCleaning: 'Finish Cleaning',
    uploadPhoto: 'Upload Photo',
    takePhoto: 'Take Photo',
    takeRealPhoto: 'Open Camera & Capture',
    useDemoPhoto: 'Use Demo Photo',
    notes: 'Notes / Issues',
    notesPlaceholder: 'Enter any lost & found items or maintenance issues...',
    cleaningSummary: 'Cleaning Summary',
    successClean: 'Room cleaned successfully! Good job!',
    assignedToMe: 'Assigned to Me',
    availableRooms: 'Available Rooms',

    // Admin Dashboard
    adminDashboard: 'Admin Dashboard',
    statsTotalRooms: 'Total Rooms',
    statsDirtyRooms: 'Dirty Rooms',
    statsCleaningRooms: 'Cleaning Rooms',
    statsCleanRooms: 'Clean Rooms',
    statsAvgTime: 'Avg Cleaning Time',
    statsMin: 'mins',
    cleanerLeaderboard: 'Cleaner Leaderboard',
    roomsCleaned: 'rooms cleaned',
    roomManagement: 'Room Management',
    userManagement: 'User Management',
    hotelManagement: 'Hotel Management',
    addHotel: 'Add Hotel',
    hotelName: 'Hotel Name',
    hotelCode: 'Hotel Code',
    activeHotel: 'Active Hotel to Manage',
    description: 'Description',
    addRoom: 'Add Room',
    addUser: 'Add User',
    roomNumber: 'Room Number',
    roomType: 'Room Type',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete?',

    // Additional Keys
    statusVacant: 'Vacant',
    duration: 'Duration',
    photo: 'Photo',
    viewPhoto: 'View Photo',
    noPhoto: 'No Photo',
    resetDatabase: 'Reset Database',
    resetDatabaseConfirm: 'Are you sure you want to reset the entire database to default values?',

    // Language Toggle
    langJa: '日本語',
    langVi: 'Tiếng Việt',
    langEn: 'English'
  }
};

export type TranslationKey = keyof typeof translations.ja;

export function getTranslation(lang: Language, key: TranslationKey, params?: Record<string, string>): string {
  let text = translations[lang][key] || translations['en'][key] || String(key);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
}
