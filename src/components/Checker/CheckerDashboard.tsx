import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../Common/AppContext';
import { getTranslation } from '../../i18n/translations';
import { db } from '../../db/firebaseDB';
import type { Room, CleaningLog, User } from '../../db/dbInterface';
import { getTodayDateString } from '../../db/localDB';
import { getDateLockedMessage, isDateLockedError } from '../../utils/errors';
import { 
  Hotel, CheckCircle, AlertTriangle, Search, 
  ClipboardList, CheckCircle2, LayoutDashboard, Clock, Building, Users,
  Sun, Moon, LogOut, User as UserIcon, LayoutGrid, List,
  Maximize2, Minimize2, ChevronLeft, ChevronRight,
  Camera, Check, Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 320;
        const MAX_HEIGHT = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
};

const translateDefect = (defect: string, lang: string): string => {
  if (!defect) return '';
  if (lang === 'vi') return defect;
  
  if (defect.startsWith('Lỗi khác:')) {
    const text = defect.substring(9).trim();
    if (lang === 'ja') return `その他指摘: ${text}`;
    return `Other defect: ${text}`;
  }
  
  switch (defect) {
    case 'Chưa lau sàn / hút bụi':
      return lang === 'ja' ? '床掃除・掃除機未実施' : 'Floor dusty/dirty';
    case 'Thiếu khăn / đồ tiêu hao':
      return lang === 'ja' ? 'アメニティ・タオル不足' : 'Missing towels/amenities';
    case 'Bẩn nhà vệ sinh / bồn tắm':
      return lang === 'ja' ? '水回り・浴室汚れ' : 'Dirty bathroom';
    case 'Ga giường nhăn / bẩn':
      return lang === 'ja' ? 'シーツしわ・汚れ' : 'Wrinkled/dirty sheet';
    case 'Chưa đổ rác':
      return lang === 'ja' ? 'ゴミ未回収' : 'Trash not emptied';
    case 'Còn bụi bẩn trên bàn / tủ':
      return lang === 'ja' ? '家具ほこり残り' : 'Dust on furniture';
    default:
      return defect;
  }
};

const getVisiblePages = (current: number, total: number) => {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | string)[] = [];
  pages.push(1);
  if (current > 3) {
    pages.push('...');
  }
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) {
    pages.push('...');
  }
  pages.push(total);
  return pages;
};

export const CheckerDashboard: React.FC = () => {
  const { currentUser, language, addToast, activeDate, logout, darkMode, toggleDarkMode, setLanguage, hotelId, isLocked } = useApp();
  const isEditDisabled = useMemo(() => {
    return (activeDate < getTodayDateString()) && (currentUser?.role === 'checka');
  }, [activeDate, currentUser]);
  const [statsTimeRange, setStatsTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('today');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'count' | 'time'>('count');
  const [leaderboardSortOrder, setLeaderboardSortOrder] = useState<'asc' | 'desc'>('desc');
  const [leaderboardPage, setLeaderboardPage] = useState<number>(1);
  const [leaderboardPerPage, setLeaderboardPerPage] = useState<number>(6);
  const [leaderboardSearchTerm, setLeaderboardSearchTerm] = useState<string>('');
  const [defectPage, setDefectPage] = useState<number>(1);
  const [defectPerPage, setDefectPerPage] = useState<number>(5);
  const [defectSortField, setDefectSortField] = useState<'name' | 'count'>('count');
  const [defectSortOrder, setDefectSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Tab/Menu navigation inside Checker Dashboard
  const [activeTab, setActiveTab] = useState<'stats' | 'grid' | 'logs' | 'staff'>(() => {
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    const validTabs = ['stats', 'grid', 'logs', 'staff'];
    return (queryTab && validTabs.includes(queryTab)) ? (queryTab as 'stats' | 'grid' | 'logs' | 'staff') : 'stats';
  });

  // DB States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [fullscreenMode, setFullscreenMode] = useState<'single' | 'all' | 'custom'>('single');
  const [customSelectedFloors, setCustomSelectedFloors] = useState<number[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [cleaners, setCleaners] = useState<User[]>([]);
  const [activeStaffIds, setActiveStaffIds] = useState<string[]>([]);
  const [showStats, setShowStats] = useState(false);

  // daily staff search state
  const [dailyStaffSearchTerm, setDailyStaffSearchTerm] = useState<string>('');

  const [allHotelUsers, setAllHotelUsers] = useState<User[]>([]);
  const [staffViewMode, setStaffViewMode] = useState<'today' | 'total'>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVal = params.get('staffViewMode');
    if (urlVal === 'today' || urlVal === 'total') return urlVal;
    const localVal = localStorage.getItem('hotel_clean_staff_view_mode');
    if (localVal === 'today' || localVal === 'total') return localVal;
    return 'today';
  });
  const [staffSortField, setStaffSortField] = useState<'name' | 'username' | 'status' | 'role'>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVal = params.get('staffSortField');
    const validFields = ['name', 'username', 'status', 'role'];
    if (urlVal && validFields.includes(urlVal)) return urlVal as any;
    const localVal = localStorage.getItem('hotel_clean_staff_sort_field');
    if (localVal && validFields.includes(localVal)) return localVal as any;
    return 'name';
  });
  const [staffSortOrder, setStaffSortOrder] = useState<'asc' | 'desc'>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVal = params.get('staffSortOrder');
    if (urlVal === 'asc' || urlVal === 'desc') return urlVal;
    const localVal = localStorage.getItem('hotel_clean_staff_sort_order');
    if (localVal === 'asc' || localVal === 'desc') return localVal;
    return 'asc';
  });
  const [staffPage, setStaffPage] = useState<number>(1);
  const [staffLayout, setStaffLayout] = useState<'grid' | 'list'>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVal = params.get('staffLayout');
    if (urlVal === 'grid' || urlVal === 'list') return urlVal;
    const localVal = localStorage.getItem('hotel_clean_staff_layout');
    if (localVal === 'grid' || localVal === 'list') return localVal;
    return 'grid';
  });

  const [gridMode, setGridMode] = useState<'work' | 'setup'>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVal = params.get('gridMode');
    if (urlVal === 'work' || urlVal === 'setup') return urlVal;
    const localVal = localStorage.getItem('hotel_clean_grid_mode');
    if (localVal === 'work' || localVal === 'setup') return localVal;
    return 'work';
  });

  useEffect(() => {
    if (isEditDisabled && gridMode === 'setup') {
      setGridMode('work');
    }
  }, [isEditDisabled, gridMode]);

  const [gridColumns, setGridColumns] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVal = params.get('gridCols');
    if (urlVal) return urlVal;
    return localStorage.getItem('hotel_clean_room_grid_columns') || 'auto';
  });

  const [isFullScreenFloorView, setIsFullScreenFloorView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('fullscreen') === 'true';
  });
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [showLegend, setShowLegend] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!isFullScreenFloorView) return;
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isFullScreenFloorView]);

  const getDisplayDateTime = () => {
    const dateParts = activeDate ? activeDate.split('-') : [];
    const dayStr = dateParts[2] || '01';
    const monthStr = dateParts[1] || '01';
    const yearStr = dateParts[0] || '2026';
    
    const hh = String(currentTime.getHours()).padStart(2, '0');
    const min = String(currentTime.getMinutes()).padStart(2, '0');
    const ss = String(currentTime.getSeconds()).padStart(2, '0');
    
    if (language === 'vi') {
      return `${dayStr}/${monthStr}/${yearStr} ${hh}:${min}:${ss}`;
    } else if (language === 'ja') {
      return `${yearStr}年${monthStr}月${dayStr}日 ${hh}:${min}:${ss}`;
    } else {
      return `${dayStr}/${monthStr}/${yearStr} ${hh}:${min}:${ss}`;
    }
  };
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupForm, setSetupForm] = useState({
    status: 'vacant' as Room['status'],
    isStay: false,
    guestCount: 0,
    notes: ''
  });

  // staff toggle modal state
  const [confirmStaffModal, setConfirmStaffModal] = useState<{
    open: boolean;
    userId: string;
    cleanerName: string;
    isActive: boolean;
  }>({
    open: false,
    userId: '',
    cleanerName: '',
    isActive: false
  });

  const hasRestoredFloorRef = useRef(false);

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const allUsers = await db.getUsers();
        const activeUsers = allUsers.filter(u => u.status !== 'quit');
        setAllHotelUsers(activeUsers);
        const housekeeperUsers = activeUsers.filter(u => u.role === 'housekeeping');
        setCleaners(housekeeperUsers);

        const activeIds = await db.getActiveStaff(activeDate);
        const activeCleanersIds = activeIds.filter(id => activeUsers.some(u => u.id === id));
        setActiveStaffIds(activeCleanersIds);
      } catch (e) {
        console.error('Failed to fetch staff data:', e);
      }
    };
    fetchStaffData();
  }, [activeDate, hotelId]);

  // STAFF TOGGLE FOR TODAY'S DUTY
  const handleStaffToggle = (userId: string) => {
    const cleaner = cleaners.find(c => c.id === userId);
    if (!cleaner) return;

    const isActive = activeStaffIds.includes(userId);
    setConfirmStaffModal({
      open: true,
      userId,
      cleanerName: cleaner.name,
      isActive
    });
  };

  const executeStaffToggle = async () => {
    if (isLocked) {
      addToast(
        language === 'vi'
          ? 'Ngày này đã chốt hoàn tất, không thể chỉnh sửa dữ liệu.'
          : language === 'ja'
            ? 'この日付はすでに締め切られているため、データを変更できません。'
            : 'This date is finalized and locked. No changes are allowed.',
        'warning'
      );
      return;
    }
    const { userId, isActive } = confirmStaffModal;
    setConfirmStaffModal(prev => ({ ...prev, open: false }));
    try {
      let nextIds;
      if (isActive) {
        nextIds = activeStaffIds.filter(id => id !== userId);
      } else {
        nextIds = [...activeStaffIds, userId];
      }
      setActiveStaffIds(nextIds);
      await db.setActiveStaff(activeDate, nextIds);
      addToast(
        language === 'vi' 
          ? 'Đã cập nhật danh sách nhân sự làm việc' 
          : language === 'ja'
            ? '本日の出勤スタッフを更新しました'
            : 'Updated today\'s staff assignment',
        'success'
      );
    } catch (e) {
      console.error('Failed to toggle staff status:', e);
      addToast(
        language === 'vi' 
          ? 'Không thể cập nhật trạng thái nhân sự' 
          : language === 'ja'
            ? 'スタッフ出勤状態の更新に失敗しました'
            : 'Failed to update staff status',
        'warning'
      );
    }
  };

  // Filter States
  const [floorFilter, setFloorFilter] = useState<string>('all');
    const [checkFilter, setCheckFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / Inspection state
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomLog, setRoomLog] = useState<CleaningLog | null>(null);
  const [recleanReason, setRecleanReason] = useState('');
  const [showRecleanInput, setShowRecleanInput] = useState(false);

  // Defect checklist states
  const [defectFloor, setDefectFloor] = useState(false);
  const [defectAmenities, setDefectAmenities] = useState(false);
  const [defectBathroom, setDefectBathroom] = useState(false);
  const [defectBed, setDefectBed] = useState(false);
  const [defectTrash, setDefectTrash] = useState(false);
  const [defectDust, setDefectDust] = useState(false);
  const [defectOther, setDefectOther] = useState(false);
  const [defectOtherText, setDefectOtherText] = useState('');
  const [checkerNotes, setCheckerNotes] = useState('');
  const [viewedCleanerNotes, setViewedCleanerNotes] = useState(false);

  // Housekeeper-like cleaning states
  const [cleaningNotes, setCleaningNotes] = useState('');
  const [cleaningPhoto, setCleaningPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [showSourceChoice, setShowSourceChoice] = useState(false);
  const [activeHotel, setActiveHotel] = useState<any>(null);

  useEffect(() => {
    const fetchHotel = async () => {
      try {
        const hotelsList = await db.getHotels();
        const hotel = hotelsList.find(h => h.id === hotelId);
        setActiveHotel(hotel || null);
      } catch (e) {
        console.error(e);
      }
    };
    if (hotelId) {
      fetchHotel();
    }
  }, [hotelId]);

  useEffect(() => {
    db.setDate(activeDate);

    // Subscribe to room updates
    const unsubscribeRooms = db.subscribeRooms((updatedRooms) => {
      setRooms(updatedRooms);
    });

    // Subscribe to logs updates
    const unsubscribeLogs = db.subscribeLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });

    return () => {
      unsubscribeRooms();
      unsubscribeLogs();
    };
  }, [hotelId, activeDate]);

  // Fetch cleaning log for the selected room when the modal opens
  useEffect(() => {
    // Reset checklists
    setDefectFloor(false);
    setDefectAmenities(false);
    setDefectBathroom(false);
    setDefectBed(false);
    setDefectTrash(false);
    setDefectDust(false);
    setDefectOther(false);
    setDefectOtherText('');
    setCheckerNotes('');
    setViewedCleanerNotes(false);

    if (selectedRoom) {
      setCheckerNotes(selectedRoom.checkerNotes || '');
      setViewedCleanerNotes(!!selectedRoom.viewedCleanerNotes);
      const activeDatePrefix = activeDate; // e.g. "2026-06-20"
      const matchingLog = logs
        .filter(log => log.roomId === selectedRoom.id && log.endedAt.startsWith(activeDatePrefix))
        .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())[0];
      setRoomLog(matchingLog || null);
    } else {
      setRoomLog(null);
    }
    setRecleanReason('');
    setShowRecleanInput(false);
  }, [selectedRoom, logs, activeDate]);

  const getFormattedRoomType = (type: string) => {
    if (!type) return '';
    const t = type.toLowerCase().trim();
    if (t === '1 bed') return language === 'vi' ? '🛏️ 1 Giường' : language === 'ja' ? '🛏️ 1ベッド' : '🛏️ 1 Bed';
    if (t === '2 beds') return language === 'vi' ? '🛏️🛏️ 2 Giường' : language === 'ja' ? '🛏️🛏️ 2ベッド' : '🛏️🛏️ 2 Beds';
    if (t === '3 beds') return language === 'vi' ? '🛏️🛏️🛏️ 3 Giường' : language === 'ja' ? '🛏️🛏️🛏️ 3ベッド' : '🛏️🛏️🛏️ 3 Beds';
    if (t === '4 beds') return language === 'vi' ? '🛏️🛏️🛏️🛏️ 4 Giường' : language === 'ja' ? '🛏️🛏️🛏️🛏️ 4ベッド' : '🛏️🛏️🛏️🛏️ 4 Beds';
    if (t === 'minpaku') return language === 'vi' ? '🏡 Homestay / Minpaku' : language === 'ja' ? '🏡 民泊' : '🏡 Minpaku';
    return type;
  };

  const getTargetCleanMinutes = (roomType: string) => {
    if (!activeHotel) return 30;
    if (activeHotel.roomTypes) {
      const typeConfig = activeHotel.roomTypes.find((t: any) => t.name === roomType || t.id === roomType);
      if (typeConfig && typeConfig.cleanMinutes > 0) {
        return typeConfig.cleanMinutes;
      }
    }
    return activeHotel.defaultCleanMinutes || 30;
  };

  const triggerCameraMock = () => {
    setCameraActive(true);
    setShowSourceChoice(false);
    setTimeout(() => {
      const mockPhotos = [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=400&q=80'
      ];
      const randomPhoto = mockPhotos[Math.floor(Math.random() * mockPhotos.length)];
      setCleaningPhoto(randomPhoto);
      setCameraActive(false);
      addToast(
        language === 'vi' ? 'Đã lấy ảnh mẫu!' : language === 'ja' ? 'デモ写真を使用しました！' : 'Demo photo applied!',
        'success'
      );
    }, 800);
  };

  const triggerRealCamera = () => {
    const fileInput = document.getElementById('camera-file-input-checker');
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCameraActive(true);
    setShowSourceChoice(false);
    try {
      const compressedBase64 = await compressImage(file);
      setCleaningPhoto(compressedBase64);
      addToast(
        language === 'vi' ? 'Đã tải ảnh & nén thành công!' : language === 'ja' ? '写真をアップロードし、圧縮しました！' : 'Photo uploaded and compressed!',
        'success'
      );
    } catch (err) {
      console.error(err);
      addToast(
        language === 'vi' ? 'Lỗi xử lý ảnh!' : language === 'ja' ? '画像処理エラー！' : 'Error processing image!',
        'warning'
      );
    } finally {
      setCameraActive(false);
      e.target.value = '';
    }
  };

  const showMutationError = (error: unknown, fallback: string) => {
    console.error(error);
    addToast(isDateLockedError(error) ? getDateLockedMessage(language) : fallback, 'warning');
  };

  const submitFinishedCleaning = async () => {
    if (!selectedRoom || !currentUser) return;
    try {
      const endedAt = new Date().toISOString();
      const durationMinutes = getTargetCleanMinutes(selectedRoom.type);
      const startedAt = new Date(Date.now() - durationMinutes * 60000).toISOString();
      
      await db.createLog({
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber,
        floor: selectedRoom.floor,
        cleanerId: currentUser.id,
        cleanerName: currentUser.name,
        startedAt,
        endedAt,
        durationMinutes,
        notes: cleaningNotes || 'Cleaned & inspected',
        photoAfter: cleaningPhoto || undefined
      });

      await db.updateRoomStatus(selectedRoom.id, 'clean', currentUser.name, currentUser.id, currentUser.name);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      addToast(getTranslation(language, 'successClean'), 'success');
      setSelectedRoom(null);
    } catch (e) {
      showMutationError(e, 'Error finishing cleaning report');
    }
  };

  const submitHangingDNDOnly = async () => {
    if (!selectedRoom || !currentUser) return;
    try {
      const endedAt = new Date().toISOString();
      const durationMinutes = getTargetCleanMinutes(selectedRoom.type);
      const startedAt = new Date(Date.now() - durationMinutes * 60000).toISOString();
      
      await db.createLog({
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber,
        floor: selectedRoom.floor,
        cleanerId: currentUser.id,
        cleanerName: currentUser.name,
        startedAt,
        endedAt,
        durationMinutes,
        notes: cleaningNotes ? cleaningNotes + ' - Chỉ cần treo đồ (DND)' : 'Chỉ cần treo đồ (DND)',
        photoAfter: cleaningPhoto || undefined
      });

      await db.updateRoom({
        ...selectedRoom,
        status: 'clean',
        isChecked: false,
        checkedBy: undefined,
        checkedAt: undefined,
        photoDefect: undefined,
        notes: selectedRoom.notes ? selectedRoom.notes + ' - Chỉ cần treo đồ (DND)' : 'Chỉ cần treo đồ (DND)',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        assignedTo: currentUser.id,
        cleanerName: currentUser.name
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      addToast(
        language === 'vi' 
          ? 'Đã báo cáo chỉ cần treo đồ!' 
          : language === 'ja'
            ? 'アメニティ吊り下げのみと報告しました！'
            : 'Reported hang amenities only!',
        'success'
      );
      setSelectedRoom(null);
    } catch (e) {
      showMutationError(e, 'Error saving report');
    }
  };

  const submitDNDRoom = async () => {
    if (!selectedRoom || !currentUser) return;
    try {
      const endedAt = new Date().toISOString();
      const durationMinutes = 0;
      const startedAt = endedAt;
      
      await db.createLog({
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber,
        floor: selectedRoom.floor,
        cleanerId: currentUser.id,
        cleanerName: currentUser.name,
        startedAt,
        endedAt,
        durationMinutes,
        notes: cleaningNotes ? cleaningNotes + ' - Khách treo DND (DD)' : 'Khách treo DND (DD)',
        photoAfter: cleaningPhoto || undefined
      });

      await db.updateRoom({
        ...selectedRoom,
        status: 'dnd',
        isChecked: false,
        checkedBy: undefined,
        checkedAt: undefined,
        photoDefect: undefined,
        notes: selectedRoom.notes ? selectedRoom.notes + ' - Khách treo DND (DD)' : 'Khách treo DND (DD)',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        assignedTo: currentUser.id,
        cleanerName: currentUser.name
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      addToast(
        language === 'vi' 
          ? 'Đã chuyển trạng thái phòng thành DND (DD)!' 
          : language === 'ja'
            ? '部屋のステータスをDNDに変更しました！'
            : 'Room status set to DND successfully!',
        'success'
      );
      setSelectedRoom(null);
    } catch (e) {
      showMutationError(e, 'Error saving DND room status');
    }
  };

  const handleRevertDND = async () => {
    if (!selectedRoom || !currentUser) return;
    if (isLocked) {
      addToast(
        language === 'vi'
          ? 'Ngày này đã chốt hoàn tất, không thể chỉnh sửa dữ liệu.'
          : language === 'ja'
            ? 'この日付はすでに締め切られているため、データを変更できません。'
            : 'This date is finalized and locked. No changes are allowed.',
        'warning'
      );
      return;
    }
    try {
      await db.updateRoom({
        ...selectedRoom,
        status: 'dirty',
        isChecked: false,
        checkedBy: undefined,
        checkedAt: undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      });

      addToast(
        language === 'vi' 
          ? `Đã hủy trạng thái DND và chuyển phòng ${selectedRoom.roomNumber} về cần dọn.` 
          : language === 'ja'
            ? `DND状態を取り消し、部屋 ${selectedRoom.roomNumber} を要清掃に戻しました。`
            : `Reverted DND status and set room ${selectedRoom.roomNumber} to dirty.`,
        'success'
      );
      setSelectedRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error reverting DND room status', 'warning');
    }
  };

  const handleRoomCardClick = (room: Room) => {
    setSelectedRoom(room);
    if (gridMode === 'setup') {
      setSetupForm({
        status: room.status,
        isStay: room.isStay,
        guestCount: room.guestCount,
        notes: room.notes || ''
      });
      setSetupModalOpen(true);
    } else {
      if (room.status === 'dirty' || room.status === 'cleaning' || room.status === 'eco' || room.status === 'dnd' || (room.isStay && room.status === 'occupied')) {
        setCleaningNotes('');
        setCleaningPhoto(null);
        setCameraActive(false);
        setShowSourceChoice(false);
      }
    }
  };

  const saveRoomSetup = async () => {
    if (!selectedRoom || !currentUser) return;
    if (isLocked) {
      addToast(
        language === 'vi'
          ? 'Ngày này đã chốt hoàn tất, không thể chỉnh sửa dữ liệu.'
          : language === 'ja'
            ? 'この日付はすでに締め切られているため、データを変更できません。'
            : 'This date is finalized and locked. No changes are allowed.',
        'warning'
      );
      return;
    }
    try {
      // Determine check status based on status change
      let extraFields: Partial<Room> = {};
      if (setupForm.status === 'clean') {
        extraFields = {
          isChecked: false,
          checkedBy: undefined,
          checkedAt: undefined
        };
      } else {
        extraFields = {
          isChecked: undefined,
          checkedBy: undefined,
          checkedAt: undefined
        };
      }

      await db.updateRoom({
        ...selectedRoom,
        status: setupForm.status,
        isStay: setupForm.isStay,
        guestCount: setupForm.guestCount,
        notes: setupForm.notes,
        ...extraFields,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      });
      addToast(
        language === 'vi' 
          ? `Đã cập nhật cấu hình phòng ${selectedRoom.roomNumber}` 
          : language === 'ja'
             ? `部屋 ${selectedRoom.roomNumber} の設定を更新しました`
             : `Updated setup for room ${selectedRoom.roomNumber}`,
        'success'
      );
      setSetupModalOpen(false);
      setSelectedRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error saving room setup', 'warning');
    }
  };

  const getSelectedDefects = () => {
    const list: string[] = [];
    if (defectFloor) list.push("Chưa lau sàn / hút bụi");
    if (defectAmenities) list.push("Thiếu khăn / đồ tiêu hao");
    if (defectBathroom) list.push("Bẩn nhà vệ sinh / bồn tắm");
    if (defectBed) list.push("Ga giường nhăn / bẩn");
    if (defectTrash) list.push("Chưa đổ rác");
    if (defectDust) list.push("Còn bụi bẩn trên bàn / tủ");
    if (defectOther && defectOtherText.trim()) {
      list.push(`Lỗi khác: ${defectOtherText.trim()}`);
    }
    return list;
  };

  const handleApproveClean = async () => {
    if (!selectedRoom || !currentUser) return;
    if (isLocked) {
      addToast(
        language === 'vi'
          ? 'Ngày này đã chốt hoàn tất, không thể chỉnh sửa dữ liệu.'
          : language === 'ja'
            ? 'この日付はすでに締め切られているため、データを変更できません。'
            : 'This date is finalized and locked. No changes are allowed.',
        'warning'
      );
      return;
    }
    try {
      const defects = getSelectedDefects();

      const isDndHanging = selectedRoom.isStay && selectedRoom.notes && (
        selectedRoom.notes.includes('Chỉ cần treo đồ') || selectedRoom.notes.includes('DND')
      );

      // Mark as checked (approved)
      await db.updateRoom({
        ...selectedRoom,
        status: isDndHanging ? 'dnd' : selectedRoom.status,
        isChecked: true,
        checkedBy: currentUser.name,
        checkedAt: new Date().toISOString(),
        checkerNotes: checkerNotes.trim() || undefined,
        viewedCleanerNotes: viewedCleanerNotes,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      });

      // Update log with defects and checker info
      if (roomLog) {
        await db.updateLog({
          ...roomLog,
          errors: defects,
          checkedBy: currentUser.name,
          checkedAt: new Date().toISOString(),
          checkerNotes: checkerNotes.trim() || undefined,
          viewedCleanerNotes: viewedCleanerNotes
        });
      }

      // Confetti celebration!
      confetti({
        particleCount: 60,
        spread: 40,
        origin: { y: 0.7 }
      });

      addToast(
        language === 'vi' 
          ? `Đã phê duyệt phòng ${selectedRoom.roomNumber} sạch sẵn sàng.` 
          : language === 'ja'
            ? `部屋 ${selectedRoom.roomNumber} の清掃を承認しました。`
            : `Approved room ${selectedRoom.roomNumber} as ready.`,
        'success'
      );
      setSelectedRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error approving room', 'warning');
    }
  };

  const handleRequestReclean = async () => {
    if (!selectedRoom || !currentUser) return;
    if (isLocked) {
      addToast(
        language === 'vi'
          ? 'Ngày này đã chốt hoàn tất, không thể chỉnh sửa dữ liệu.'
          : language === 'ja'
            ? 'この日付はすでに締め切られているため、データを変更できません。'
            : 'This date is finalized and locked. No changes are allowed.',
        'warning'
      );
      return;
    }
    const checkedErrors = getSelectedDefects();
    if (checkedErrors.length === 0 && !recleanReason.trim()) {
      addToast(
        language === 'vi' ? 'Vui lòng chọn hoặc nhập lý do cần dọn lại' : language === 'ja' ? '再清掃の理由を入力してください' : 'Please select or enter a reason for recleaning', 
        'warning'
      );
      return;
    }

    try {
      const finalReason = checkedErrors.length > 0 ? checkedErrors.join(', ') : recleanReason.trim();
      const reasonNote = `Cần dọn lại: ${finalReason}`;
      
      // Revert status to dirty, reset isChecked, and add directive notes
      await db.updateRoom({
        ...selectedRoom,
        status: 'dirty',
        isChecked: false,
        checkedBy: undefined,
        checkedAt: undefined,
        cleanerName: '',
        assignedTo: '',
        notes: reasonNote,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      });

      // Update log with defects
      if (roomLog) {
        await db.updateLog({
          ...roomLog,
          errors: checkedErrors.length > 0 ? checkedErrors : [recleanReason.trim()]
        });
      }

      addToast(
        language === 'vi' 
          ? `Đã yêu cầu dọn lại phòng ${selectedRoom.roomNumber}.` 
          : language === 'ja'
            ? `部屋 ${selectedRoom.roomNumber} の再清掃を要求しました。`
            : `Requested recleaning for room ${selectedRoom.roomNumber}.`,
        'info'
      );
      setSelectedRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error requesting reclean', 'warning');
    }
  };

  const handleRevertEco = async () => {
    if (!selectedRoom || !currentUser) return;
    if (isLocked) {
      addToast(
        language === 'vi'
          ? 'Ngày này đã chốt hoàn tất, không thể chỉnh sửa dữ liệu.'
          : language === 'ja'
            ? 'この日付はすでに締め切られているため、データを変更できません。'
            : 'This date is finalized and locked. No changes are allowed.',
        'warning'
      );
      return;
    }
    try {
      await db.updateRoom({
        ...selectedRoom,
        isChecked: false,
        checkedBy: undefined,
        checkedAt: undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      });

      addToast(
        language === 'vi' 
          ? `Đã hủy duyệt phòng ${selectedRoom.roomNumber}` 
          : language === 'ja'
            ? `部屋 ${selectedRoom.roomNumber} の承認を取り消しました`
            : `Reverted approval status for room ${selectedRoom.roomNumber}`,
        'success'
      );
      setSelectedRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error reverting room status', 'warning');
    }
  };

  // Unique floors list for dropdown filter
  const floors = useMemo(() => {
    return Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  }, [rooms]);

  // Filter and search logic
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFloor = floorFilter === 'all' || room.floor.toString() === floorFilter;
      
      let matchesCheck = true;
      if (checkFilter === 'pending') {
        matchesCheck = room.status === 'clean' && !room.isChecked;
      } else if (checkFilter === 'approved') {
        matchesCheck = (room.status === 'clean' || (room.status === 'dnd' && room.isStay)) && !!room.isChecked;
      }
      
      return matchesSearch && matchesFloor && matchesCheck;
    });
  }, [rooms, searchTerm, floorFilter, checkFilter]);

  // Group filtered rooms by floor
  const roomsByFloor = useMemo(() => {
    return filteredRooms.reduce((acc, room) => {
      if (!acc[room.floor]) {
        acc[room.floor] = [];
      }
      acc[room.floor].push(room);
      return acc;
    }, {} as Record<number, Room[]>);
  }, [filteredRooms]);

  // Group rooms for full-screen carousel (ignores floor filter, respects search and checkStatus)
  const carouselRoomsByFloor = useMemo(() => {
    const filteredForCarousel = rooms.filter(room => {
      const matchesSearch = room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesCheck = true;
      if (checkFilter === 'pending') {
        matchesCheck = room.status === 'clean' && !room.isChecked;
      } else if (checkFilter === 'approved') {
        matchesCheck = (room.status === 'clean' || (room.status === 'dnd' && room.isStay)) && !!room.isChecked;
      }
      
      return matchesSearch && matchesCheck;
    });

    return filteredForCarousel.reduce((acc, room) => {
      if (!acc[room.floor]) {
        acc[room.floor] = [];
      }
      acc[room.floor].push(room);
      return acc;
    }, {} as Record<number, Room[]>);
  }, [rooms, searchTerm, checkFilter]);

  const carouselSortedFloors = useMemo(() => {
    return Object.keys(carouselRoomsByFloor)
      .map(Number)
      .sort((a, b) => a - b);
  }, [carouselRoomsByFloor]);

  useEffect(() => {
    if (carouselSortedFloors.length > 0 && customSelectedFloors.length === 0) {
      setCustomSelectedFloors(carouselSortedFloors);
    }
  }, [carouselSortedFloors]);

  useEffect(() => {
    if (!hasRestoredFloorRef.current && carouselSortedFloors.length > 0) {
      if (isFullScreenFloorView) {
        const params = new URLSearchParams(window.location.search);
        const floorStr = params.get('fullscreenFloor');
        if (floorStr) {
          const targetFloor = Number(floorStr);
          const idx = carouselSortedFloors.indexOf(targetFloor);
          if (idx !== -1) {
            setActiveFloorIndex(idx);
          }
        }
      }
      hasRestoredFloorRef.current = true;
    }
  }, [carouselSortedFloors, isFullScreenFloorView]);

  useEffect(() => {
    if (!hasRestoredFloorRef.current) return;

    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      changed = true;
    }

    if (params.get('staffLayout') !== staffLayout) {
      params.set('staffLayout', staffLayout);
      localStorage.setItem('hotel_clean_staff_layout', staffLayout);
      changed = true;
    }

    if (params.get('staffSortField') !== staffSortField) {
      params.set('staffSortField', staffSortField);
      localStorage.setItem('hotel_clean_staff_sort_field', staffSortField);
      changed = true;
    }

    if (params.get('staffSortOrder') !== staffSortOrder) {
      params.set('staffSortOrder', staffSortOrder);
      localStorage.setItem('hotel_clean_staff_sort_order', staffSortOrder);
      changed = true;
    }

    if (params.get('staffViewMode') !== staffViewMode) {
      params.set('staffViewMode', staffViewMode);
      localStorage.setItem('hotel_clean_staff_view_mode', staffViewMode);
      changed = true;
    }

    if (params.get('gridMode') !== gridMode) {
      params.set('gridMode', gridMode);
      localStorage.setItem('hotel_clean_grid_mode', gridMode);
      changed = true;
    }

    if (params.get('gridCols') !== gridColumns) {
      params.set('gridCols', gridColumns);
      localStorage.setItem('hotel_clean_room_grid_columns', gridColumns);
      changed = true;
    }

    const fullscreenParam = isFullScreenFloorView ? 'true' : null;
    if (params.get('fullscreen') !== fullscreenParam) {
      if (fullscreenParam) {
        params.set('fullscreen', fullscreenParam);
      } else {
        params.delete('fullscreen');
      }
      changed = true;
    }

    const currentFloor = isFullScreenFloorView && carouselSortedFloors[activeFloorIndex] !== undefined
      ? String(carouselSortedFloors[activeFloorIndex])
      : null;
    if (params.get('fullscreenFloor') !== currentFloor) {
      if (currentFloor) {
        params.set('fullscreenFloor', currentFloor);
      } else {
        params.delete('fullscreenFloor');
      }
      changed = true;
    }

    if (changed) {
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [
    activeTab, staffLayout, staffSortField, staffSortOrder, staffViewMode, gridMode, gridColumns,
    isFullScreenFloorView, activeFloorIndex, carouselSortedFloors
  ]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        setActiveFloorIndex(prev => Math.min(prev + 1, carouselSortedFloors.length - 1));
      } else {
        setActiveFloorIndex(prev => Math.max(prev - 1, 0));
      }
    }
    
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const { totalCleaned, pendingCheck, approvedCheck } = useMemo(() => {
    return {
      totalCleaned: rooms.filter(r => r.status === 'clean' || r.status === 'eco' || (r.status === 'dnd' && r.isStay && r.isChecked)).length,
      pendingCheck: rooms.filter(r => r.status === 'clean' && !r.isChecked).length,
      approvedCheck: rooms.filter(r => (r.status === 'clean' || (r.status === 'dnd' && r.isStay)) && r.isChecked).length
    };
  }, [rooms]);

  const branchStats = useMemo(() => {
    const total = rooms.length;
    const clean = rooms.filter(r => r.status === 'clean').length;
    const dirty = rooms.filter(r => r.status === 'dirty').length;
    const cleaning = rooms.filter(r => r.status === 'cleaning').length;
    const maintenance = rooms.filter(r => r.status === 'maintenance').length;
    const eco = rooms.filter(r => r.status === 'eco').length;
    const dnd = rooms.filter(r => r.status === 'dnd').length;
    const vacant = rooms.filter(r => r.status === 'vacant').length;
    const occupied = rooms.filter(r => r.status === 'occupied').length;

    const stayRooms = rooms.filter(r => r.isStay).length;
    const checkoutRooms = rooms.filter(r => !r.isStay).length;

    // Filter logs based on statsTimeRange
    const activeDateObj = new Date(activeDate);
    const rangeLogs = logs.filter(log => {
      if (!log.endedAt || log.durationMinutes <= 0) return false;
      const logDateStr = log.endedAt.split('T')[0];
      
      if (statsTimeRange === 'today') {
        return logDateStr === activeDate;
      }
      
      const logDateObj = new Date(logDateStr);
      if (isNaN(logDateObj.getTime())) return false;
      
      const diffTime = activeDateObj.getTime() - logDateObj.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (statsTimeRange === 'week') {
        return diffDays >= 0 && diffDays < 7;
      } else if (statsTimeRange === 'month') {
        return diffDays >= 0 && diffDays < 30;
      } else { // statsTimeRange === 'year'
        return diffDays >= 0 && diffDays < 365;
      }
    });

    const activeWorkers = statsTimeRange === 'today'
      ? activeStaffIds.length
      : new Set(rangeLogs.map(l => l.cleanerId)).size;

    const totalDuration = rangeLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
    const finishedCount = rangeLogs.length;
    const avgCleaningTime = finishedCount > 0 ? Math.round(totalDuration / finishedCount) : 0;

    // Cleaner productivity leaderboard
    const cleanerMap: Record<string, { name: string; count: number; totalDuration: number }> = {};
    rangeLogs.forEach(log => {
      const key = log.cleanerName || log.cleanerId || 'Unknown';
      if (!cleanerMap[key]) {
        cleanerMap[key] = { name: key, count: 0, totalDuration: 0 };
      }
      cleanerMap[key].count += 1;
      cleanerMap[key].totalDuration += log.durationMinutes;
    });

    const leaderboard = Object.values(cleanerMap).map(c => {
      const avgTime = Math.round(c.totalDuration / c.count);
      let speedCategory: 'fast' | 'normal' | 'slow' = 'normal';
      if (avgTime < 30) speedCategory = 'fast';
      else if (avgTime > 40) speedCategory = 'slow';

      return {
        name: c.name,
        count: c.count,
        avgTime,
        speedCategory
      };
    }).sort((a, b) => b.count - a.count || a.avgTime - b.avgTime);

    // Calculate Defects/Errors Stats
    let totalErrors = 0;
    const errorTypeMap: Record<string, number> = {};
    const cleanerErrorMap: Record<string, { name: string; count: number; errorList: string[] }> = {};

    rangeLogs.forEach(log => {
      if (log.errors && log.errors.length > 0) {
        totalErrors += log.errors.length;
        log.errors.forEach(err => {
          errorTypeMap[err] = (errorTypeMap[err] || 0) + 1;
        });

        const key = log.cleanerName || log.cleanerId || 'Unknown';
        if (!cleanerErrorMap[key]) {
          cleanerErrorMap[key] = { name: key, count: 0, errorList: [] };
        }
        cleanerErrorMap[key].count += log.errors.length;
        cleanerErrorMap[key].errorList.push(...log.errors);
      }
    });

    const defectRate = finishedCount > 0
      ? Math.round((rangeLogs.filter(l => l.errors && l.errors.length > 0).length / finishedCount) * 100)
      : 0;

    const errorBreakdown = Object.entries(errorTypeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const cleanerErrorLeaderboard = Object.values(cleanerErrorMap)
      .sort((a, b) => b.count - a.count);

    // Grouping trend data based on statsTimeRange
    let hourlyTrend: { label: string; out: number; stay: number; dnd: number; total: number }[] = [];

    if (statsTimeRange === 'today') {
      const hourlyBins: Record<number, { out: number; stay: number; dnd: number }> = {};
      for (let h = 8; h <= 18; h++) {
        hourlyBins[h] = { out: 0, stay: 0, dnd: 0 };
      }
      rangeLogs.forEach(log => {
        try {
          const dateObj = new Date(log.endedAt);
          if (!isNaN(dateObj.getTime())) {
            let hour = dateObj.getHours();
            if (hour < 8) hour = 8;
            if (hour > 18) hour = 18;
            
            const room = rooms.find(r => r.id === log.roomId);
            let category: 'out' | 'stay' | 'dnd' = 'out';
            if (room) {
              if (room.status === 'dnd') category = 'dnd';
              else if (room.isStay) category = 'stay';
            }
            hourlyBins[hour][category]++;
          }
        } catch (e) {}
      });

      hourlyTrend = Object.keys(hourlyBins).map(hStr => {
        const h = Number(hStr);
        const label = h === 18 ? '18:00+' : `${h.toString().padStart(2, '0')}:00`;
        const bin = hourlyBins[h];
        return {
          label,
          out: bin.out,
          stay: bin.stay,
          dnd: bin.dnd,
          total: bin.out + bin.stay + bin.dnd
        };
      });

    } else if (statsTimeRange === 'week' || statsTimeRange === 'month') {
      const daysCount = statsTimeRange === 'week' ? 7 : 30;
      const dailyBins: Record<string, { out: number; stay: number; dnd: number }> = {};
      
      const daysList: string[] = [];
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(activeDateObj);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        daysList.push(dStr);
        dailyBins[dStr] = { out: 0, stay: 0, dnd: 0 };
      }

      rangeLogs.forEach(log => {
        const logDateStr = log.endedAt.split('T')[0];
        if (dailyBins[logDateStr]) {
          const room = rooms.find(r => r.id === log.roomId);
          let category: 'out' | 'stay' | 'dnd' = 'out';
          if (room) {
            if (room.status === 'dnd') category = 'dnd';
            else if (room.isStay) category = 'stay';
          }
          dailyBins[logDateStr][category]++;
        }
      });

      hourlyTrend = daysList.map(dStr => {
        const bin = dailyBins[dStr];
        const dateParts = dStr.split('-');
        const label = `${dateParts[2]}/${dateParts[1]}`; // DD/MM
        return {
          label,
          out: bin.out,
          stay: bin.stay,
          dnd: bin.dnd,
          total: bin.out + bin.stay + bin.dnd
        };
      });

    } else { // statsTimeRange === 'year'
      const monthlyBins: Record<string, { out: number; stay: number; dnd: number }> = {};
      const monthsList: string[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const d = new Date(activeDateObj.getFullYear(), activeDateObj.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${yyyy}-${mm}`;
        monthsList.push(key);
        monthlyBins[key] = { out: 0, stay: 0, dnd: 0 };
      }

      rangeLogs.forEach(log => {
        try {
          const logDateStr = log.endedAt.split('T')[0];
          const key = logDateStr.substring(0, 7);
          if (monthlyBins[key]) {
            const room = rooms.find(r => r.id === log.roomId);
            let category: 'out' | 'stay' | 'dnd' = 'out';
            if (room) {
              if (room.status === 'dnd') category = 'dnd';
              else if (room.isStay) category = 'stay';
            }
            monthlyBins[key][category]++;
          }
        } catch (e) {}
      });

      hourlyTrend = monthsList.map(key => {
        const bin = monthlyBins[key];
        const parts = key.split('-');
        const label = `${parts[1]}/${parts[0].substring(2)}`; // MM/YY
        return {
          label,
          out: bin.out,
          stay: bin.stay,
          dnd: bin.dnd,
          total: bin.out + bin.stay + bin.dnd
        };
      });
    }

    const percentClean = total > 0 ? Math.round((clean / total) * 100) : 0;

    return {
      total,
      clean,
      dirty,
      cleaning,
      maintenance,
      eco,
      dnd,
      vacant,
      occupied,
      stayRooms,
      checkoutRooms,
      activeWorkers,
      avgCleaningTime,
      leaderboard,
      hourlyTrend,
      percentClean,
      totalErrors,
      defectRate,
      errorBreakdown,
      cleanerErrorLeaderboard,
      finishedCount
    };
  }, [rooms, logs, activeStaffIds, activeDate, statsTimeRange]);

  const filteredLeaderboard = useMemo(() => {
    const list = branchStats?.leaderboard || [];
    return list.filter(cleaner => {
      const term = leaderboardSearchTerm.toLowerCase().trim();
      return !term || cleaner.name.toLowerCase().includes(term);
    });
  }, [branchStats?.leaderboard, leaderboardSearchTerm]);

  const sortedLeaderboard = useMemo(() => {
    return [...filteredLeaderboard].sort((a, b) => {
      let comparison = 0;
      if (leaderboardSortBy === 'count') {
        comparison = b.count - a.count || a.avgTime - b.avgTime;
      } else {
        comparison = a.avgTime - b.avgTime || b.count - a.count;
      }
      return leaderboardSortOrder === 'desc' ? comparison : -comparison;
    });
  }, [filteredLeaderboard, leaderboardSortBy, leaderboardSortOrder]);

  const paginatedLeaderboard = useMemo(() => {
    if (leaderboardPerPage === 0) return sortedLeaderboard;
    const startIndex = (leaderboardPage - 1) * leaderboardPerPage;
    return sortedLeaderboard.slice(startIndex, startIndex + leaderboardPerPage);
  }, [sortedLeaderboard, leaderboardPage, leaderboardPerPage]);

  const totalLeaderboardPages = useMemo(() => {
    if (leaderboardPerPage === 0 || sortedLeaderboard.length === 0) return 1;
    return Math.ceil(sortedLeaderboard.length / leaderboardPerPage);
  }, [sortedLeaderboard.length, leaderboardPerPage]);

  useEffect(() => {
    setLeaderboardPage(1);
  }, [statsTimeRange, leaderboardSortBy, leaderboardSortOrder, leaderboardPerPage, leaderboardSearchTerm]);

  const sortedCleanerErrorLeaderboard = useMemo(() => {
    const list = branchStats?.cleanerErrorLeaderboard || [];
    return [...list].sort((a, b) => {
      if (defectSortField === 'name') {
        return defectSortOrder === 'asc'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      } else {
        return defectSortOrder === 'asc'
          ? a.count - b.count
          : b.count - a.count;
      }
    });
  }, [branchStats?.cleanerErrorLeaderboard, defectSortField, defectSortOrder]);

  const paginatedCleanerErrorLeaderboard = useMemo(() => {
    if (defectPerPage === 0) return sortedCleanerErrorLeaderboard;
    const startIndex = (defectPage - 1) * defectPerPage;
    return sortedCleanerErrorLeaderboard.slice(startIndex, startIndex + defectPerPage);
  }, [sortedCleanerErrorLeaderboard, defectPage, defectPerPage]);

  const totalDefectPages = useMemo(() => {
    if (defectPerPage === 0 || sortedCleanerErrorLeaderboard.length === 0) return 1;
    return Math.ceil(sortedCleanerErrorLeaderboard.length / defectPerPage);
  }, [sortedCleanerErrorLeaderboard.length, defectPerPage]);

  useEffect(() => {
    setDefectPage(1);
  }, [statsTimeRange, defectPerPage, defectSortField, defectSortOrder]);

  // Helper for showing cleaner activity (cleaning, finished count) in Checker
  const getCleanerActivity = (cleanerId: string) => {
    const activeRooms = rooms.filter(r => r.status === 'cleaning' && r.assignedTo === cleanerId);
    const activeDatePrefix = activeDate;
    const todayLogs = logs.filter(l => l.cleanerId === cleanerId && l.endedAt.startsWith(activeDatePrefix));
    return {
      activeRooms,
      todayLogs
    };
  };

  const sortedTodayCleaners = useMemo(() => {
    const filtered = cleaners.filter(cleaner => 
      cleaner.name.toLowerCase().includes(dailyStaffSearchTerm.toLowerCase()) ||
      cleaner.username.toLowerCase().includes(dailyStaffSearchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (staffSortField === 'name') {
        comparison = a.name.localeCompare(b.name, language === 'vi' ? 'vi' : 'ja');
      } else if (staffSortField === 'username') {
        comparison = (a.username || '').localeCompare(b.username || '');
      } else if (staffSortField === 'status') {
        const aActive = activeStaffIds.includes(a.id) ? 1 : 0;
        const bActive = activeStaffIds.includes(b.id) ? 1 : 0;
        comparison = bActive - aActive;
      }
      return staffSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [cleaners, dailyStaffSearchTerm, staffSortField, staffSortOrder, activeStaffIds, language]);

  const sortedTotalUsers = useMemo(() => {
    const filtered = allHotelUsers.filter(user => 
      user.name.toLowerCase().includes(dailyStaffSearchTerm.toLowerCase()) ||
      (user.username || '').toLowerCase().includes(dailyStaffSearchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (staffSortField === 'name') {
        comparison = a.name.localeCompare(b.name, language === 'vi' ? 'vi' : 'ja');
      } else if (staffSortField === 'username') {
        comparison = (a.username || '').localeCompare(b.username || '');
      } else if (staffSortField === 'role') {
        comparison = (a.role || '').localeCompare(b.role || '');
      } else if (staffSortField === 'status') {
        const aActive = activeStaffIds.includes(a.id) ? 1 : 0;
        const bActive = activeStaffIds.includes(b.id) ? 1 : 0;
        comparison = bActive - aActive;
      }
      return staffSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [allHotelUsers, dailyStaffSearchTerm, staffSortField, staffSortOrder, activeStaffIds, language]);

  const paginatedTodayCleaners = useMemo(() => {
    const itemsPerPage = 12;
    const startIdx = (staffPage - 1) * itemsPerPage;
    return sortedTodayCleaners.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedTodayCleaners, staffPage]);

  const paginatedTotalUsers = useMemo(() => {
    const itemsPerPage = 12;
    const startIdx = (staffPage - 1) * itemsPerPage;
    return sortedTotalUsers.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedTotalUsers, staffPage]);

  const totalTodayPages = useMemo(() => {
    return Math.ceil(sortedTodayCleaners.length / 12) || 1;
  }, [sortedTodayCleaners]);

  const totalTotalPages = useMemo(() => {
    return Math.ceil(sortedTotalUsers.length / 12) || 1;
  }, [sortedTotalUsers]);

  useEffect(() => {
    setStaffPage(1);
  }, [dailyStaffSearchTerm, staffViewMode, staffSortField, staffSortOrder]);

  return (
    <div className="main-content">
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {language === 'vi' ? 'Màn hình Giám sát / Kiểm phòng' : language === 'ja' ? '客室検査ダッシュボード' : 'Room Checker Dashboard'}
        </h2>
      </div>

      <div className="dashboard-layout">
        {/* Left Sidebar Menu */}
        <aside className="sidebar-menu glass-panel">
          <button
            className={`sidebar-link ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <LayoutDashboard size={16} />
            <span>{language === 'vi' ? 'Thống kê' : language === 'ja' ? '分析統計' : 'Analytics'}</span>
          </button>
          <button
            className={`sidebar-link ${activeTab === 'grid' ? 'active' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            <Hotel size={16} />
            <span>{language === 'vi' ? 'Sơ đồ kiểm phòng' : language === 'ja' ? '客室検査ボード' : 'Inspection Board'}</span>
          </button>
          <button
            className={`sidebar-link ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <ClipboardList size={16} />
            <span>{getTranslation(language, 'cleaningSummary')}</span>
          </button>
          <button
            className={`sidebar-link ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={16} />
            <span>{language === 'vi' ? 'Phân công dọn dẹp' : language === 'ja' ? '出勤スタッフ設定' : 'Staff Assignment'}</span>
          </button>

          <div className="sidebar-mobile-actions">
            {/* User Profile & Logout */}
            <div className="mobile-action-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  backgroundColor: 'rgba(0,0,0,0.05)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <UserIcon size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{currentUser?.name}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                    {currentUser?.role === 'admin' ? getTranslation(language, 'roleAdmin') :
                     currentUser?.role === 'front_desk' ? getTranslation(language, 'roleFrontDesk') :
                     currentUser?.role === 'checka' ? getTranslation(language, 'roleChecker') :
                     currentUser?.role === 'kacho' ? getTranslation(language, 'roleKacho') : currentUser?.role}
                  </span>
                </div>
              </div>
              <button 
                onClick={logout} 
                className="btn btn-danger btn-sm" 
                title={getTranslation(language, 'logout')}
                style={{ padding: '0.4rem', borderRadius: '50%' }}
                aria-label="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>

            {/* Date Selector & Dark Mode Toggle */}
            <div className="mobile-action-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div 
                onClick={() => {
                  if (currentUser?.role !== 'housekeeping') {
                    window.dispatchEvent(new CustomEvent('open-date-modal'));
                  }
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  backgroundColor: 'rgba(0,0,0,0.03)', 
                  padding: '0.35rem 0.75rem', 
                  borderRadius: '20px', 
                  border: '1px solid rgba(0,0,0,0.05)',
                  cursor: currentUser?.role === 'housekeeping' ? 'default' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  userSelect: 'none'
                }}
                className={currentUser?.role === 'housekeeping' ? '' : 'date-picker-pill'}
              >
                <span style={{ fontSize: '0.85rem' }}>📅</span>
                <span>{activeDate}</span>
              </div>

              <button 
                onClick={toggleDarkMode}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.4rem', borderRadius: '50%' }}
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>

            {/* Language switcher */}
            <div className="mobile-action-row" style={{ justifyContent: 'center' }}>
              <div className="lang-selector">
                <button 
                  className={`lang-btn ${language === 'ja' ? 'active' : ''}`} 
                  onClick={() => setLanguage('ja')}
                  aria-label="Switch to Japanese"
                  aria-pressed={language === 'ja'}
                >
                  JP
                </button>
                <button 
                  className={`lang-btn ${language === 'vi' ? 'active' : ''}`} 
                  onClick={() => setLanguage('vi')}
                  aria-label="Switch to Vietnamese"
                  aria-pressed={language === 'vi'}
                >
                  VN
                </button>
                <button 
                  className={`lang-btn ${language === 'en' ? 'active' : ''}`} 
                  onClick={() => setLanguage('en')}
                  aria-label="Switch to English"
                  aria-pressed={language === 'en'}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Dashboard Content */}
        <main className="dashboard-content-panel">
          {isLocked && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}>
              <span>🔒</span>
              <span>
                {language === 'vi' 
                  ? 'Ngày này đã chốt hoàn tất. Toàn bộ thông tin hiển thị ở chế độ Chỉ Đọc (Read-Only).' 
                  : language === 'ja'
                    ? 'この日付は業務締め切り済みです。すべての情報は読み取り専用です。'
                    : 'This date is locked/finalized. All information is in Read-Only mode.'}
              </span>
            </div>
          )}

          {activeTab === 'stats' && branchStats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Stats Time Range Switcher */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.5rem' }}>
                <div className="capsule-switcher" style={{ display: 'inline-flex' }}>
                  <button 
                    type="button"
                    onClick={() => setStatsTimeRange('today')}
                    className={`capsule-button ${statsTimeRange === 'today' ? 'active' : ''}`}
                  >
                    <span>📅</span>
                    <span>{language === 'vi' ? 'Hôm nay' : language === 'ja' ? '本日' : 'Today'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setStatsTimeRange('week')}
                    className={`capsule-button ${statsTimeRange === 'week' ? 'active' : ''}`}
                  >
                    <span>📊</span>
                    <span>{language === 'vi' ? 'Tuần này' : language === 'ja' ? '今週' : 'This Week'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setStatsTimeRange('month')}
                    className={`capsule-button ${statsTimeRange === 'month' ? 'active' : ''}`}
                  >
                    <span>📈</span>
                    <span>{language === 'vi' ? 'Tháng này' : language === 'ja' ? '今月' : 'This Month'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setStatsTimeRange('year')}
                    className={`capsule-button ${statsTimeRange === 'year' ? 'active' : ''}`}
                  >
                    <span>📅</span>
                    <span>{language === 'vi' ? 'Năm nay' : language === 'ja' ? '今年' : 'This Year'}</span>
                  </button>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="metrics-grid">
                {/* Progress Card / Total Cleaned Card */}
                <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-clean)' }}>
                  <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {statsTimeRange === 'today' ? (
                      <>
                        <div className="metric-value">{branchStats.percentClean}%</div>
                        <div className="metric-label">{language === 'vi' ? 'Tiến độ dọn phòng' : language === 'ja' ? '清掃進捗率' : 'Cleaning Progress'}</div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden', marginTop: '0.4rem' }}>
                          <div style={{ width: `${branchStats.percentClean}%`, height: '100%', backgroundColor: 'var(--status-clean)' }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="metric-value">{branchStats.finishedCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{language === 'vi' ? 'phòng' : language === 'ja' ? '室' : 'rooms'}</span></div>
                        <div className="metric-label">
                          {statsTimeRange === 'week' 
                            ? (language === 'vi' ? 'Tổng phòng dọn tuần qua' : language === 'ja' ? '週間清掃完了合計' : 'Weekly Total Cleaned')
                            : (language === 'vi' ? 'Tổng phòng dọn tháng qua' : language === 'ja' ? '月間清掃完了合計' : 'Monthly Total Cleaned')}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Avg Time Card */}
                <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-cleaning)' }}>
                  <div className="metric-icon" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--status-cleaning)' }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="metric-value">{branchStats.avgCleaningTime} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{language === 'vi' ? 'phút' : language === 'ja' ? '分' : 'm'}</span></div>
                    <div className="metric-label">{language === 'vi' ? 'T.gian dọn TB' : language === 'ja' ? '平均清掃時間' : 'Avg Cleaning Time'}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                      {language === 'vi' ? `Tính từ ${branchStats.finishedCount} lượt hoàn thành` : language === 'ja' ? `完了${branchStats.finishedCount}件に基づく` : `Based on ${branchStats.finishedCount} completions`}
                    </div>
                  </div>
                </div>

                {/* Workers Card */}
                <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                  <div className="metric-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="metric-value">{branchStats.activeWorkers}</div>
                    <div className="metric-label">
                      {statsTimeRange === 'today'
                        ? (language === 'vi' ? 'Nhân sự làm việc hôm nay' : language === 'ja' ? '本日の出勤スタッフ数' : 'Active Staff Today')
                        : (language === 'vi' ? 'Nhân sự hoạt động trong kì' : language === 'ja' ? '出動スタッフ数' : 'Active Staff in Period')}
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                      {statsTimeRange === 'today' ? (
                        language === 'vi' ? `Trên tổng số ${cleaners.length} nhân viên` : language === 'ja' ? `登録スタッフ数: ${cleaners.length}名` : `Out of ${cleaners.length} cleaners`
                      ) : (
                        language === 'vi' ? `Tổng số nhân viên đã thực hiện dọn dẹp` : language === 'ja' ? `実際に稼働した清掃スタッフの合計` : `Total active housekeepers`
                      )}
                    </div>
                  </div>
                </div>

                {/* Setup / Defects Card */}
                <div className="metric-card glass-panel" style={{ borderLeft: statsTimeRange === 'today' ? '4px solid var(--status-dirty)' : '4px solid var(--status-maintenance)' }}>
                  <div className="metric-icon" style={{ 
                    backgroundColor: statsTimeRange === 'today' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                    color: statsTimeRange === 'today' ? 'var(--status-dirty)' : 'var(--status-maintenance)' 
                  }}>
                    {statsTimeRange === 'today' ? <Building size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    {statsTimeRange === 'today' ? (
                      <>
                        <div className="metric-value">{branchStats.total} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{language === 'vi' ? 'phòng' : language === 'ja' ? '室' : 'rooms'}</span></div>
                        <div className="metric-label">{language === 'vi' ? 'Tỉ lệ Stay / Checkout' : language === 'ja' ? '滞在 / アウト比率' : 'Stay / Checkout Ratio'}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                          🏠 {branchStats.stayRooms} {language === 'vi' ? 'Stay' : language === 'ja' ? '滞在' : 'Stay'} | 🚪 {branchStats.checkoutRooms} Checkout
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="metric-value" style={{ color: 'var(--status-maintenance)' }}>
                          {branchStats.totalErrors} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-color)' }}>{language === 'vi' ? 'lỗi' : language === 'ja' ? '不備' : 'defects'}</span>
                        </div>
                        <div className="metric-label">{language === 'vi' ? 'Thống kê lỗi trong kì' : language === 'ja' ? '期間中の不備指摘数' : 'Defects in Period'}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                          ⚠️ {language === 'vi' ? `Tỉ lệ lỗi phòng: ${branchStats.defectRate}%` : language === 'ja' ? `部屋指摘率: ${branchStats.defectRate}%` : `Defect rate: ${branchStats.defectRate}%`}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1.5rem' }}>
                
                {/* Donut Chart and Status Legend */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                    {language === 'vi' ? 'Phân Bổ Trạng Thái Phòng' : language === 'ja' ? '客室ステータス内訳' : 'Room Status Distribution'}
                  </h4>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    {/* SVG Donut */}
                    <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                      <svg width="100%" height="100%" viewBox="0 0 200 200">
                        <g transform="rotate(-90 100 100)">
                          {(() => {
                            const statusData = [
                              { key: 'clean', label: language === 'vi' ? 'Sạch' : language === 'ja' ? '清掃済' : 'Clean', value: branchStats.clean, color: 'var(--status-clean)' },
                              { key: 'dirty', label: language === 'vi' ? 'Bần' : language === 'ja' ? '未清掃' : 'Dirty', value: branchStats.dirty, color: 'var(--status-dirty)' },
                              { key: 'cleaning', label: language === 'vi' ? 'Đang dọn' : language === 'ja' ? '清掃中' : 'Cleaning', value: branchStats.cleaning, color: 'var(--status-cleaning)' },
                              { key: 'maintenance', label: language === 'vi' ? 'Bảo trì' : language === 'ja' ? '故障中' : 'Maintenance', value: branchStats.maintenance, color: 'var(--status-maintenance)' },
                              { key: 'eco', label: language === 'vi' ? 'Dọn Eco' : language === 'ja' ? 'エコ清掃' : 'Eco Clean', value: branchStats.eco, color: '#6366f1' },
                              { key: 'dnd', label: language === 'vi' ? 'Không làm phiền' : language === 'ja' ? '起こさないで' : 'DND', value: branchStats.dnd, color: '#a855f7' },
                              { key: 'vacant', label: language === 'vi' ? 'Phòng trống' : language === 'ja' ? '空室' : 'Vacant', value: branchStats.vacant, color: '#64748b' },
                              { key: 'occupied', label: language === 'vi' ? 'Có khách' : language === 'ja' ? '滞在' : 'Occupied', value: branchStats.occupied, color: '#3b82f6' },
                            ].filter(item => item.value > 0);

                            const totalValue = statusData.reduce((acc, item) => acc + item.value, 0);
                            const r = 60;
                            const cx = 100;
                            const cy = 100;
                            const circumference = 2 * Math.PI * r;

                            if (totalValue === 0) {
                              return (
                                <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="rgba(0,0,0,0.1)" strokeWidth="20" />
                              );
                            }

                            let accumulatedPercent = 0;
                            return (
                              <>
                                <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="rgba(0,0,0,0.05)" strokeWidth="20" />
                                {statusData.map(item => {
                                  const percentage = item.value / totalValue;
                                  const dashArray = `${percentage * circumference} ${circumference}`;
                                  const dashOffset = -accumulatedPercent * circumference;
                                  accumulatedPercent += percentage;
                                  return (
                                    <circle
                                      key={item.key}
                                      cx={cx}
                                      cy={cy}
                                      r={r}
                                      fill="transparent"
                                      stroke={item.color}
                                      strokeWidth="20"
                                      strokeDasharray={dashArray}
                                      strokeDashoffset={dashOffset}
                                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                                    />
                                  );
                                })}
                              </>
                            );
                          })()}
                        </g>
                        {/* Center labels */}
                        <text x="100" y="95" textAnchor="middle" dominantBaseline="middle" fill="currentColor" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                          {branchStats.total}
                        </text>
                        <text x="100" y="118" textAnchor="middle" dominantBaseline="middle" fill="currentColor" style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 600 }}>
                          {language === 'vi' ? 'TỔNG PHÒNG' : language === 'ja' ? '部屋合計' : 'ROOMS'}
                        </text>
                      </svg>
                    </div>

                    {/* Donut Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '130px' }}>
                      {[
                        { label: language === 'vi' ? 'Sạch (Clean)' : language === 'ja' ? '清掃済' : 'Clean', value: branchStats.clean, color: 'var(--status-clean)' },
                        { label: language === 'vi' ? 'Bẩn (Dirty)' : language === 'ja' ? '未清掃' : 'Dirty', value: branchStats.dirty, color: 'var(--status-dirty)' },
                        { label: language === 'vi' ? 'Đang dọn (Cleaning)' : language === 'ja' ? '清掃中' : 'Cleaning', value: branchStats.cleaning, color: 'var(--status-cleaning)' },
                        { label: language === 'vi' ? 'Bảo trì (Maint)' : language === 'ja' ? '故障中' : 'Maintenance', value: branchStats.maintenance, color: 'var(--status-maintenance)' },
                        { label: language === 'vi' ? 'Eco Clean' : language === 'ja' ? 'エコ清掃' : 'Eco Clean', value: branchStats.eco, color: '#6366f1' },
                        { label: language === 'vi' ? 'DND (Không phiền)' : language === 'ja' ? '起こさないで' : 'DND', value: branchStats.dnd, color: '#a855f7' },
                        { label: language === 'vi' ? 'Phòng trống' : language === 'ja' ? '空室' : 'Vacant', value: branchStats.vacant, color: '#64748b' },
                        { label: language === 'vi' ? 'Có khách' : language === 'ja' ? '滞在' : 'Occupied', value: branchStats.occupied, color: '#3b82f6' },
                      ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: item.color, display: 'inline-block' }} />
                            <span style={{ opacity: item.value > 0 ? 1 : 0.6, fontWeight: item.value > 0 ? 600 : 400 }}>{item.label}</span>
                          </div>
                          <span style={{ fontWeight: 700, opacity: item.value > 0 ? 1 : 0.4 }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Hourly Trend Bar Chart */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                    {statsTimeRange === 'today'
                      ? (language === 'vi' ? 'Lượng Hoàn Thành Theo Giờ' : language === 'ja' ? '時間帯別清掃完了数' : 'Hourly Completion Trend')
                      : statsTimeRange === 'week' || statsTimeRange === 'month'
                        ? (language === 'vi' ? 'Lượng Hoàn Thành Theo Ngày' : language === 'ja' ? '日別清掃完了数' : 'Daily Completion Trend')
                        : (language === 'vi' ? 'Lượng Hoàn Thành Theo Tháng' : language === 'ja' ? '月別清掃完了数' : 'Monthly Completion Trend')
                    }
                  </h4>
                  
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(() => {
                      const maxCount = Math.max(...branchStats.hourlyTrend.map(t => t.total), 4);
                      const width = 380;
                      const height = 180;
                      const paddingLeft = 25;
                      const paddingBottom = 25;
                      const paddingTop = 20;
                      const paddingRight = 10;
                      
                      const usableWidth = width - paddingLeft - paddingRight;
                      const usableHeight = height - paddingTop - paddingBottom;
                      
                      const colWidth = usableWidth / branchStats.hourlyTrend.length;
                      const barWidth = Math.max(4, colWidth - 6);

                      return (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                            {/* Y-axis helper lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                              const val = Math.round(maxCount * ratio);
                              const y = height - paddingBottom - (ratio * usableHeight);
                              return (
                                <g key={idx} opacity={0.15}>
                                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                                  <text x={paddingLeft - 5} y={y + 3} textAnchor="end" fill="currentColor" style={{ fontSize: '0.6rem', fontWeight: 600 }}>{val}</text>
                                </g>
                              );
                            })}
                            
                            {/* Bars and labels */}
                            {branchStats.hourlyTrend.map((t, i) => {
                              const outHeight = (t.out / maxCount) * usableHeight;
                              const stayHeight = (t.stay / maxCount) * usableHeight;
                              const dndHeight = (t.dnd / maxCount) * usableHeight;
                              
                              const x = paddingLeft + i * colWidth + (colWidth - barWidth) / 2;
                              
                              const outY = height - paddingBottom - outHeight;
                              const stayY = outY - stayHeight;
                              const dndY = stayY - dndHeight;

                              const showLabelText = branchStats.hourlyTrend.length <= 12 || i % 5 === 0 || i === branchStats.hourlyTrend.length - 1;

                              return (
                                <g key={i}>
                                  {/* Out bar (Red) */}
                                  {t.out > 0 && (
                                    <rect
                                      x={x}
                                      y={outY}
                                      width={barWidth}
                                      height={outHeight}
                                      rx="1"
                                      fill="#ef4444"
                                      opacity={0.85}
                                      style={{ transition: 'all 0.5s ease' }}
                                    />
                                  )}
                                  
                                  {/* Stay bar (Purple) */}
                                  {t.stay > 0 && (
                                    <rect
                                      x={x}
                                      y={stayY}
                                      width={barWidth}
                                      height={stayHeight}
                                      rx="1"
                                      fill="#8b5cf6"
                                      opacity={0.85}
                                      style={{ transition: 'all 0.5s ease' }}
                                    />
                                  )}
                                  
                                  {/* DND bar (Slate/DND) */}
                                  {t.dnd > 0 && (
                                    <rect
                                      x={x}
                                      y={dndY}
                                      width={barWidth}
                                      height={dndHeight}
                                      rx="1"
                                      fill="#475569"
                                      opacity={0.85}
                                      style={{ transition: 'all 0.5s ease' }}
                                    />
                                  )}
                                  
                                  {/* Label text */}
                                  {showLabelText && (
                                    <text
                                      x={x + barWidth / 2}
                                      y={height - 8}
                                      textAnchor="middle"
                                      fill="currentColor"
                                      style={{ fontSize: '0.55rem', opacity: 0.7, fontWeight: 600 }}
                                    >
                                      {statsTimeRange === 'today' ? t.label.split(':')[0] : t.label}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                          
                          {/* Legend */}
                          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.7rem', fontWeight: 700, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                              <span>{language === 'vi' ? 'Phòng Out' : language === 'ja' ? 'チェックアウト' : 'Out Rooms'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block' }} />
                              <span>{language === 'vi' ? 'Phòng Stay' : language === 'ja' ? '滞在清掃' : 'Stay Rooms'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#475569', display: 'inline-block' }} />
                              <span>{language === 'vi' ? 'Phòng DND' : language === 'ja' ? '起こさないで' : 'DND Rooms'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Housekeeper Leaderboard */}
                <div className="glass-panel grid-span-2" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                      {statsTimeRange === 'today' 
                        ? (language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Hôm nay)' : language === 'ja' ? 'スタッフ清掃実績ランキング (本日)' : 'Housekeeper Leaderboard (Today)')
                        : statsTimeRange === 'week'
                          ? (language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Tuần này)' : language === 'ja' ? 'スタッフ清掃実績ランキング (今週)' : 'Housekeeper Leaderboard (This Week)')
                          : statsTimeRange === 'month'
                            ? (language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Tháng này)' : language === 'ja' ? 'スタッフ清掃実績ランキング (今月)' : 'Housekeeper Leaderboard (This Month)')
                            : (language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Năm nay)' : language === 'ja' ? 'スタッフ清掃実績ランキング (今年)' : 'Housekeeper Leaderboard (This Year)')}
                    </h4>
                  </div>

                  {/* Leaderboard Toolbar */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1, padding: '0.35rem 0.75rem', fontSize: '0.8rem', minWidth: '180px' }}
                      placeholder={language === 'vi' ? 'Tìm nhanh nhân viên...' : language === 'ja' ? 'スタッフ名検索...' : 'Search housekeeper...'}
                      value={leaderboardSearchTerm}
                      onChange={e => setLeaderboardSearchTerm(e.target.value)}
                    />
                    
                    <div className="capsule-switcher" style={{ display: 'inline-flex' }}>
                      <button
                        type="button"
                        onClick={() => setLeaderboardSortBy('count')}
                        className={`capsule-button ${leaderboardSortBy === 'count' ? 'active' : ''}`}
                      >
                        <span>{language === 'vi' ? '🧹 Số phòng' : language === 'ja' ? '🧹 室数' : '🧹 Rooms'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardSortBy('time')}
                        className={`capsule-button ${leaderboardSortBy === 'time' ? 'active' : ''}`}
                      >
                        <span>{language === 'vi' ? '⏱️ T.gian TB' : language === 'ja' ? '⏱️ 平均時間' : '⏱️ Avg Time'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30px' }}
                      onClick={() => setLeaderboardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      title={language === 'vi' ? 'Đảo chiều sắp xếp' : 'Toggle Sort Order'}
                    >
                      {leaderboardSortOrder === 'asc' ? '▲' : '▼'}
                    </button>

                    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                      <span>{language === 'vi' ? 'Hiển thị:' : language === 'ja' ? '表示:' : 'Show:'}</span>
                      <select
                        value={leaderboardPerPage}
                        onChange={(e) => setLeaderboardPerPage(Number(e.target.value))}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(0,0,0,0.15)',
                          backgroundColor: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          height: '30px'
                        }}
                      >
                        <option value={6}>6</option>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={0}>{language === 'vi' ? 'Tất cả' : language === 'ja' ? 'すべて' : 'All'}</option>
                      </select>
                    </div>
                  </div>
                  
                  {sortedLeaderboard.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                      🧹 {statsTimeRange === 'today'
                        ? (language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong ngày hôm nay' : language === 'ja' ? '本日のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch today')
                        : statsTimeRange === 'week'
                          ? (language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong tuần này' : language === 'ja' ? '今週のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch this week')
                          : statsTimeRange === 'month'
                            ? (language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong tháng này' : language === 'ja' ? '今月のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch this month')
                            : (language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong năm nay' : language === 'ja' ? '今年のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch this year')}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        {paginatedLeaderboard.map((cleaner, index) => {
                          const maxRooms = Math.max(...sortedLeaderboard.map(c => c.count), 1);
                          const percent = (cleaner.count / maxRooms) * 100;
                          const overallIndex = leaderboardPerPage === 0 ? index : (leaderboardPage - 1) * leaderboardPerPage + index;
                          const rankMedal = overallIndex === 0 ? '🥇' : overallIndex === 1 ? '🥈' : overallIndex === 2 ? '🥉' : `${overallIndex + 1}`;
                          
                          return (
                            <div 
                              key={overallIndex} 
                              className="glass-panel" 
                              style={{ 
                                padding: '1rem', 
                                backgroundColor: 'var(--panel-bg-medium)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '1rem',
                                borderLeft: overallIndex < 3 ? `4px solid ${overallIndex === 0 ? '#fbbf24' : overallIndex === 1 ? '#94a3b8' : '#b45309'}` : '1px solid rgba(0,0,0,0.05)'
                              }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--panel-bg-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800 }}>
                                {rankMedal}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 700, alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span>{cleaner.name}</span>
                                    <span style={{
                                      fontSize: '0.65rem',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '99px',
                                      fontWeight: 700,
                                      color: 'white',
                                      backgroundColor: cleaner.speedCategory === 'fast'
                                        ? 'var(--status-clean)'
                                        : cleaner.speedCategory === 'slow'
                                          ? '#f97316'
                                          : 'var(--primary-color)'
                                    }}>
                                      {cleaner.speedCategory === 'fast' 
                                        ? (language === 'vi' ? '⚡ Nhanh' : language === 'ja' ? '⚡ 早い' : '⚡ Fast')
                                        : cleaner.speedCategory === 'slow'
                                          ? (language === 'vi' ? '🐢 Chậm' : language === 'ja' ? '🐢 遅い' : '🐢 Slow')
                                          : (language === 'vi' ? '⏱️ T.Bình' : language === 'ja' ? '⏱️ 普通' : '⏱️ Normal')}
                                    </span>
                                  </div>
                                  <span style={{ color: leaderboardSortBy === 'count' ? 'var(--primary-color)' : 'inherit', fontWeight: leaderboardSortBy === 'count' ? 700 : 500 }}>{cleaner.count} {language === 'vi' ? 'phòng' : language === 'ja' ? '室' : 'rooms'}</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.4rem' }}>
                                  <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--primary-color)' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', opacity: 0.8, fontWeight: 500 }}>
                                  <span style={{ color: leaderboardSortBy === 'time' ? 'var(--primary-color)' : 'inherit', fontWeight: leaderboardSortBy === 'time' ? 700 : 500 }}>⏱️ Avg: {cleaner.avgTime} {language === 'vi' ? 'phút / phòng' : language === 'ja' ? '分 / 室' : 'mins / room'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {totalLeaderboardPages > 1 && (
                        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                            {language === 'vi'
                              ? `Đang hiển thị ${(leaderboardPage - 1) * leaderboardPerPage + 1}-${Math.min(leaderboardPage * leaderboardPerPage, sortedLeaderboard.length)} trong số ${sortedLeaderboard.length} nhân viên`
                              : language === 'ja'
                                ? `${sortedLeaderboard.length}人中 ${(leaderboardPage - 1) * leaderboardPerPage + 1}-${Math.min(leaderboardPage * leaderboardPerPage, sortedLeaderboard.length)}人表示`
                                : `Showing ${(leaderboardPage - 1) * leaderboardPerPage + 1}-${Math.min(leaderboardPage * leaderboardPerPage, sortedLeaderboard.length)} of ${sortedLeaderboard.length} housekeepers`}
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setLeaderboardPage(prev => Math.max(prev - 1, 1))}
                              disabled={leaderboardPage === 1}
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              <ChevronLeft size={14} />
                            </button>
                            {getVisiblePages(leaderboardPage, totalLeaderboardPages).map((page, idx) => {
                              if (page === '...') {
                                return <span key={`dots-${idx}`} style={{ padding: '0 0.25rem', opacity: 0.5 }}>...</span>;
                              }
                              return (
                                <button
                                  key={page}
                                  type="button"
                                  className={`btn btn-sm ${leaderboardPage === page ? 'btn-primary' : 'btn-secondary'}`}
                                  onClick={() => setLeaderboardPage(page as number)}
                                  style={{ minWidth: '28px', padding: '0.25rem 0.5rem', fontWeight: leaderboardPage === page ? 'bold' : 'normal' }}
                                >
                                  {page}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setLeaderboardPage(prev => Math.min(prev + 1, totalLeaderboardPages))}
                              disabled={leaderboardPage === totalLeaderboardPages}
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Housekeeper Speed Comparison SVG Chart */}
                      <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1.5rem' }}>
                        <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-color)' }}>
                          📊 {language === 'vi' ? 'Biểu Đồ So Sánh Tốc Độ Dọn Dẹp (Thời gian trung bình)' : language === 'ja' ? 'スタッフ清掃速度比較グラフ (平均時間)' : 'Housekeeper Speed Comparison Chart (Avg Duration)'}
                        </h5>
                        
                        <div style={{ backgroundColor: 'var(--panel-bg-medium)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                          {(() => {
                            const maxAvgTime = Math.max(...sortedLeaderboard.map(c => c.avgTime), 50);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {paginatedLeaderboard.map((cleaner, i) => {
                                  const barPercent = (cleaner.avgTime / maxAvgTime) * 100;
                                  const barColor = cleaner.speedCategory === 'fast' 
                                    ? 'var(--status-clean)' 
                                    : cleaner.speedCategory === 'slow' 
                                      ? '#f97316' 
                                      : 'var(--primary-color)';
                                      
                                  return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                                      <div style={{ width: '120px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                        {cleaner.name}
                                      </div>
                                      <div style={{ flex: 1, height: '18px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                        <div style={{ width: `${barPercent}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.5s ease-in-out', borderRadius: '4px' }} />
                                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', fontWeight: 700, color: cleaner.avgTime > (maxAvgTime * 0.2) ? 'white' : 'var(--text-color)' }}>
                                          {cleaner.avgTime} {language === 'vi' ? 'phút' : language === 'ja' ? '分' : 'mins'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Defects Analytics Panel */}
                <div className="glass-panel grid-span-2" style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                    ⚠️ {statsTimeRange === 'today'
                      ? (language === 'vi' ? 'Thống Kê Lỗi Dọn Dẹp (Hôm nay)' : language === 'ja' ? '清掃不備インスペクション統計 (本日)' : 'Cleaning Defects Inspection Stats (Today)')
                      : statsTimeRange === 'week'
                        ? (language === 'vi' ? 'Thống Kê Lỗi Dọn Dẹp (Tuần này)' : language === 'ja' ? '清掃不備インスペクション統計 (今週)' : 'Cleaning Defects Inspection Stats (This Week)')
                        : statsTimeRange === 'month'
                          ? (language === 'vi' ? 'Thống Kê Lỗi Dọn Dẹp (Tháng này)' : language === 'ja' ? '清掃不備インスペクション統計 (今月)' : 'Cleaning Defects Inspection Stats (This Month)')
                          : (language === 'vi' ? 'Thống Kê Lỗi Dọn Dẹp (Năm nay)' : language === 'ja' ? '清掃不備インスペクション統計 (今年)' : 'Cleaning Defects Inspection Stats (This Year)')}
                  </h4>

                  {branchStats.totalErrors === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                      ✨ {statsTimeRange === 'today'
                        ? (language === 'vi' ? 'Không phát hiện lỗi dọn dẹp nào trong ngày hôm nay!' : language === 'ja' ? '本日は清掃不備の指摘はありません！' : 'No cleaning defects reported today!')
                        : statsTimeRange === 'week'
                          ? (language === 'vi' ? 'Không phát hiện lỗi dọn dẹp nào trong tuần này!' : language === 'ja' ? '今週は清掃不備の指摘はありません！' : 'No cleaning defects reported this week!')
                          : statsTimeRange === 'month'
                            ? (language === 'vi' ? 'Không phát hiện lỗi dọn dẹp nào trong tháng này!' : language === 'ja' ? '今月は清掃不備の指摘はありません！' : 'No cleaning defects reported this month!')
                            : (language === 'vi' ? 'Không phát hiện lỗi dọn dẹp nào trong năm nay!' : language === 'ja' ? '今年は清掃不備の指摘はありません！' : 'No cleaning defects reported this year!')}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                      {/* KPI cards and housekeeper breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderLeft: '4px solid var(--status-maintenance)' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 600 }}>
                              {language === 'vi' ? 'Tổng số lỗi' : language === 'ja' ? '指摘総数' : 'Total Defects'}
                            </div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--status-maintenance)' }}>
                              {branchStats.totalErrors}
                            </div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'rgba(251, 191, 36, 0.05)', borderLeft: '4px solid #fbbf24' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 600 }}>
                              {language === 'vi' ? 'Tỷ lệ lỗi phòng' : language === 'ja' ? '部屋指摘率' : 'Defect Rate'}
                            </div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b45309' }}>
                              {branchStats.defectRate}%
                            </div>
                          </div>
                        </div>

                        {/* Housekeeper Error List */}
                        <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'var(--panel-bg-medium)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
                              👤 {language === 'vi' ? 'Chi tiết lỗi theo nhân viên:' : language === 'ja' ? 'スタッフ別指摘詳細:' : 'Defects by Housekeeper:'}
                            </h5>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: 600 }}>
                              <select
                                value={defectSortField}
                                onChange={(e) => setDefectSortField(e.target.value as any)}
                                style={{
                                  padding: '0.15rem 0.35rem',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(0,0,0,0.15)',
                                  backgroundColor: 'white',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="count">{language === 'vi' ? 'Số lỗi' : language === 'ja' ? '指摘数' : 'Defects'}</option>
                                <option value="name">{language === 'vi' ? 'Tên NV' : language === 'ja' ? '氏名' : 'Name'}</option>
                              </select>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setDefectSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '22px' }}
                              >
                                {defectSortOrder === 'asc' ? '▲' : '▼'}
                              </button>
                              <span>{language === 'vi' ? 'Hiển thị:' : language === 'ja' ? '表示:' : 'Show:'}</span>
                              <select
                                value={defectPerPage}
                                onChange={(e) => setDefectPerPage(Number(e.target.value))}
                                style={{
                                  padding: '0.15rem 0.35rem',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(0,0,0,0.15)',
                                  backgroundColor: 'white',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={0}>{language === 'vi' ? 'Tất cả' : language === 'ja' ? 'すべて' : 'All'}</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: defectPerPage === 0 ? '250px' : 'none', overflowY: defectPerPage === 0 ? 'auto' : 'visible' }}>
                            {paginatedCleanerErrorLeaderboard.map((cleaner, i) => (
                              <div key={i} style={{ fontSize: '0.8rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '0.25rem' }}>
                                  <span>{cleaner.name}</span>
                                  <span style={{ color: 'var(--status-maintenance)' }}>{cleaner.count} {language === 'vi' ? 'lỗi' : language === 'ja' ? '不備' : 'errors'}</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  {cleaner.errorList.map((err, idx) => (
                                    <span key={idx} className="badge badge-dirty" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-maintenance)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                      {err}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          {totalDefectPages > 1 && (
                            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem' }}>
                              <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                {language === 'vi'
                                  ? `${(defectPage - 1) * defectPerPage + 1}-${Math.min(defectPage * defectPerPage, branchStats.cleanerErrorLeaderboard.length)} / ${branchStats.cleanerErrorLeaderboard.length}`
                                  : language === 'ja'
                                    ? `${branchStats.cleanerErrorLeaderboard.length}人ch ${(defectPage - 1) * defectPerPage + 1}-${Math.min(defectPage * defectPerPage, branchStats.cleanerErrorLeaderboard.length)}人`
                                    : `${(defectPage - 1) * defectPerPage + 1}-${Math.min(defectPage * defectPerPage, branchStats.cleanerErrorLeaderboard.length)} of ${branchStats.cleanerErrorLeaderboard.length}`}
                              </div>
                              <div style={{ display: 'flex', gap: '0.2px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setDefectPage(prev => Math.max(prev - 1, 1))}
                                  disabled={defectPage === 1}
                                  style={{ padding: '0.15rem 0.35rem', lineHeight: 1 }}
                                >
                                  <ChevronLeft size={10} />
                                </button>
                                {getVisiblePages(defectPage, totalDefectPages).map((page, idx) => {
                                  if (page === '...') {
                                    return <span key={`dots-def-${idx}`} style={{ padding: '0 0.1rem', opacity: 0.5, fontSize: '0.7rem' }}>...</span>;
                                  }
                                  return (
                                    <button
                                      key={page}
                                      type="button"
                                      className={`btn ${defectPage === page ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                      onClick={() => setDefectPage(page as number)}
                                      style={{ minWidth: '20px', padding: '0.15rem 0.35rem', fontSize: '0.7rem', lineHeight: 1, fontWeight: defectPage === page ? 'bold' : 'normal' }}
                                    >
                                      {page}
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setDefectPage(prev => Math.min(prev + 1, totalDefectPages))}
                                  disabled={defectPage === totalDefectPages}
                                  style={{ padding: '0.15rem 0.35rem', lineHeight: 1 }}
                                >
                                  <ChevronRight size={10} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Error frequency horizontal bar chart */}
                      <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'var(--panel-bg-medium)' }}>
                        <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                          📊 {language === 'vi' ? 'Tần suất các loại lỗi:' : language === 'ja' ? '指摘項目別頻度:' : 'Defect Frequencies:'}
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {(() => {
                            const maxErrorCount = Math.max(...branchStats.errorBreakdown.map(e => e.count), 1);
                            return branchStats.errorBreakdown.map((item, i) => {
                              const widthPct = (item.count / maxErrorCount) * 100;
                              return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                    <span>{item.type}</span>
                                    <span>{item.count}</span>
                                  </div>
                                  <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${widthPct}%`, height: '100%', backgroundColor: 'var(--status-maintenance)', borderRadius: '4px' }} />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {activeTab === 'grid' && (
            <>


              {/* Filters Panel */}
              <div className="dashboard-filter-panel glass-panel" style={{ marginBottom: '2rem' }}>
                <div className="filter-search-wrapper" style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder={getTranslation(language, 'searchRoomPlaceholder')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', opacity: 0.4 }} />
                </div>

                {/* Floor Filter */}
                <div className="filter-item-wrapper floor-filter">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {language === 'vi' ? (
                      <>
                        <span className="desktop-only-inline">Theo </span>tầng
                      </>
                    ) : getTranslation(language, 'filterFloor')}:
                  </label>
                  <select 
                    className="form-input" 
                    style={{ width: '110px', padding: '0.4rem 0.75rem' }}
                    value={floorFilter}
                    onChange={e => setFloorFilter(e.target.value)}
                  >
                    <option value="all">{getTranslation(language, 'all')}</option>
                    {floors.map(floor => (
                      <option key={floor} value={floor}>{floor}F</option>
                    ))}
                  </select>
                </div>

                {/* Checked Status Filter */}
                <div className="filter-item-wrapper status-filter">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {language === 'vi' ? (
                      <>
                        <span className="desktop-only-inline">Trạng thái </span>check
                      </>
                    ) : (language === 'ja' ? '検査別' : 'Check Status')}:
                  </label>
                  <select 
                    className="form-input" 
                    style={{ width: '160px', padding: '0.4rem 0.75rem' }}
                    value={checkFilter}
                    onChange={e => setCheckFilter(e.target.value as 'all' | 'pending' | 'approved')}
                  >
                    <option value="all">{language === 'vi' ? 'Tất cả phòng dọn' : language === 'ja' ? 'すべての清掃済部屋' : 'All Cleaned Rooms'}</option>
                    <option value="pending">{language === 'vi' ? 'Chờ duyệt 🔍' : language === 'ja' ? '要検査 (未承認) 🔍' : 'Pending Check 🔍'}</option>
                    <option value="approved">{language === 'vi' ? 'Đã duyệt ✓' : language === 'ja' ? '合格 (承認済) ✓' : 'Checked & Ready ✓'}</option>
                  </select>
                </div>

                {/* Grid Columns Filter */}
                <div className="filter-item-wrapper columns-filter">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {language === 'vi' ? (
                      <>
                        <span className="desktop-only-inline">Số </span>cột
                      </>
                    ) : (language === 'ja' ? 'グリッド列' : 'Columns')}:
                  </label>
                  <select 
                    className="form-input" 
                    style={{ width: '100px', padding: '0.4rem 0.75rem' }}
                    value={gridColumns}
                    onChange={e => setGridColumns(e.target.value)}
                  >
                    <option value="auto">{language === 'vi' ? 'Tự động' : language === 'ja' ? '自動' : 'Auto'}</option>
                    <option value="4">4</option>
                    <option value="6">6</option>
                    <option value="8">8</option>
                    <option value="10">10</option>
                    <option value="12">12</option>
                    <option value="16">16</option>
                  </select>
                </div>

                {/* Mode Selector */}
                {!isEditDisabled && (
                  <div className="filter-item-wrapper mode-selector">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'vi' ? 'Chế độ:' : language === 'ja' ? 'モード:' : 'Mode:'}</label>
                    <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => setGridMode('work')}
                        style={{
                          padding: '0.4rem 0.75rem',
                          border: 'none',
                          backgroundColor: gridMode === 'work' ? 'var(--primary-color)' : 'transparent',
                          color: gridMode === 'work' ? '#ffffff' : 'inherit',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        💼 {language === 'vi' ? 'Làm việc' : language === 'ja' ? '通常業務' : 'Work'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGridMode('setup')}
                        style={{
                          padding: '0.4rem 0.75rem',
                          border: 'none',
                          backgroundColor: gridMode === 'setup' ? 'var(--primary-color)' : 'transparent',
                          color: gridMode === 'setup' ? '#ffffff' : 'inherit',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        ⚙️ {language === 'vi' ? 'Cài đặt' : language === 'ja' ? '客室設定' : 'Setup'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Full Screen Carousel View trigger */}
                <div className="filter-item-wrapper full-screen-btn">
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4rem 0.75rem',
                      borderColor: 'var(--primary-color)',
                      color: 'var(--primary-color)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    onClick={() => {
                      const initialFloor = floorFilter !== 'all' ? Number(floorFilter) : carouselSortedFloors[0] || 0;
                      const idx = carouselSortedFloors.indexOf(initialFloor);
                      setActiveFloorIndex(idx !== -1 ? idx : 0);
                      setIsFullScreenFloorView(true);
                    }}
                    disabled={carouselSortedFloors.length === 0}
                  >
                    <Maximize2 size={14} />
                    <span>{language === 'vi' ? 'Xem full tầng' : language === 'ja' ? '全画面表示' : 'Full Screen'}</span>
                  </button>
                </div>
              </div>

            {/* Chú thích màu sắc phòng cho nhân viên (Color Legend) */}
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowLegend(!showLegend)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-color)' }}>
                  <span>💡</span>
                  <span>{language === 'vi' ? 'Hướng dẫn màu sắc phòng cho nhân viên' : language === 'ja' ? '客室カラー表示の説明' : 'Room Color Guide for Staff'}</span>
                </div>
                <button type="button" className="btn btn-outline" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                  {showLegend ? (language === 'vi' ? 'Ẩn' : language === 'ja' ? '閉じる' : 'Hide') : (language === 'vi' ? 'Xem' : language === 'ja' ? '表示' : 'Show')}
                </button>
              </div>
              
              {showLegend && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                  gap: '0.75rem', 
                  marginTop: '1rem', 
                  borderTop: '1px solid rgba(0,0,0,0.06)', 
                  paddingTop: '0.75rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.18)', backgroundColor: '#ffffff' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng trống (Trắng)' : language === 'ja' ? '空室 (白)' : 'Vacant (White)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#334155', border: '1px solid #1e293b' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Sửa chữa (Đen nhạt)' : language === 'ja' ? '故障・修繕中 (薄黒)' : 'Maintenance (Charcoal)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#22c55e', border: '1px solid #16a34a' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng ECO chưa check (Xanh lá)' : language === 'ja' ? 'ECO未検査 (緑)' : 'ECO Unchecked (Green)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #22c55e 50%, #38bdf8 50%)', border: '1px solid #38bdf8' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng ECO đã check (Xanh lá / Xanh nước biển)' : language === 'ja' ? 'ECO検査済 (緑 / 水色)' : 'ECO Checked (Green / Sky Blue)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#ef4444', border: '1px solid #dc2626' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng OUT chưa dọn (Đỏ)' : language === 'ja' ? 'OUT未清掃 (赤)' : 'OUT Dirty (Red)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #ef4444 50%, #22c55e 50%)', border: '1px solid #22c55e' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng OUT dọn xong (Đỏ / Xanh lá)' : language === 'ja' ? 'OUT清掃完了 (赤 / 緑)' : 'OUT Cleaned (Red / Green)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #ef4444 33.33%, #22c55e 33.33% 66.66%, #38bdf8 66.66%)', border: '1px solid #38bdf8' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng OUT đã check (Đỏ / Xanh lá / Xanh nước biển)' : language === 'ja' ? 'OUT検査済 (赤 / 緑 / 水色)' : 'OUT Checked (Red / Green / Sky Blue)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#8b5cf6', border: '1px solid #7c3aed' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng STAY chưa dọn (Tím)' : language === 'ja' ? 'STAY未清掃 (紫)' : 'STAY Dirty (Purple)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #8b5cf6 50%, #22c55e 50%)', border: '1px solid #22c55e' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng STAY/DD dọn xong (Tím / Xanh lá)' : language === 'ja' ? 'STAY/DD清掃完了 (紫 / 緑)' : 'STAY/DD Cleaned (Purple / Green)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #8b5cf6 33.33%, #22c55e 33.33% 66.66%, #38bdf8 66.66%)', border: '1px solid #38bdf8' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Phòng STAY/DD đã check (Tím / Xanh lá / Xanh nước biển)' : language === 'ja' ? 'STAY/DD検査済 (紫 / 緑 / 水色)' : 'STAY/DD Checked (Purple / Green / Sky Blue)'}
                    </span>
                  </div>
                </div>
              )}
            </div>

              {/* Room Grid grouped by Floor */}
              {Object.keys(roomsByFloor).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', opacity: 0.6 }} className="glass-panel">
                  <p style={{ fontWeight: 600 }}>{getTranslation(language, 'noData')}</p>
                </div>
              ) : (
                Object.keys(roomsByFloor)
                  .sort((a: string, b: string) => Number(a) - Number(b))
                  .map(floorStr => {
                    const floorNum = Number(floorStr);
                    const floorRooms = roomsByFloor[floorNum];
                    return (
                      <div key={floorNum} className="floor-section">
                        <h3 className="floor-title">
                          <span>{language === 'vi' ? `Tầng ${floorNum}` : language === 'ja' ? `${floorNum}階` : `Floor ${floorNum}`}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.6 }}>
                            ({floorRooms.length} {getTranslation(language, 'room').toLowerCase()})
                          </span>
                        </h3>

                        <div 
                          className={`room-grid cols-${gridColumns}`}
                          style={gridColumns !== 'auto' ? {
                            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                            ['--room-card-min-height' as any]: Number(gridColumns) >= 12 ? '80px' : Number(gridColumns) >= 8 ? '95px' : '120px',
                            ['--room-card-padding' as any]: Number(gridColumns) >= 12 ? '0.5rem 0.4rem 0.4rem' : Number(gridColumns) >= 8 ? '0.8rem 0.6rem 0.5rem' : '1.25rem 1rem 0.75rem',
                            ['--room-number-font-size' as any]: Number(gridColumns) >= 12 ? '1.1rem' : Number(gridColumns) >= 8 ? '1.35rem' : '1.75rem',
                            ['--room-type-font-size' as any]: Number(gridColumns) >= 12 ? '0.55rem' : Number(gridColumns) >= 8 ? '0.65rem' : '0.75rem',
                            ['--room-guest-font-size' as any]: Number(gridColumns) >= 12 ? '0.5rem' : Number(gridColumns) >= 8 ? '0.6rem' : '0.7rem',
                            ['--room-assignee-font-size' as any]: Number(gridColumns) >= 12 ? '0.55rem' : Number(gridColumns) >= 8 ? '0.65rem' : '0.75rem',
                            ['--room-note-icon-size' as any]: Number(gridColumns) >= 12 ? '0.65rem' : Number(gridColumns) >= 8 ? '0.8rem' : '1rem',
                            
                            // Mobile responsive scaling variables
                            ['--room-card-min-height-mobile' as any]: Number(gridColumns) >= 16 ? '40px' : Number(gridColumns) >= 12 ? '50px' : Number(gridColumns) >= 10 ? '60px' : Number(gridColumns) >= 8 ? '70px' : Number(gridColumns) >= 6 ? '80px' : '90px',
                            ['--room-card-padding-mobile' as any]: Number(gridColumns) >= 12 ? '0.15rem 0.1rem' : Number(gridColumns) >= 8 ? '0.25rem 0.15rem' : Number(gridColumns) >= 6 ? '0.35rem 0.25rem' : '0.5rem 0.35rem',
                            ['--room-number-font-size-mobile' as any]: Number(gridColumns) >= 16 ? '0.5rem' : Number(gridColumns) >= 12 ? '0.6rem' : Number(gridColumns) >= 10 ? '0.7rem' : Number(gridColumns) >= 8 ? '0.8rem' : Number(gridColumns) >= 6 ? '0.95rem' : '1.1rem',
                            ['--room-type-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.35rem' : Number(gridColumns) >= 8 ? '0.45rem' : Number(gridColumns) >= 6 ? '0.5rem' : '0.55rem',
                            ['--room-guest-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.3rem' : Number(gridColumns) >= 8 ? '0.4rem' : Number(gridColumns) >= 6 ? '0.45rem' : '0.5rem',
                            ['--room-assignee-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.35rem' : Number(gridColumns) >= 8 ? '0.45rem' : Number(gridColumns) >= 6 ? '0.5rem' : '0.55rem',
                            ['--room-assignee-max-width-mobile' as any]: Number(gridColumns) >= 12 ? '20px' : Number(gridColumns) >= 8 ? '35px' : Number(gridColumns) >= 6 ? '45px' : '55px',
                            ['--room-note-icon-size-mobile' as any]: Number(gridColumns) >= 16 ? '0.45rem' : Number(gridColumns) >= 12 ? '0.5rem' : Number(gridColumns) >= 10 ? '0.6rem' : Number(gridColumns) >= 8 ? '0.7rem' : '0.8rem',
                          } : undefined}
                        >
                          {floorRooms
                            .sort((a: Room, b: Room) => a.roomNumber.localeCompare(b.roomNumber))
                            .map((room: Room) => {
                              const isClean = room.status === 'clean';
                              const isPending = isClean && !room.isChecked;
                              const isApproved = isClean && !!room.isChecked;
                              
                              let statusText = room.status.toUpperCase();
                              let cardClass = room.status;

                              if (isPending) {
                                statusText = language === 'vi' ? 'CHỜ DUYỆT 🔍' : language === 'ja' ? '要検査 🔍' : 'PENDING 🔍';
                              } else if (isApproved) {
                                statusText = language === 'vi' ? 'ĐÃ DUYỆT ✓' : language === 'ja' ? '合格 ✓' : 'APPROVED ✓';
                              }

                              const isCompact = gridColumns !== 'auto';

                              return (
                                <div 
                                  key={room.id} 
                                  className={`room-card ${cardClass} ${room.isStay ? 'stay' : ''} ${room.isChecked ? 'checked' : ''} ${isCompact ? 'compact' : ''}`}
                                  onClick={() => handleRoomCardClick(room)}
                                  style={{ 
                                    cursor: 'pointer',
                                    position: 'relative',
                                    border: isPending ? '2px dashed var(--status-dirty)' : undefined,
                                    animation: isPending ? 'pulseBorder 2s infinite' : undefined
                                  }}
                                  title={room.notes ? `Notes: ${room.notes}` : undefined}
                                >
                                  {isCompact ? (
                                    <div className="room-card-compact-wrapper">
                                      <div className="room-card-compact-row">
                                        <span className="room-card-compact-number">{room.roomNumber}</span>
                                      </div>
                                      <div className="room-card-compact-guests">
                                        <span className="room-card-compact-guests-icon">👤</span>
                                        <span className="room-card-compact-guests-count">{room.guestCount}</span>
                                        {room.notes && <span className="room-card-compact-note-icon" title={room.notes}>📝</span>}
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="stay-badge">{room.status === 'maintenance' ? 'Sửa' : room.status === 'vacant' ? 'Trống' : room.status === 'eco' ? 'ECO' : (room.status === 'dirty' || room.status === 'cleaning' || (room.isStay && room.status === 'occupied')) ? (room.isStay ? 'STAY' : 'OUT') : (room.status === 'dnd' || room.notes?.includes('Chỉ cần treo đồ')) ? 'DD' : room.isStay ? 'STAY' : 'OUT'}</span>
                                      <div>
                                        <div className="room-type-text">{room.type}</div>
                                        <div className="room-number" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          {room.roomNumber}
                                        </div>
                                      </div>

                                      <div className="room-info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                                        <span 
                                          className="room-status-text"
                                          style={{ fontSize: '0.65rem', fontWeight: 700, color: isApproved ? 'var(--status-clean)' : isPending ? 'var(--status-dirty)' : 'inherit' }}
                                        >
                                          {statusText}
                                        </span>
                                        {room.cleanerName && (
                                          <span className="room-assignee" title={room.cleanerName}>
                                            👤 {room.cleanerName.split(' ')[0]}
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })
              )}

              {/* Collapsible Stats Section */}
              <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginTop: '2rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setShowStats(!showStats)}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📊 {language === 'vi' ? 'Xem thống kê hôm nay' : language === 'ja' ? '本日の統計表示' : 'View Today\'s Stats'}
                  </span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    {showStats ? '▲' : '▼'}
                  </span>
                </div>

                {showStats && (
                  <div style={{ marginTop: '1.25rem' }}>
                    {/* Metrics Panels */}
                    <div className="metrics-grid" style={{ marginTop: '0.5rem' }}>
                      <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                        <div className="metric-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
                          <Hotel size={20} />
                        </div>
                        <div>
                          <div className="metric-value">{totalCleaned}</div>
                          <div className="metric-label">{language === 'vi' ? 'Đã dọn xong' : language === 'ja' ? '清掃完了数' : 'Total Cleaned'}</div>
                        </div>
                      </div>

                      <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-dirty)' }}>
                        <div className="metric-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-dirty)' }}>
                          <AlertTriangle size={20} style={{ color: 'var(--status-dirty)' }} />
                        </div>
                        <div>
                          <div className="metric-value">{pendingCheck}</div>
                          <div className="metric-label">{language === 'vi' ? 'Chờ phê duyệt' : language === 'ja' ? '要検査待ち' : 'Pending Check'}</div>
                        </div>
                      </div>

                      <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-clean)' }}>
                        <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)' }}>
                          <CheckCircle2 size={20} style={{ color: 'var(--status-clean)' }} />
                        </div>
                        <div>
                          <div className="metric-value">{approvedCheck}</div>
                          <div className="metric-label">{language === 'vi' ? 'Đã phê duyệt' : language === 'ja' ? '検査合格済' : 'Checked & Ready'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Logs View */}
          {activeTab === 'logs' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>{getTranslation(language, 'cleaningSummary')}</h3>
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>{getTranslation(language, 'noData')}</div>
              ) : (
                <>
                  {/* Desktop view: Table */}
                  <div className="desktop-only-block" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                     <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'roomNumber')}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'cleanerName')}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Người duyệt' : language === 'ja' ? '検査者' : 'Checked By'}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Bắt đầu' : 'Start'}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Kết thúc' : 'Finish'}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Duration</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'notes')}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Photo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs
                          .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
                          .map(log => (
                             <tr key={log.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                              <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>
                                {log.roomNumber} <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6 }}>({log.floor}F)</span>
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{log.cleanerName}</td>
                              <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem' }}>
                                {log.checkedBy ? (
                                  <span style={{ fontWeight: 500 }}>
                                    {log.checkedBy}
                                    <span style={{ fontSize: '0.75rem', opacity: 0.6, display: 'block' }}>
                                      {new Date(log.checkedAt!).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                                    </span>
                                  </span>
                                ) : (
                                  <span style={{ opacity: 0.4 }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>
                                {new Date(log.startedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>
                                {new Date(log.endedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem' }}>
                                <span className="badge badge-clean" style={{ fontSize: '0.65rem' }}>{log.durationMinutes} mins</span>
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem' }}>
                                {log.notes && (
                                  <div style={{ marginBottom: '0.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>🧹 {language === 'vi' ? 'Ghi chú NV:' : language === 'ja' ? '清掃員メモ:' : 'Cleaner Notes:'}</span> {log.notes}
                                  </div>
                                )}
                                {log.checkerNotes && (
                                  <div style={{ marginBottom: '0.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.6, color: 'var(--status-maintenance)' }}>🔍 {language === 'vi' ? 'Người check:' : language === 'ja' ? '指摘メモ:' : 'Checker Notes:'}</span> {log.checkerNotes}
                                  </div>
                                )}
                                {log.errors && log.errors.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem', marginTop: '0.25rem' }}>
                                    {log.errors.map((e, idx) => (
                                      <span key={idx} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-maintenance)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '3px' }}>
                                        {translateDefect(e, language)}
                                      </span>
                                    ))}
                                  </div>
                                ) : log.checkedBy ? (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--status-clean)', fontWeight: 500, marginTop: '0.25rem' }}>
                                    ✓ {language === 'vi' ? 'Đạt 100%' : language === 'ja' ? '100%合格' : 'Passed 100%'}
                                  </div>
                                ) : null}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem' }}>
                                {log.photoAfter ? (
                                  <a href={log.photoAfter} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600 }}>
                                    {language === 'vi' ? 'Xem ảnh' : language === 'ja' ? '写真を見る' : 'View Photo'}
                                  </a>
                                ) : (
                                  <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>{language === 'vi' ? 'Không ảnh' : language === 'ja' ? '写真なし' : 'No Photo'}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile view: Cards/Boxes */}
                  <div className="mobile-only-block" style={{ width: '100%' }}>
                    {logs
                      .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
                      .map(log => (
                        <div key={log.id} className="glass-panel" style={{ padding: '1rem', marginBottom: '0.75rem', borderLeft: '4px solid var(--primary-color)', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Room {log.roomNumber} ({log.floor}F)</span>
                            <span className="badge badge-clean" style={{ fontSize: '0.65rem' }}>{log.durationMinutes} mins</span>
                          </div>
                          <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                            <strong>{getTranslation(language, 'cleanerName')}:</strong> {log.cleanerName}
                          </div>
                          {log.checkedBy && (
                            <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                              <strong>{language === 'vi' ? 'Người duyệt:' : language === 'ja' ? '検査者:' : 'Checked By:'}</strong> {log.checkedBy} <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>({new Date(log.checkedAt!).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })})</span>
                            </div>
                          )}
                          <div style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                            <span>🕒 {language === 'vi' ? 'Bắt đầu' : 'Start'}: {new Date(log.startedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            <span>⌛ {language === 'vi' ? 'Kết thúc' : 'Finish'}: {new Date(log.endedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                          {(log.notes || log.checkerNotes || (log.errors && log.errors.length > 0)) && (
                            <div style={{ fontSize: '0.8rem', backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.5rem', borderLeft: '3px solid var(--primary-color)' }}>
                              {log.notes && (
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>🧹 {language === 'vi' ? 'Ghi chú NV:' : language === 'ja' ? '清掃員メモ:' : 'Cleaner Notes:'}</strong> {log.notes}
                                </div>
                              )}
                              {log.checkerNotes && (
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>🔍 {language === 'vi' ? 'Ghi chú kiểm phòng:' : language === 'ja' ? '検査指摘メモ:' : 'Checker Notes:'}</strong> {log.checkerNotes}
                                </div>
                              )}
                              {log.errors && log.errors.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.35rem' }}>
                                  {log.errors.map((e, idx) => (
                                    <span key={idx} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-maintenance)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '3px' }}>
                                      ❌ {translateDefect(e, language)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div style={{ marginTop: '0.5rem' }}>
                            {log.photoAfter ? (
                              <a href={log.photoAfter} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', padding: '0.25rem 0.75rem', fontSize: '0.75rem', alignItems: 'center' }}>
                                🖼️ {language === 'vi' ? 'Xem ảnh' : language === 'ja' ? '写真を見る' : 'View Photo'}
                              </a>
                            ) : (
                              <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>🚫 {language === 'vi' ? 'Không có ảnh' : language === 'ja' ? '写真なし' : 'No Photo'}</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📅 {language === 'vi' ? `Phân công nhân sự ngày ${activeDate}` : language === 'ja' ? `${activeDate} の出勤スタッフ設定` : `Cleaners Assignment for ${activeDate}`}
                </h3>

                {/* View switcher sub-tabs */}
                <div className="capsule-switcher">
                  <button 
                    type="button"
                    onClick={() => setStaffViewMode('today')}
                    className={`capsule-button ${staffViewMode === 'today' ? 'active' : ''}`}
                  >
                    <span>📅</span>
                    <span>{language === 'vi' ? 'Nhân sự hôm nay' : language === 'ja' ? '本日のスタッフ' : 'Today\'s Staff'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setStaffViewMode('total')}
                    className={`capsule-button ${staffViewMode === 'total' ? 'active' : ''}`}
                  >
                    <span>👥</span>
                    <span>{language === 'vi' ? 'Tổng nhân sự' : language === 'ja' ? '総スタッフ' : 'Total Staff'}</span>
                  </button>
                </div>
              </div>
              
              {/* Search and Sort controls */}
              <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px', minWidth: '260px' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '2.25rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.85rem' }}
                    placeholder={language === 'vi' ? 'Tìm tên hoặc mã nhân viên...' : language === 'ja' ? 'スタッフ名・ID検索...' : 'Search staff name or ID...'}
                    value={dailyStaffSearchTerm}
                    onChange={(e) => setDailyStaffSearchTerm(e.target.value)}
                  />
                  <span style={{ position: 'absolute', left: '10px', top: '8px', opacity: 0.5, fontSize: '0.85rem' }}>🔍</span>
                  {dailyStaffSearchTerm && (
                    <button 
                      onClick={() => setDailyStaffSearchTerm('')}
                      style={{ position: 'absolute', right: '10px', top: '8px', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.5, fontSize: '0.85rem', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Sorting dropdown */}
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'vi' ? 'Sắp xếp:' : language === 'ja' ? '並び替え:' : 'Sort by:'}</label>
                  <select
                    className="form-input"
                    style={{ width: '130px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                    value={staffSortField}
                    onChange={(e) => setStaffSortField(e.target.value as any)}
                  >
                    <option value="name">{language === 'vi' ? 'Tên' : language === 'ja' ? '名前' : 'Name'}</option>
                    <option value="username">{language === 'vi' ? 'Mã NV' : language === 'ja' ? 'ID' : 'ID'}</option>
                    {staffViewMode === 'today' ? (
                      <option value="status">{language === 'vi' ? 'Trạng thái' : language === 'ja' ? '出勤状態' : 'Assignment'}</option>
                    ) : (
                      <option value="role">{language === 'vi' ? 'Vai trò' : language === 'ja' ? '役割' : 'Role'}</option>
                    )}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setStaffSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    aria-label="Toggle sort order"
                  >
                    {staffSortOrder === 'asc' ? '▲' : '▼'}
                  </button>

                  {/* Layout switcher */}
                  <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginLeft: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setStaffLayout('grid')}
                      style={{
                        padding: '0.4rem 0.6rem',
                        border: 'none',
                        backgroundColor: staffLayout === 'grid' ? 'var(--primary-color)' : 'transparent',
                        color: staffLayout === 'grid' ? '#ffffff' : 'inherit',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all var(--transition-fast)'
                      }}
                      title={language === 'vi' ? 'Dạng lưới' : language === 'ja' ? 'グリッド表示' : 'Grid view'}
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffLayout('list')}
                      style={{
                        padding: '0.4rem 0.6rem',
                        border: 'none',
                        backgroundColor: staffLayout === 'list' ? 'var(--primary-color)' : 'transparent',
                        color: staffLayout === 'list' ? '#ffffff' : 'inherit',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all var(--transition-fast)'
                      }}
                      title={language === 'vi' ? 'Dạng danh sách' : language === 'ja' ? 'リスト表示' : 'List view'}
                    >
                      <List size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {staffViewMode === 'today' ? (
                cleaners.length === 0 ? (
                  <p style={{ opacity: 0.6 }}>
                    {language === 'vi' ? 'Chưa có nhân viên dọn phòng nào được đăng ký trong hệ thống.' : language === 'ja' ? 'システムに出勤可能な清掃スタッフが登録されていません。' : 'No housekeeping staff registered in the system.'}
                  </p>
                ) : (
                  <>
                    {sortedTodayCleaners.length === 0 ? (
                      <p style={{ opacity: 0.6, fontStyle: 'italic', margin: '1rem 0' }}>
                        {language === 'vi' ? 'Không tìm thấy nhân viên phù hợp.' : language === 'ja' ? '一致するスタッフが見つかりません。' : 'No matching staff found.'}
                      </p>
                    ) : (
                      <>
                        <div style={staffLayout === 'grid' 
                          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }
                          : { display: 'flex', flexDirection: 'column', gap: '0.75rem' }
                        }>
                          {paginatedTodayCleaners.map(cleaner => {
                            const isActive = activeStaffIds.includes(cleaner.id);
                            const { activeRooms, todayLogs } = getCleanerActivity(cleaner.id);
                            return (
                              <div 
                                key={cleaner.id}
                                onClick={isEditDisabled ? undefined : () => handleStaffToggle(cleaner.id)}
                                style={staffLayout === 'grid' ? { 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0,0,0,0.02)',
                                  border: isActive ? '1px solid var(--status-clean)' : '1px solid rgba(0,0,0,0.05)',
                                  padding: '1rem',
                                  borderRadius: 'var(--radius-md)',
                                  cursor: isEditDisabled ? 'default' : 'pointer',
                                  opacity: isEditDisabled && !isActive ? 0.5 : 1,
                                  transition: 'all var(--transition-fast)',
                                  userSelect: 'none'
                                } : {
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0,0,0,0.02)',
                                  border: isActive ? '1px solid var(--status-clean)' : '1px solid rgba(0,0,0,0.05)',
                                  padding: '0.75rem 1.25rem',
                                  borderRadius: 'var(--radius-md)',
                                  cursor: isEditDisabled ? 'default' : 'pointer',
                                  opacity: isEditDisabled && !isActive ? 0.5 : 1,
                                  transition: 'all var(--transition-fast)',
                                  userSelect: 'none',
                                  width: '100%',
                                  flexWrap: 'wrap',
                                  gap: '1rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: staffLayout === 'grid' ? 'none' : '1', minWidth: staffLayout === 'grid' ? 'none' : '200px' }}>
                                  <span style={{ fontSize: '1.5rem' }}>👤</span>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{cleaner.name}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.1rem' }}>
                                      {language === 'vi' ? 'Mã NV' : language === 'ja' ? 'スタッフID' : 'ID'}: {cleaner.username}
                                    </div>
                                    {isActive && staffLayout === 'grid' && (
                                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                        {activeRooms.length > 0 && (
                                          <span style={{ color: 'var(--status-cleaning)', fontWeight: 600 }}>
                                            🧹 {language === 'vi' ? 'Đang dọn: ' : language === 'ja' ? '清掃中: ' : 'Cleaning: '}
                                            {activeRooms.map(r => r.roomNumber).join(', ')}
                                          </span>
                                        )}
                                        {todayLogs.length > 0 && (
                                          <span style={{ color: 'var(--status-clean)', fontWeight: 600 }}>
                                            ✓ {language === 'vi' ? `Đã dọn xong: ${todayLogs.length} phòng` : language === 'ja' ? `完了: ${todayLogs.length}部屋` : `Cleaned: ${todayLogs.length} rooms`}
                                            <span style={{ fontWeight: 400, opacity: 0.7, fontSize: '0.7rem', marginLeft: '0.25rem' }}>
                                              ({todayLogs.map(l => l.roomNumber).join(', ')})
                                            </span>
                                          </span>
                                        )}
                                        {activeRooms.length === 0 && todayLogs.length === 0 && (
                                          <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                                            💤 {language === 'vi' ? 'Đang sẵn sàng' : language === 'ja' ? '待機中' : 'Ready'}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {isActive && staffLayout === 'list' && (
                                  <div style={{ fontSize: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 2, minWidth: '240px', alignItems: 'center' }}>
                                    {activeRooms.length > 0 && (
                                      <span style={{ color: 'var(--status-cleaning)', fontWeight: 600, backgroundColor: 'rgba(249, 115, 22, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(249, 115, 22, 0.15)' }}>
                                        🧹 {language === 'vi' ? 'Đang dọn: ' : language === 'ja' ? '清掃中: ' : 'Cleaning: '}
                                        {activeRooms.map(r => r.roomNumber).join(', ')}
                                      </span>
                                    )}
                                    {todayLogs.length > 0 && (
                                      <span style={{ color: 'var(--status-clean)', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                        ✓ {language === 'vi' ? `Đã dọn xong: ${todayLogs.length} phòng` : language === 'ja' ? `完了: ${todayLogs.length}部屋` : `Cleaned: ${todayLogs.length} rooms`}
                                        <span style={{ fontWeight: 400, opacity: 0.7, fontSize: '0.7rem', marginLeft: '0.25rem' }}>
                                          ({todayLogs.map(l => l.roomNumber).join(', ')})
                                        </span>
                                      </span>
                                    )}
                                    {activeRooms.length === 0 && todayLogs.length === 0 && (
                                      <span style={{ color: '#64748b', fontStyle: 'italic', backgroundColor: 'rgba(100, 116, 139, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(100, 116, 139, 0.15)' }}>
                                        💤 {language === 'vi' ? 'Đang sẵn sàng' : language === 'ja' ? '待機中' : 'Ready'}
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                <div style={{ 
                                  width: '24px', 
                                  height: '24px', 
                                  borderRadius: '50%', 
                                  border: '2px solid',
                                  borderColor: isActive ? 'var(--status-clean)' : 'rgba(0,0,0,0.2)',
                                  backgroundColor: isActive ? 'var(--status-clean)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  transition: 'all var(--transition-fast)'
                                }}>
                                  {isActive && '✓'}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Pagination for Today Cleaners */}
                        {totalTodayPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                              {language === 'vi' 
                                ? `Hiển thị ${(staffPage - 1) * 12 + 1}-${Math.min(staffPage * 12, sortedTodayCleaners.length)} trên tổng số ${sortedTodayCleaners.length} nhân viên` 
                                : language === 'ja' 
                                  ? `${sortedTodayCleaners.length}人中 ${(staffPage - 1) * 12 + 1}-${Math.min(staffPage * 12, sortedTodayCleaners.length)}人表示` 
                                  : `Showing ${(staffPage - 1) * 12 + 1}-${Math.min(staffPage * 12, sortedTodayCleaners.length)} of ${sortedTodayCleaners.length} staff`}
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setStaffPage(prev => Math.max(prev - 1, 1))}
                                disabled={staffPage === 1}
                                style={{ minWidth: '40px' }}
                              >
                                &laquo;
                              </button>
                              {getVisiblePages(staffPage, totalTodayPages).map((page, index) => {
                                if (page === '...') {
                                  return (
                                    <span key={`ellipsis-${index}`} style={{ padding: '0.4rem 0.5rem', opacity: 0.5, fontSize: '0.85rem' }}>
                                      ...
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={page}
                                    type="button"
                                    className={`btn btn-sm ${staffPage === page ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setStaffPage(page as number)}
                                    style={{ minWidth: '32px', fontWeight: staffPage === page ? 'bold' : 'normal' }}
                                  >
                                    {page}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setStaffPage(prev => Math.min(prev + 1, totalTodayPages))}
                                disabled={staffPage === totalTodayPages}
                                style={{ minWidth: '40px' }}
                              >
                                &raquo;
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )
              ) : (
                allHotelUsers.length === 0 ? (
                  <p style={{ opacity: 0.6 }}>
                    {language === 'vi' ? 'Chưa có nhân viên nào được đăng ký cho khách sạn này.' : language === 'ja' ? 'このホテルにスタッフが登録されていません。' : 'No staff registered for this hotel.'}
                  </p>
                ) : (
                  <>
                    {sortedTotalUsers.length === 0 ? (
                      <p style={{ opacity: 0.6, fontStyle: 'italic', margin: '1rem 0' }}>
                        {language === 'vi' ? 'Không tìm thấy nhân viên phù hợp.' : language === 'ja' ? '一致するスタッフが見つかりません。' : 'No matching staff found.'}
                      </p>
                    ) : (
                      <>
                        <div style={staffLayout === 'grid' 
                          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }
                          : { display: 'flex', flexDirection: 'column', gap: '0.75rem' }
                        }>
                          {paginatedTotalUsers.map(user => {
                            let roleLabel = '';
                            let roleColor = '';
                            let roleBg = '';
                            if (user.role === 'admin') {
                              roleLabel = getTranslation(language, 'roleAdmin');
                              roleColor = '#ef4444';
                              roleBg = 'rgba(239, 68, 68, 0.08)';
                            } else if (user.role === 'front_desk') {
                              roleLabel = getTranslation(language, 'roleFrontDesk');
                              roleColor = '#3b82f6';
                              roleBg = 'rgba(59, 130, 246, 0.08)';
                            } else if (user.role === 'checka') {
                              roleLabel = getTranslation(language, 'roleChecker');
                              roleColor = '#8b5cf6';
                              roleBg = 'rgba(139, 92, 246, 0.08)';
                            } else if (user.role === 'kacho') {
                              roleLabel = getTranslation(language, 'roleKacho');
                              roleColor = '#f59e0b';
                              roleBg = 'rgba(245, 158, 11, 0.08)';
                            } else if (user.role === 'housekeeping') {
                              roleLabel = getTranslation(language, 'roleHousekeeping');
                              roleColor = '#10b981';
                              roleBg = 'rgba(16, 185, 129, 0.08)';
                            }

                            const isUserActiveToday = activeStaffIds.includes(user.id);

                            return (
                              <div 
                                key={user.id}
                                style={staffLayout === 'grid' ? { 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  backgroundColor: 'rgba(0,0,0,0.02)',
                                  border: '1px solid rgba(0,0,0,0.05)',
                                  padding: '1.25rem',
                                  borderRadius: 'var(--radius-md)',
                                  position: 'relative',
                                  transition: 'all var(--transition-fast)'
                                } : {
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  backgroundColor: 'rgba(0,0,0,0.02)',
                                  border: '1px solid rgba(0,0,0,0.05)',
                                  padding: '0.75rem 1.25rem',
                                  borderRadius: 'var(--radius-md)',
                                  position: 'relative',
                                  transition: 'all var(--transition-fast)',
                                  width: '100%',
                                  flexWrap: 'wrap',
                                  gap: '1rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: staffLayout === 'grid' ? '0.75rem' : '0', flex: staffLayout === 'grid' ? 'none' : '1', minWidth: staffLayout === 'grid' ? 'none' : '200px' }}>
                                  <span style={{ fontSize: staffLayout === 'grid' ? '1.75rem' : '1.5rem' }}>👤</span>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: staffLayout === 'grid' ? '1rem' : '0.95rem' }}>{user.name}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.1rem' }}>
                                      {language === 'vi' ? 'Mã NV' : language === 'ja' ? 'スタッフID' : 'ID'}: {user.username}
                                    </div>
                                  </div>
                                </div>
                                
                                <div style={staffLayout === 'grid' ? { 
                                  display: 'flex', 
                                  gap: '0.5rem', 
                                  flexWrap: 'wrap', 
                                  marginTop: 'auto' 
                                } : {
                                  display: 'flex', 
                                  gap: '0.5rem', 
                                  flexWrap: 'wrap', 
                                  alignItems: 'center', 
                                  flex: 2, 
                                  minWidth: '240px'
                                }}>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 600, 
                                    color: roleColor, 
                                    backgroundColor: roleBg,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    border: `1px solid ${roleColor}25`
                                  }}>
                                    {roleLabel}
                                  </span>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 600, 
                                    color: 'var(--status-clean)', 
                                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(16, 185, 129, 0.15)'
                                  }}>
                                    {language === 'vi' ? 'Đang làm việc' : language === 'ja' ? '在籍' : 'Active'}
                                  </span>
                                  {isUserActiveToday && (
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      fontWeight: 600, 
                                      color: 'var(--status-cleaning)', 
                                      backgroundColor: 'rgba(249, 115, 22, 0.08)',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(249, 115, 22, 0.15)'
                                    }}>
                                      ⚡ {language === 'vi' ? 'Làm hôm nay' : language === 'ja' ? '本日出勤' : 'Duty Today'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Pagination for Total Users */}
                        {totalTotalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                              {language === 'vi' 
                                ? `Hiển thị ${(staffPage - 1) * 12 + 1}-${Math.min(staffPage * 12, sortedTotalUsers.length)} trên tổng số ${sortedTotalUsers.length} nhân sự` 
                                : language === 'ja' 
                                  ? `${sortedTotalUsers.length}人中 ${(staffPage - 1) * 12 + 1}-${Math.min(staffPage * 12, sortedTotalUsers.length)}人表示` 
                                  : `Showing ${(staffPage - 1) * 12 + 1}-${Math.min(staffPage * 12, sortedTotalUsers.length)} of ${sortedTotalUsers.length} staff`}
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setStaffPage(prev => Math.max(prev - 1, 1))}
                                disabled={staffPage === 1}
                                style={{ minWidth: '40px' }}
                              >
                                &laquo;
                              </button>
                              {getVisiblePages(staffPage, totalTotalPages).map((page, index) => {
                                if (page === '...') {
                                  return (
                                    <span key={`ellipsis-${index}`} style={{ padding: '0.4rem 0.5rem', opacity: 0.5, fontSize: '0.85rem' }}>
                                      ...
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={page}
                                    type="button"
                                    className={`btn btn-sm ${staffPage === page ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setStaffPage(page as number)}
                                    style={{ minWidth: '32px', fontWeight: staffPage === page ? 'bold' : 'normal' }}
                                  >
                                    {page}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setStaffPage(prev => Math.min(prev + 1, totalTotalPages))}
                                disabled={staffPage === totalTotalPages}
                                style={{ minWidth: '40px' }}
                              >
                                &raquo;
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )
              )}

              <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                {language === 'vi' 
                  ? '* Lưu ý: Chỉ những nhân viên được chọn tại đây mới có thể đăng nhập để thao tác dọn phòng trong ngày này.' 
                  : language === 'ja'
                    ? '※ 注意: ここで選択されたスタッフのみが,指定した日付にログインして清掃作業を行えます。' 
                    : '* Note: Only cleaners selected here will be permitted to log in to perform tasks on this date.'}
              </p>
            </div>
          )}

        </main>
      </div>

      {/* Checker Inspection Modal */}
      {selectedRoom && gridMode === 'work' && (
        (selectedRoom.status === 'dirty' || selectedRoom.status === 'cleaning' || (selectedRoom.isStay && selectedRoom.status === 'occupied')) ? (
          /* Housekeeper-style clean reporting sheet */
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ maxWidth: '440px', position: 'relative' }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedRoom(null)}
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  padding: '0.25rem',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.05)',
                  color: 'var(--text-color)',
                  zIndex: 10
                }}
              >
                ✕
              </button>
              <h3 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, paddingRight: '2.5rem' }}>
                {getTranslation(language, 'cleaningSummary')} - Room {selectedRoom.roomNumber}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: 'var(--panel-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem', textAlign: 'left' }}>
                <div>
                  <strong>{language === 'vi' ? 'Kiểu phòng:' : language === 'ja' ? '部屋タイプ:' : 'Room Type:'}</strong> {getFormattedRoomType(selectedRoom.type)} - {selectedRoom.floor}F
                </div>
                <div>
                  <strong>{language === 'vi' ? 'Số khách dọn (Set):' : language === 'ja' ? '設定人数:' : 'Guests Count (Set):'}</strong> {selectedRoom.guestCount} {language === 'vi' ? 'người' : language === 'ja' ? '人' : 'Pax'}
                </div>
              </div>

              {selectedRoom.notes && (
                <div style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderLeft: '4px solid var(--status-maintenance)',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left'
                }}>
                  <div style={{ 
                    fontWeight: 700, 
                    color: 'var(--status-maintenance)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.25rem',
                    fontSize: '0.85rem',
                    marginBottom: '0.25rem'
                  }}>
                    <AlertTriangle size={14} className="animate-pulse" />
                    {language === 'vi' ? 'Ghi chú quan trọng:' : language === 'ja' ? '重要メモ:' : 'Important Note:'}
                  </div>
                  <p style={{ 
                    fontSize: '0.85rem', 
                    color: 'var(--status-maintenance)', 
                    fontWeight: 600,
                    margin: 0,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {selectedRoom.notes}
                  </p>
                </div>
              )}

              {selectedRoom.photoDefect && (
                <div style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left'
                }}>
                  <div style={{ 
                    fontWeight: 700, 
                    color: 'var(--status-maintenance)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.25rem',
                    fontSize: '0.85rem',
                    marginBottom: '0.5rem'
                  }}>
                    <AlertTriangle size={14} className="animate-pulse" />
                    {language === 'vi' ? 'Hình ảnh lỗi dọn dẹp:' : language === 'ja' ? '指摘された清掃不良画像:' : 'Defect Photo:'}
                  </div>
                  <img 
                    src={selectedRoom.photoDefect} 
                    alt="Defect" 
                    style={{
                      width: '100%',
                      maxHeight: '200px',
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(0,0,0,0.1)'
                    }} 
                  />
                </div>
              )}

              {/* Photo Capture Area */}
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">{getTranslation(language, 'uploadPhoto')}</label>
                
                <input
                  type="file"
                  id="camera-file-input-checker"
                  style={{ display: 'none' }}
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageFileChange}
                />
                
                <div className="camera-box" onClick={() => {
                  if (cleaningPhoto) {
                    setCleaningPhoto(null);
                    setShowSourceChoice(true);
                  } else {
                    setShowSourceChoice(true);
                  }
                }}>
                  {cameraActive ? (
                    <div style={{ textAlign: 'center' }}>
                      <div className="animate-spin" style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.85rem' }}>{getTranslation(language, 'loading')}</p>
                    </div>
                  ) : cleaningPhoto ? (
                    <>
                      <img src={cleaningPhoto} alt="Verification Preview" className="camera-preview" />
                      <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'var(--status-clean)', color: 'white', padding: '0.2rem', borderRadius: '50%', zIndex: 10 }}>
                        <Check size={14} />
                      </div>
                    </>
                  ) : showSourceChoice ? (
                    <div 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.5rem', 
                        width: '100%', 
                        padding: '0.75rem',
                        boxSizing: 'border-box' 
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.4rem' }}
                        onClick={triggerRealCamera}
                      >
                        <Camera size={16} />
                        <span style={{ fontSize: '0.85rem' }}>{getTranslation(language, 'takeRealPhoto')}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.4rem' }}
                        onClick={triggerCameraMock}
                      >
                        <Sparkles size={16} />
                        <span style={{ fontSize: '0.85rem' }}>{getTranslation(language, 'useDemoPhoto')}</span>
                      </button>
                      <button
                        type="button"
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--text-secondary)', 
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          marginTop: '0.1rem',
                          alignSelf: 'center'
                        }}
                        onClick={() => setShowSourceChoice(false)}
                      >
                        {getTranslation(language, 'cancel')}
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Camera size={32} style={{ marginBottom: '0.5rem', opacity: 0.6 }} />
                      <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getTranslation(language, 'takePhoto')}</p>
                      <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>({language === 'vi' ? 'Nhấp để chụp hoặc chọn ảnh mẫu' : 'クリックして撮影・デモ選択'})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes Textarea */}
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">{getTranslation(language, 'notes')}</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={cleaningNotes}
                  onChange={e => setCleaningNotes(e.target.value)}
                  placeholder={getTranslation(language, 'notesPlaceholder')}
                />
              </div>

              {/* Quick tag actions for notes */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCleaningNotes(prev => (prev ? prev + ', ' : '') + (language === 'ja' ? '忘れ物あり' : language === 'vi' ? 'Có đồ để quên' : 'Lost & Found item found'))}
                >
                  🎒 {language === 'ja' ? '忘れ物' : 'Đồ để quên'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCleaningNotes(prev => (prev ? prev + ', ' : '') + (language === 'ja' ? '設備破損あり' : language === 'vi' ? 'Hỏng hóc thiết bị' : 'Maintenance issue'))}
                >
                  🛠️ {language === 'ja' ? '設備破損' : 'Thiết bị hỏng'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCleaningNotes(prev => (prev ? prev + ', ' : '') + (language === 'ja' ? 'シーツ交換完了' : language === 'vi' ? 'Đã thay drap giường' : 'Bed sheets replaced'))}
                >
                  🛏️ {language === 'ja' ? 'シーツ交換' : 'Thay drap'}
                </button>
              </div>

              {/* Action buttons */}
              <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedRoom(null)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {getTranslation(language, 'cancel')}
                </button>
                {selectedRoom.isStay && (
                  <>
                    <button
                      type="button"
                      className="btn"
                      style={{ backgroundColor: '#f97316', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', flex: 1 }}
                      onClick={submitHangingDNDOnly}
                    >
                      <Sparkles size={18} />
                      <span style={{ whiteSpace: 'nowrap' }}>{language === 'vi' ? 'Chỉ cần treo đồ' : language === 'ja' ? 'アメニティ吊り下げのみ' : 'Hang items only'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ backgroundColor: '#64748b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', flex: 1 }}
                      onClick={submitDNDRoom}
                    >
                      <AlertTriangle size={18} />
                      <span style={{ whiteSpace: 'nowrap' }}>{language === 'vi' ? 'Trở thành phòng DD' : language === 'ja' ? 'DND部屋にする' : 'Make DD Room'}</span>
                    </button>
                  </>
                )}
                <button 
                  type="button" 
                  className="btn"
                  style={{ backgroundColor: 'var(--status-clean)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', flex: 1 }}
                  onClick={submitFinishedCleaning}
                >
                  <Check size={18} />
                  <span style={{ whiteSpace: 'nowrap' }}>{language === 'vi' ? 'Dọn xong ✓' : language === 'ja' ? '清掃完了 ✓' : 'Finish Clean ✓'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Checker Inspection Modal */
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ maxWidth: '460px', position: 'relative' }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedRoom(null)}
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  padding: '0.25rem',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.05)',
                  color: 'var(--text-color)',
                  zIndex: 10
                }}
              >
                ✕
              </button>
              <h3 className="modal-title" style={{ paddingRight: '2.5rem' }}>
                {language === 'vi' ? 'Chi tiết kiểm phòng' : language === 'ja' ? '客室検査詳細' : 'Room Inspection Details'} - Room {selectedRoom.roomNumber}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>{language === 'vi' ? 'Kiểu phòng:' : 'Type:'} </strong> {selectedRoom.type} - {selectedRoom.floor}F
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>{language === 'vi' ? 'Trạng thái phòng:' : 'Room Status:'} </strong>
                  <span className={`badge badge-${selectedRoom.status}`} style={{ fontSize: '0.65rem', marginLeft: '0.25rem' }}>
                    {selectedRoom.status.toUpperCase()}
                  </span>
                  {(selectedRoom.status === 'clean' || selectedRoom.status === 'eco' || (selectedRoom.status === 'dnd' && selectedRoom.isStay)) && (
                    <span className={`badge badge-${selectedRoom.isChecked ? 'clean' : 'dirty'}`} style={{ fontSize: '0.65rem', marginLeft: '0.25rem' }}>
                      {selectedRoom.isChecked 
                        ? (language === 'vi' ? 'Đã duyệt ✓' : 'Checked ✓') 
                        : (language === 'vi' ? 'Chờ duyệt 🔍' : 'Pending 🔍')}
                    </span>
                  )}
                </div>

                {selectedRoom.notes && (
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderLeft: '4px solid var(--status-maintenance)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem'
                  }}>
                    <strong>{language === 'vi' ? 'Ghi chú phòng:' : 'Room Notes:'} </strong>
                    <span style={{ color: 'var(--status-maintenance)', fontWeight: 600 }}>{selectedRoom.notes}</span>
                  </div>
                )}
              </div>

              {(selectedRoom.status === 'clean' || selectedRoom.status === 'eco' || (selectedRoom.status === 'dnd' && selectedRoom.isStay)) ? (
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                    {language === 'vi' ? 'Báo cáo từ dọn phòng:' : 'Housekeeping Report:'}
                  </h4>

                  {roomLog ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{language === 'vi' ? 'Nhân viên dọn:' : 'Cleaner:'} </strong> {roomLog.cleanerName}
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{language === 'vi' ? 'Giờ hoàn thành:' : language === 'ja' ? '完了時間:' : 'Completion Time:'} </strong> {new Date(roomLog.endedAt).toLocaleTimeString()} ({roomLog.durationMinutes} {language === 'vi' ? 'phút' : 'mins'})
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{language === 'vi' ? 'Ghi chú của NV:' : 'Cleaner Notes:'} </strong> {roomLog.notes || 'N/A'}
                      </div>

                      {roomLog.photoAfter && (
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            {language === 'vi' ? 'Ảnh chụp dọn phòng sạch:' : 'Verification Photo:'}
                          </div>
                          <img 
                            src={roomLog.photoAfter} 
                            alt="Verification Clean" 
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,0.1)' }} 
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{language === 'vi' ? 'Nhân viên dọn:' : 'Cleaner:'} </strong> {selectedRoom.cleanerName || 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{language === 'vi' ? 'Giờ hoàn thành:' : language === 'ja' ? '完了時間:' : 'Completion Time:'} </strong> {selectedRoom.updatedAt ? new Date(selectedRoom.updatedAt).toLocaleTimeString() : 'N/A'}
                      </div>
                      <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>
                        {language === 'vi' ? '(Chưa tìm thấy chi tiết log dọn phòng ngày hôm nay)' : '(No detailed cleaning log found for today)'}
                      </p>
                    </div>
                  )}

                  {/* Checker Report */}
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', marginTop: '1rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                      {language === 'vi' ? '🔍 Báo cáo từ kiểm phòng (Check):' : language === 'ja' ? '🔍 検査レポート:' : '🔍 Inspection Report:'}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div>
                        <strong>{language === 'vi' ? 'Người kiểm tra:' : language === 'ja' ? '検査担当:' : 'Checked By:'}</strong>{' '}
                        {selectedRoom.checkedBy || (language === 'vi' ? 'Chưa kiểm tra / Đang chờ' : language === 'ja' ? '未検査 / 待機中' : 'Pending')}
                      </div>
                      {selectedRoom.checkedBy && selectedRoom.checkedAt && (
                        <div>
                          <strong>{language === 'vi' ? 'Thời gian duyệt:' : language === 'ja' ? '検査時間:' : 'Inspected At:'}</strong>{' '}
                          {new Date(selectedRoom.checkedAt).toLocaleString()}
                        </div>
                      )}
                      {selectedRoom.isChecked && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <strong>{language === 'vi' ? 'Đã xem ghi chú của người dọn:' : language === 'ja' ? '清掃員メモ確認済:' : 'Viewed cleaner notes:'}</strong>{' '}
                            {selectedRoom.viewedCleanerNotes ? (
                              <span style={{ color: 'var(--status-clean)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                ☑ {language === 'vi' ? 'Đã xem' : language === 'ja' ? '確認済' : 'Viewed'}
                              </span>
                            ) : (
                              <span style={{ opacity: 0.6 }}>
                                ☐ {language === 'vi' ? 'Chưa xem hoặc không có ghi chú' : language === 'ja' ? '未確認 hoặc không có ghi chú' : 'Not viewed or no notes'}
                              </span>
                            )}
                          </div>
                          <div>
                            <strong>{language === 'vi' ? 'Ghi chú sự cố / kiểm phòng:' : language === 'ja' ? '指摘/異常報告メモ:' : 'Incident / Inspection Notes:'}</strong>{' '}
                            <span style={{ color: 'var(--status-maintenance)', fontWeight: 600 }}>
                              {selectedRoom.checkerNotes || (language === 'vi' ? 'Không có ghi chú sự cố' : language === 'ja' ? '指摘事項なし' : 'None')}
                            </span>
                          </div>
                          <div style={{ marginTop: '0.5rem' }}>
                            <strong>{language === 'vi' ? '🔍 Kết quả đánh giá chất lượng:' : language === 'ja' ? '🔍 品質インスペクション結果:' : '🔍 Quality Inspection Results:'}</strong>{' '}
                            {roomLog && roomLog.errors && roomLog.errors.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                                {roomLog.errors.map((e, idx) => (
                                  <span key={idx} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-maintenance)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    ❌ {translateDefect(e, language)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--status-clean)', fontWeight: 600, marginLeft: '0.25rem' }}>
                                ✓ {language === 'vi' ? 'Đạt 100% (Không phát hiện lỗi)' : language === 'ja' ? '100%合格 (指摘なし)' : 'Passed 100% (No defects)'}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Checker Inputs for Unchecked Rooms */}
                  {!selectedRoom.isChecked && (
                    <div style={{
                      backgroundColor: 'var(--panel-bg-subtle)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      marginTop: '1rem',
                      marginBottom: '1rem',
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-color)' }}>
                        📝 {language === 'vi' ? 'Nhận xét kiểm phòng:' : language === 'ja' ? '検査メモ/確認:' : 'Inspection Notes & Verification:'}
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: isEditDisabled ? 'default' : 'pointer', color: 'var(--text-color)', marginBottom: '0.75rem' }}>
                        <input 
                          type="checkbox" 
                          checked={viewedCleanerNotes} 
                          onChange={e => setViewedCleanerNotes(e.target.checked)} 
                          disabled={isEditDisabled} 
                        />
                        <strong>
                          {language === 'vi' 
                            ? '☑ Đã xem ghi chú của người dọn' 
                            : language === 'ja' 
                              ? '☑ 清掃員のメモを確認しました' 
                              : '☑ Viewed cleaner\'s notes'}
                        </strong>
                      </label>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          {language === 'vi' ? 'Ghi chú sự cố / kiểm phòng:' : language === 'ja' ? '指摘/異常報告メモ:' : 'Incident / Inspection Notes:'}
                        </label>
                        <textarea
                          className="form-input"
                          value={checkerNotes}
                          onChange={e => setCheckerNotes(e.target.value)}
                          placeholder={language === 'vi' ? 'Nhập ghi chú sự cố hoặc nhận xét kiểm phòng...' : language === 'ja' ? '設備不具合や特記事項を入力...' : 'Enter inspection details or incidents...'}
                          style={{ minHeight: '60px', resize: 'vertical', fontSize: '0.85rem', padding: '0.5rem' }}
                          disabled={isEditDisabled}
                        />
                      </div>
                    </div>
                  )}

                  {/* Inspection Checklist */}
                  {!selectedRoom.isChecked && selectedRoom.status !== 'eco' && selectedRoom.status !== 'dnd' && (
                    <div style={{
                      backgroundColor: 'var(--panel-bg-subtle)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      marginTop: '1.25rem'
                    }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-color)' }}>
                        🔍 {language === 'vi' ? 'Phiếu Kiểm Tra Chất Lượng:' : language === 'ja' ? '客室インスペクションシート:' : 'Quality Inspection Checklist:'}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: isEditDisabled ? 'default' : 'pointer', color: 'var(--text-color)' }}>
                          <input type="checkbox" checked={defectFloor} onChange={e => setDefectFloor(e.target.checked)} disabled={isEditDisabled} />
                          <span>{language === 'vi' ? 'Chưa lau sàn / hút bụi' : language === 'ja' ? '床掃除・掃除機未実施' : 'Floor dusty/dirty'}</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: isEditDisabled ? 'default' : 'pointer', color: 'var(--text-color)' }}>
                          <input type="checkbox" checked={defectAmenities} onChange={e => setDefectAmenities(e.target.checked)} disabled={isEditDisabled} />
                          <span>{language === 'vi' ? 'Thiếu đồ dùng / khăn' : language === 'ja' ? 'アメニティ・タオル不足' : 'Missing towels/amenities'}</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: isEditDisabled ? 'default' : 'pointer', color: 'var(--text-color)' }}>
                          <input type="checkbox" checked={defectBathroom} onChange={e => setDefectBathroom(e.target.checked)} disabled={isEditDisabled} />
                          <span>{language === 'vi' ? 'Bần nhà vệ sinh / bồn tắm' : language === 'ja' ? '水回り・浴室汚れ' : 'Dirty bathroom'}</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: isEditDisabled ? 'default' : 'pointer', color: 'var(--text-color)' }}>
                          <input type="checkbox" checked={defectBed} onChange={e => setDefectBed(e.target.checked)} disabled={isEditDisabled} />
                          <span>{language === 'vi' ? 'Ga giường nhăn / bẩn' : language === 'ja' ? 'シーツしわ・汚れ' : 'Wrinkled/dirty sheet'}</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: isEditDisabled ? 'default' : 'pointer', color: 'var(--text-color)' }}>
                          <input type="checkbox" checked={defectTrash} onChange={e => setDefectTrash(e.target.checked)} disabled={isEditDisabled} />
                          <span>{language === 'vi' ? 'Chưa đổ rác' : language === 'ja' ? 'ゴミ未回収' : 'Trash not emptied'}</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: isEditDisabled ? 'default' : 'pointer', color: 'var(--text-color)' }}>
                          <input type="checkbox" checked={defectDust} onChange={e => setDefectDust(e.target.checked)} disabled={isEditDisabled} />
                          <span>{language === 'vi' ? 'Còn bụi trên bàn / tủ' : language === 'ja' ? '家具ほこり残り' : 'Dust on furniture'}</span>
                        </label>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: isEditDisabled ? 'default' : 'pointer', color: 'var(--text-color)', marginBottom: '0.25rem' }}>
                          <input type="checkbox" checked={defectOther} onChange={e => setDefectOther(e.target.checked)} disabled={isEditDisabled} />
                          <span>{language === 'vi' ? 'Lỗi khác' : language === 'ja' ? 'その他指摘事項' : 'Other defect'}</span>
                        </label>
                        {defectOther && (
                          <input 
                            type="text" 
                            className="form-input" 
                            value={defectOtherText} 
                            onChange={e => setDefectOtherText(e.target.value)} 
                            placeholder={language === 'vi' ? 'Nhập mô tả lỗi khác...' : language === 'ja' ? '指摘内容を入力...' : 'Enter details...'}
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', height: 'auto' }}
                            disabled={isEditDisabled}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reclean Input Area */}
                  {showRecleanInput && (
                    <div className="form-group" style={{ marginTop: '1.25rem', animation: 'slideInRight 0.2s ease-out' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--status-maintenance)' }}>
                        ⚠️ {language === 'vi' ? 'Lý do yêu cầu dọn lại:' : language === 'ja' ? '再清掃の理由:' : 'Reason for Recleaning:'}
                      </label>
                      <textarea
                        className="form-input"
                        value={recleanReason}
                        onChange={e => setRecleanReason(e.target.value)}
                        placeholder={language === 'vi' ? 'e.g. Quên trải drap gối, sàn chưa lau kỹ...' : 'e.g. Sheet has wrinkles, floor dusty...'}
                        style={{ minHeight: '60px', resize: 'vertical', border: '1px solid var(--status-maintenance)' }}
                        required
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button 
                          type="button" 
                          className="btn btn-danger btn-sm" 
                          onClick={handleRequestReclean}
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          {language === 'vi' ? 'Xác nhận cần dọn lại' : 'Submit Reclean'}
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setShowRecleanInput(false)}
                        >
                          {language === 'vi' ? 'Hủy' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Main Action Buttons */}
                  {!showRecleanInput && (
                    <div className="modal-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Left Actions */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!selectedRoom.isChecked && !isEditDisabled && selectedRoom.status !== 'eco' && (
                          <button
                            type="button"
                            className="btn"
                            style={{ backgroundColor: 'var(--status-maintenance)', color: 'white' }}
                            onClick={() => setShowRecleanInput(true)}
                          >
                            🔄 {language === 'vi' ? 'Yêu cầu dọn lại' : language === 'ja' ? '再清掃要求' : 'Reclean'}
                          </button>
                        )}

                        {/* Revert DND button: if status is 'dnd' and not checked yet, show revert button */}
                        {!selectedRoom.isChecked && !isEditDisabled && selectedRoom.status === 'dnd' && (
                          <button 
                            type="button" 
                            className="btn"
                            style={{ backgroundColor: 'var(--status-maintenance)', color: 'white' }}
                            onClick={handleRevertDND}
                          >
                            ↩️ {language === 'vi' ? 'Quay lại' : language === 'ja' ? '戻す' : 'Revert'}
                          </button>
                        )}

                        {selectedRoom.isChecked && !isEditDisabled && (selectedRoom.status === 'clean' || selectedRoom.status === 'eco' || selectedRoom.status === 'dnd') && (
                          <button 
                            type="button" 
                            className="btn"
                            style={{ backgroundColor: 'var(--status-maintenance)', color: 'white' }}
                            onClick={handleRevertEco}
                          >
                            ↩️ {language === 'vi' ? 'Quay lại' : language === 'ja' ? '戻す' : 'Revert'}
                          </button>
                        )}
                      </div>

                      {/* Right Actions */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                        {!isEditDisabled && (
                          <button
                            type="button"
                            className="btn"
                            style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.5rem 0.75rem' }}
                            title={language === 'vi' ? 'Cài đặt phòng' : language === 'ja' ? '客室設定' : 'Room Setup'}
                            onClick={() => {
                              setGridMode('setup');
                              setSetupForm({
                                status: selectedRoom.status,
                                isStay: selectedRoom.isStay,
                                guestCount: selectedRoom.guestCount,
                                notes: selectedRoom.notes || ''
                              });
                              setSetupModalOpen(true);
                            }}
                          >
                            ⚙️
                          </button>
                        )}
                        
                        {!selectedRoom.isChecked && !isEditDisabled && (
                          <button 
                            type="button" 
                            className="btn"
                            style={{ backgroundColor: selectedRoom.status === 'eco' ? 'var(--status-eco)' : selectedRoom.status === 'dnd' ? 'var(--status-maintenance)' : 'var(--status-clean)', color: 'white' }}
                            onClick={handleApproveClean}
                          >
                            <CheckCircle size={18} />
                            {selectedRoom.status === 'eco'
                              ? (language === 'vi' ? 'Xác nhận hoàn thành' : language === 'ja' ? '完了を確認' : 'Confirm complete')
                              : selectedRoom.status === 'dnd'
                                ? (language === 'vi' ? 'Hoàn thành' : language === 'ja' ? '完了' : 'Complete')
                                : (language === 'vi' ? 'Phê duyệt sạch' : language === 'ja' ? '清掃を承認' : 'Approve Ready')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Status is NOT 'clean': show read-only/info and transition button to setup mode
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '1.25rem' }}>
                    {language === 'vi' 
                      ? 'Phòng chưa được dọn sạch. Bạn có thể xem thông tin chi tiết.' 
                      : language === 'ja'
                        ? 'この客室はまだ清掃されていません。詳細を確認できます。'
                        : 'This room is not cleaned yet. You can view its details.'}
                  </p>
                  <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {!isEditDisabled && (
                      <button
                        type="button"
                        className="btn"
                        style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.5rem 0.75rem' }}
                        title={language === 'vi' ? 'Cài đặt phòng' : language === 'ja' ? '客室設定' : 'Room Setup'}
                        onClick={() => {
                          setGridMode('setup');
                          setSetupForm({
                            status: selectedRoom.status,
                            isStay: selectedRoom.isStay,
                            guestCount: selectedRoom.guestCount,
                            notes: selectedRoom.notes || ''
                          });
                          setSetupModalOpen(true);
                        }}
                      >
                        ⚙️
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Room Configuration Modal for Setup Mode */}
      {setupModalOpen && selectedRoom && gridMode === 'setup' && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '440px' }}>
            <h3 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚙️ {language === 'vi' ? `Thiết lập phòng ${selectedRoom.roomNumber}` : language === 'ja' ? `客室 ${selectedRoom.roomNumber} 設定` : `Setup Room ${selectedRoom.roomNumber}`}
            </h3>
            <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '-0.5rem', marginBottom: '1rem' }}>
              {selectedRoom.type} - {selectedRoom.floor}F
            </p>

            {/* Quick Actions Panel */}
            <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                ⚡ {language === 'vi' ? 'Thiết lập nhanh' : language === 'ja' ? 'クイック設定' : 'Quick Actions'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: setupForm.status === 'dirty' && !setupForm.isStay ? '#ef4444' : 'rgba(0,0,0,0.03)',
                    color: setupForm.status === 'dirty' && !setupForm.isStay ? '#ffffff' : 'inherit',
                    border: setupForm.status === 'dirty' && !setupForm.isStay ? '1px solid #dc2626' : '1px solid rgba(0,0,0,0.05)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '0.5rem'
                  }}
                  onClick={() => setSetupForm({ ...setupForm, status: 'dirty', isStay: false })}
                >
                  🚪 {language === 'vi' ? 'Khách OUT (Cần dọn)' : language === 'ja' ? '客アウト (要清掃)' : 'Guest OUT (Dirty)'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: setupForm.status === 'dirty' && setupForm.isStay ? '#8b5cf6' : 'rgba(0,0,0,0.03)',
                    color: setupForm.status === 'dirty' && setupForm.isStay ? '#ffffff' : 'inherit',
                    border: setupForm.status === 'dirty' && setupForm.isStay ? '1px solid #7c3aed' : '1px solid rgba(0,0,0,0.05)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '0.5rem'
                  }}
                  onClick={() => setSetupForm({ ...setupForm, status: 'dirty', isStay: true })}
                >
                  🔁 {language === 'vi' ? 'Khách STAY (Cần dọn)' : language === 'ja' ? '連泊要清掃 (Stay)' : 'Guest STAY (Dirty)'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: setupForm.status === 'eco' ? 'var(--status-eco)' : 'rgba(0,0,0,0.03)',
                    color: setupForm.status === 'eco' ? '#ffffff' : 'inherit',
                    border: '1px solid rgba(0,0,0,0.05)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '0.5rem'
                  }}
                  onClick={() => setSetupForm({ ...setupForm, status: 'eco', isStay: true })}
                >
                  🧺 {language === 'vi' ? 'Chỉ treo đồ (Eco)' : language === 'ja' ? 'アメニティのみ (Eco)' : 'Hang items (Eco)'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: setupForm.status === 'dnd' ? 'var(--status-dnd)' : 'rgba(0,0,0,0.03)',
                    color: setupForm.status === 'dnd' ? '#ffffff' : 'inherit',
                    border: '1px solid rgba(0,0,0,0.05)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '0.5rem'
                  }}
                  onClick={() => setSetupForm({ ...setupForm, status: 'dnd', isStay: true })}
                >
                  🚫 {language === 'vi' ? 'Không dọn dẹp (DND)' : language === 'ja' ? '起こさないで (DND)' : 'No Clean (DND)'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: setupForm.status === 'vacant' ? '#cbd5e1' : 'rgba(0,0,0,0.03)',
                    color: '#0f172a',
                    border: '1px solid rgba(0,0,0,0.05)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '0.5rem'
                  }}
                  onClick={() => setSetupForm({ ...setupForm, status: 'vacant', isStay: false, guestCount: 0 })}
                >
                  ✨ {language === 'vi' ? 'Phòng trống (Vacant)' : language === 'ja' ? '空室 (Vacant)' : 'Vacant Room'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: setupForm.status === 'maintenance' ? 'var(--status-maintenance)' : 'rgba(0,0,0,0.03)',
                    color: setupForm.status === 'maintenance' ? '#ffffff' : 'inherit',
                    border: '1px solid rgba(0,0,0,0.05)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '0.5rem'
                  }}
                  onClick={() => setSetupForm({ ...setupForm, status: 'maintenance' })}
                >
                  🛠️ {language === 'vi' ? 'Sửa chữa (Repair)' : language === 'ja' ? 'メンテナンス (Repair)' : 'Repair (Maint.)'}
                </button>
              </div>
            </div>

            {/* Status Selector */}
            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'status')}</label>
              <select
                className="form-input"
                value={setupForm.status}
                onChange={(e) => setSetupForm({ ...setupForm, status: e.target.value as Room['status'] })}
              >
                <option value="vacant">{language === 'vi' ? 'Trống (Vacant) - Không màu' : language === 'ja' ? '空室 (Vacant) - 色なし' : 'Vacant - No color'}</option>
                <option value="dirty">
                  {language === 'vi'
                    ? (setupForm.isStay ? 'Cần dọn (Dirty) - Màu tím' : 'Cần dọn (Dirty) - Màu đỏ')
                    : language === 'ja'
                    ? (setupForm.isStay ? '要清掃 (Dirty) - 紫色' : '要清掃 (Dirty) - 赤色')
                    : (setupForm.isStay ? 'Dirty (Need clean) - Purple' : 'Dirty (Need clean) - Red')}
                </option>
                <option value="eco">{language === 'vi' ? 'Chỉ treo đồ (Eco) - Màu xanh lá' : language === 'ja' ? 'ECO (吊り下げ) - 緑色' : 'Eco (Hang items) - Green'}</option>
                <option value="dnd">{language === 'vi' ? 'Không làm phiền (DND) - Màu xám' : language === 'ja' ? '起こさないで (DND) - 灰色' : 'Do Not Disturb (DND) - Slate'}</option>
                <option value="occupied">{getTranslation(language, 'statusOccupied')}</option>
                <option value="cleaning">{getTranslation(language, 'statusCleaning')}</option>
                <option value="clean">{getTranslation(language, 'statusClean')}</option>
                <option value="maintenance">{getTranslation(language, 'statusMaintenance')}</option>
              </select>
            </div>

            {/* Stay checkbox */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
              <input
                type="checkbox"
                id="isStayCheck"
                checked={setupForm.isStay}
                onChange={(e) => setSetupForm({ ...setupForm, isStay: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="isStayCheck" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                {language === 'vi' ? 'Khách ở tiếp (Stay / Liên phòng)' : language === 'ja' ? '連泊 (Stay)' : 'Stay / Stay-over guest'}
              </label>
            </div>

            {/* Expected Guest Count */}
            <div className="form-group">
              <label className="form-label">{language === 'vi' ? 'Số người dọn dẹp cần set' : language === 'ja' ? '清掃セット予定人数' : 'Expected guest count'}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '40px', height: '40px', padding: 0 }}
                  onClick={() => setSetupForm({ ...setupForm, guestCount: Math.max(0, setupForm.guestCount - 1) })}
                >
                  -
                </button>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, width: '30px', textAlign: 'center' }}>
                  {setupForm.guestCount}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '40px', height: '40px', padding: 0 }}
                  onClick={() => setSetupForm({ ...setupForm, guestCount: setupForm.guestCount + 1 })}
                >
                  +
                </button>
              </div>
            </div>

            {/* Notes textarea */}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span>
                  {setupForm.status === 'dirty' && setupForm.isStay 
                    ? (language === 'vi' ? 'Ghi chú dọn dẹp (yêu cầu dọn dẹp ntn, làm gì...)' : language === 'ja' ? '清掃指示・メモ (清掃方法など)' : 'Stay Cleaning Directives')
                    : setupForm.status === 'vacant'
                      ? (language === 'vi' ? 'Yêu cầu phòng trống (Thêm/bớt đồ...)' : language === 'ja' ? '空室リクエスト (追加・回収など)' : 'Vacant Room Requests')
                      : getTranslation(language, 'notes')}
                </span>
                
                {/* Vacant Quick Actions */}
                {setupForm.status === 'vacant' && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.15rem 0.35rem', fontSize: '0.65rem' }}
                      onClick={() => setSetupForm(prev => ({ ...prev, notes: prev.notes ? prev.notes + '; Yêu cầu thêm đồ' : 'Yêu cầu thêm đồ' }))}
                    >
                      ➕ {language === 'vi' ? 'Thêm đồ' : '追加'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.15rem 0.35rem', fontSize: '0.65rem' }}
                      onClick={() => setSetupForm(prev => ({ ...prev, notes: prev.notes ? prev.notes + '; Yêu cầu bớt đồ' : 'Yêu cầu bớt đồ' }))}
                    >
                      ➖ {language === 'vi' ? 'Bớt đồ' : '回収'}
                    </button>
                  </div>
                )}
              </div>
              <textarea
                className="form-input"
                style={{ minHeight: '60px', resize: 'vertical' }}
                value={setupForm.notes}
                onChange={(e) => setSetupForm({ ...setupForm, notes: e.target.value })}
                placeholder={getTranslation(language, 'notesPlaceholder')}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setSetupModalOpen(false); setSelectedRoom(null); }}
                style={{ marginRight: 'auto' }}
              >
                {getTranslation(language, 'cancel')}
              </button>
              
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveRoomSetup}
              >
                {getTranslation(language, 'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DAILY STAFF ASSIGNMENT CONFIRMATION MODAL */}
      {confirmStaffModal.open && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '420px', padding: '1.75rem', textAlign: 'center' }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '52px', 
              height: '52px', 
              borderRadius: '50%', 
              backgroundColor: confirmStaffModal.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
              color: confirmStaffModal.isActive ? 'var(--status-maintenance)' : 'var(--status-clean)',
              marginBottom: '1rem',
              fontSize: '1.5rem'
            }}>
              {confirmStaffModal.isActive ? '⚠️' : '👤'}
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              {language === 'vi' 
                ? 'Xác nhận phân công' 
                : language === 'ja' 
                  ? '出勤設定の確認' 
                  : 'Confirm Staff Assignment'}
            </h3>
            
            <p style={{ fontSize: '0.95rem', opacity: 0.85, lineHeight: 1.5, marginBottom: '1.5rem' }}>
              {language === 'vi' ? (
                confirmStaffModal.isActive 
                  ? `Bạn có chắc chắn muốn HỦY phân công làm việc hôm nay đối với nhân viên ${confirmStaffModal.cleanerName}?`
                  : `Bạn có chắc chắn muốn PHÂN CÔNG làm việc hôm nay cho nhân viên ${confirmStaffModal.cleanerName}?`
              ) : language === 'ja' ? (
                confirmStaffModal.isActive
                  ? `${confirmStaffModal.cleanerName} を本日の出勤スタッフから除外しますか？`
                  : `${confirmStaffModal.cleanerName} を本日の出勤スタッフに追加しますか？`
              ) : (
                confirmStaffModal.isActive
                  ? `Are you sure you want to remove ${confirmStaffModal.cleanerName} from today's active staff?`
                  : `Are you sure you want to assign ${confirmStaffModal.cleanerName} to work today?`
              )}
            </p>
            
            <div className="modal-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.5rem 1rem' }}
                onClick={() => setConfirmStaffModal(prev => ({ ...prev, open: false }))}
              >
                {getTranslation(language, 'cancel')}
              </button>
              <button 
                type="button" 
                className={confirmStaffModal.isActive ? "btn btn-danger" : "btn btn-primary"} 
                style={{ flex: 1, padding: '0.5rem 1rem' }}
                onClick={executeStaffToggle}
              >
                {language === 'vi' ? 'Xác nhận' : language === 'ja' ? '確定する' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN FLOOR CAROUSEL VIEW */}
      {isFullScreenFloorView && carouselSortedFloors.length > 0 && (
        <div 
          className="fullscreen-floor-overlay"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header */}
          <div className="fullscreen-floor-header">
            <div className="floor-selector-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                className="form-input"
                style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', fontWeight: 600, width: '110px' }}
                value={fullscreenMode}
                onChange={(e) => setFullscreenMode(e.target.value as any)}
              >
                <option value="single">{language === 'vi' ? 'Một tầng' : language === 'ja' ? '単一階' : 'Single'}</option>
                <option value="all">{language === 'vi' ? 'Toàn bộ' : language === 'ja' ? '全階' : 'All Floors'}</option>
                <option value="custom">{language === 'vi' ? 'Tùy chọn' : language === 'ja' ? 'カスタム' : 'Custom'}</option>
              </select>

              {fullscreenMode === 'single' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button 
                    type="button"
                    className="btn btn-outline btn-icon"
                    style={{ padding: '0.4rem', display: 'flex', alignItems: 'center' }}
                    onClick={() => setActiveFloorIndex(prev => Math.max(prev - 1, 0))}
                    disabled={activeFloorIndex === 0}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  
                  <select 
                    className="form-input floor-dropdown"
                    value={carouselSortedFloors[activeFloorIndex]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const idx = carouselSortedFloors.indexOf(val);
                      if (idx !== -1) setActiveFloorIndex(idx);
                    }}
                  >
                    {carouselSortedFloors.map(floorNum => (
                      <option key={floorNum} value={floorNum}>
                        {language === 'vi' ? `Tầng ${floorNum}` : language === 'ja' ? `${floorNum}階` : `Floor ${floorNum}`}
                      </option>
                    ))}
                  </select>

                  <button 
                    type="button"
                    className="btn btn-outline btn-icon"
                    style={{ padding: '0.4rem', display: 'flex', alignItems: 'center' }}
                    onClick={() => setActiveFloorIndex(prev => Math.min(prev + 1, carouselSortedFloors.length - 1))}
                    disabled={activeFloorIndex === carouselSortedFloors.length - 1}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}

              {fullscreenMode === 'custom' && (
                <div 
                  className="glass-panel" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    padding: '0.35rem 0.6rem', 
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.75)',
                    overflowX: 'auto',
                    maxWidth: '320px',
                    scrollbarWidth: 'none'
                  }}
                >
                  {carouselSortedFloors.map(floorNum => {
                    const isChecked = customSelectedFloors.includes(floorNum);
                    return (
                      <label key={floorNum} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setCustomSelectedFloors(prev => 
                              isChecked 
                                ? prev.filter(f => f !== floorNum) 
                                : [...prev, floorNum].sort((a,b) => a-b)
                            );
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{language === 'vi' ? `Tầng ${floorNum}` : language === 'ja' ? `${floorNum}階` : `Floor ${floorNum}`}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Columns Selector inside full screen */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Col:</span>
                <select 
                  className="form-input" 
                  style={{ width: '70px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  value={gridColumns}
                  onChange={e => setGridColumns(e.target.value)}
                >
                  <option value="auto">Auto</option>
                  <option value="4">4</option>
                  <option value="6">6</option>
                  <option value="8">8</option>
                  <option value="10">10</option>
                  <option value="12">12</option>
                  <option value="16">16</option>
                </select>
              </div>

              <button 
                type="button"
                className="btn btn-outline btn-icon"
                style={{ padding: '0.4rem', display: 'flex', alignItems: 'center' }}
                onClick={() => setIsFullScreenFloorView(false)}
              >
                <Minimize2 size={20} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="fullscreen-floor-body" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', overflowY: 'auto', paddingBottom: '4rem' }}>
            {((fullscreenMode === 'all' 
              ? carouselSortedFloors
              : fullscreenMode === 'custom'
                ? customSelectedFloors
                : [carouselSortedFloors[activeFloorIndex]]) as number[]).map((floorNum) => {
              const floorRooms = (carouselRoomsByFloor[floorNum] || [])
                .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
              
              if (floorRooms.length === 0) return null;

              return (
                <div key={floorNum} className="fullscreen-floor-group">
                  {/* Floor Divider */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem', 
                      marginBottom: '1rem',
                      marginTop: '0.5rem',
                      padding: '0 0.5rem' 
                    }}
                  >
                    <span 
                      style={{ 
                        fontSize: '1rem', 
                        fontWeight: 800, 
                        color: 'var(--primary-color)',
                        backgroundColor: 'rgba(128, 128, 128, 0.15)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {language === 'vi' ? `Tầng ${floorNum}` : language === 'ja' ? `${floorNum}階` : `Floor ${floorNum}`}
                    </span>
                    <div style={{ flex: 1, height: '2px', backgroundColor: 'rgba(128, 128, 128, 0.2)', borderRadius: '1px' }} />
                  </div>

                  {/* Room grid for this floor */}
                  <div 
                    className={`room-grid cols-${gridColumns}`}
                    style={gridColumns !== 'auto' ? {
                      gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                      ['--room-card-min-height' as any]: Number(gridColumns) >= 12 ? '80px' : Number(gridColumns) >= 8 ? '95px' : '120px',
                      ['--room-card-padding' as any]: Number(gridColumns) >= 12 ? '0.5rem 0.4rem 0.4rem' : Number(gridColumns) >= 8 ? '0.8rem 0.6rem 0.5rem' : '1.25rem 1rem 0.75rem',
                      ['--room-number-font-size' as any]: Number(gridColumns) >= 12 ? '1.1rem' : Number(gridColumns) >= 8 ? '1.35rem' : '1.75rem',
                      ['--room-type-font-size' as any]: Number(gridColumns) >= 12 ? '0.55rem' : Number(gridColumns) >= 8 ? '0.65rem' : '0.75rem',
                      ['--room-guest-font-size' as any]: Number(gridColumns) >= 12 ? '0.5rem' : Number(gridColumns) >= 8 ? '0.6rem' : '0.7rem',
                      ['--room-assignee-font-size' as any]: Number(gridColumns) >= 12 ? '0.55rem' : Number(gridColumns) >= 8 ? '0.65rem' : '0.75rem',
                      
                      // Mobile responsive scaling variables
                      ['--room-card-min-height-mobile' as any]: Number(gridColumns) >= 16 ? '40px' : Number(gridColumns) >= 12 ? '50px' : Number(gridColumns) >= 10 ? '60px' : Number(gridColumns) >= 8 ? '70px' : Number(gridColumns) >= 6 ? '80px' : '90px',
                      ['--room-card-padding-mobile' as any]: Number(gridColumns) >= 12 ? '0.15rem 0.1rem' : Number(gridColumns) >= 8 ? '0.25rem 0.15rem' : Number(gridColumns) >= 6 ? '0.35rem 0.25rem' : '0.5rem 0.35rem',
                      ['--room-number-font-size-mobile' as any]: Number(gridColumns) >= 16 ? '0.5rem' : Number(gridColumns) >= 12 ? '0.6rem' : Number(gridColumns) >= 10 ? '0.7rem' : Number(gridColumns) >= 8 ? '0.8rem' : Number(gridColumns) >= 6 ? '0.95rem' : '1.1rem',
                      ['--room-type-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.35rem' : Number(gridColumns) >= 8 ? '0.45rem' : Number(gridColumns) >= 6 ? '0.5rem' : '0.55rem',
                      ['--room-guest-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.3rem' : Number(gridColumns) >= 8 ? '0.4rem' : Number(gridColumns) >= 6 ? '0.45rem' : '0.5rem',
                      ['--room-assignee-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.35rem' : Number(gridColumns) >= 8 ? '0.45rem' : Number(gridColumns) >= 6 ? '0.5rem' : '0.55rem',
                      ['--room-assignee-max-width-mobile' as any]: Number(gridColumns) >= 12 ? '20px' : Number(gridColumns) >= 8 ? '35px' : Number(gridColumns) >= 6 ? '45px' : '55px',
                      ['--room-note-icon-size' as any]: Number(gridColumns) >= 12 ? '0.65rem' : Number(gridColumns) >= 8 ? '0.8rem' : '1rem',
                      ['--room-note-icon-size-mobile' as any]: Number(gridColumns) >= 16 ? '0.45rem' : Number(gridColumns) >= 12 ? '0.5rem' : Number(gridColumns) >= 10 ? '0.6rem' : Number(gridColumns) >= 8 ? '0.7rem' : '0.8rem',
                    } : undefined}
                  >
                    {floorRooms.map((room) => {
                      const isClean = room.status === 'clean';
                      const isPending = isClean && !room.isChecked;
                      const isApproved = isClean && !!room.isChecked;
                      
                      let statusText = room.status.toUpperCase();
                      let cardClass = room.status;

                      if (isPending) {
                        statusText = language === 'vi' ? 'CHỜ DUYỆT 🔍' : language === 'ja' ? '要検査 🔍' : 'PENDING 🔍';
                      } else if (isApproved) {
                        statusText = language === 'vi' ? 'ĐÃ DUYỆT ✓' : language === 'ja' ? '合格 ✓' : 'APPROVED ✓';
                      }

                      const isCompact = gridColumns !== 'auto';

                      return (
                        <div 
                          key={room.id} 
                          className={`room-card ${cardClass} ${room.isStay ? 'stay' : ''} ${room.isChecked ? 'checked' : ''} ${isCompact ? 'compact' : ''}`}
                          onClick={() => handleRoomCardClick(room)}
                          style={{ 
                            cursor: 'pointer',
                            position: 'relative',
                            border: isPending ? '2px dashed var(--status-dirty)' : undefined,
                            animation: isPending ? 'pulseBorder 2s infinite' : undefined
                          }}
                          title={room.notes ? `Notes: ${room.notes}` : undefined}
                        >
                          {isCompact ? (
                            <div className="room-card-compact-wrapper">
                              <div className="room-card-compact-row">
                                <span className="room-card-compact-number">{room.roomNumber}</span>
                              </div>
                              <div className="room-card-compact-guests">
                                <span className="room-card-compact-guests-icon">👤</span>
                                <span className="room-card-compact-guests-count">{room.guestCount}</span>
                                {room.notes && <span className="room-card-compact-note-icon" title={room.notes}>📝</span>}
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="stay-badge">{room.status === 'maintenance' ? 'Sửa' : room.status === 'vacant' ? 'Trống' : room.status === 'eco' ? 'ECO' : (room.status === 'dirty' || room.status === 'cleaning' || (room.isStay && room.status === 'occupied')) ? (room.isStay ? 'STAY' : 'OUT') : (room.status === 'dnd' || room.notes?.includes('Chỉ cần treo đồ')) ? 'DD' : room.isStay ? 'STAY' : 'OUT'}</span>
                              <div>
                                <div className="room-type-text">{room.type}</div>
                                <div className="room-number" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {room.roomNumber}
                                </div>
                              </div>

                              <div className="room-info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                                <span 
                                  className="room-status-text"
                                  style={{ fontSize: 'var(--room-type-font-size, 0.65rem)', fontWeight: 700, color: isApproved ? 'var(--status-clean)' : isPending ? 'var(--status-dirty)' : 'inherit' }}
                                >
                                  {statusText}
                                </span>
                                {room.cleanerName && (
                                  <span className="room-assignee" title={room.cleanerName}>
                                    👤 {room.cleanerName.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dots Indicator */}
          {fullscreenMode === 'single' && (
            <div className="fullscreen-floor-dots">
              {carouselSortedFloors.map((floorNum, idx) => (
                <span 
                  key={floorNum}
                  className={`dot ${idx === activeFloorIndex ? 'active' : ''}`}
                  onClick={() => setActiveFloorIndex(idx)}
                />
              ))}
            </div>
          )}

          {/* Running Clock / Date at the very bottom */}
          <div className="fullscreen-footer-clock">
            {getDisplayDateTime()}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckerDashboard;
