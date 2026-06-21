import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../Common/AppContext';
import { getTranslation } from '../../i18n/translations';
import { db } from '../../db/firebaseDB';
import type { Room } from '../../db/dbInterface';
import { Play, CheckCircle, Camera, Check, Sparkles, Filter, ClipboardList, AlertTriangle, Sun, Moon, LogOut, User, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getDateLockedMessage, isDateLockedError } from '../../utils/errors';

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

export interface HousekeepingDashboardProps {
  isNested?: boolean;
}

export const HousekeepingDashboard: React.FC<HousekeepingDashboardProps> = ({ isNested = false }) => {
  const { currentUser, language, addToast, activeDate, logout, darkMode, toggleDarkMode, setLanguage, hotelId, isLocked, selectHotel } = useApp();
  const [hasSchedule, setHasSchedule] = useState<boolean>(false);
  const [isCheckingSchedule, setIsCheckingSchedule] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(5);

  const isHousekeeper = currentUser?.role === 'housekeeping';

  // Poll schedule status for housekeeper
  useEffect(() => {
    if (!isHousekeeper || isNested || !currentUser || !hotelId) {
      setHasSchedule(true);
      setIsCheckingSchedule(false);
      return;
    }

    setCountdown(5);
    let isSubscribed = true;
    const checkSchedule = async () => {
      try {
        const activeStaff = await db.getActiveStaff(activeDate);
        if (isSubscribed) {
          const scheduled = activeStaff.includes(currentUser.id);
          setHasSchedule(scheduled);
          setIsCheckingSchedule(false);
        }
      } catch (e) {
        console.error('Failed to check housekeeper schedule:', e);
        if (isSubscribed) {
          setIsCheckingSchedule(false);
        }
      }
    };

    checkSchedule();
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          checkSchedule();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [hotelId, activeDate, currentUser, isHousekeeper, isNested]);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'mine'>('all');
  const [showLegend, setShowLegend] = useState(false);
  const [isFullScreenFloorView, setIsFullScreenFloorView] = useState(() => {
    return localStorage.getItem('hotel_clean_is_fullscreen_floor_view') === 'true';
  });
  const [activeFloorIndex, setActiveFloorIndex] = useState(() => {
    const stored = localStorage.getItem('hotel_clean_fullscreen_active_floor_index');
    return stored ? Number(stored) : 0;
  });
  const [gridColumns, setGridColumns] = useState<string>('6');
  const [fullscreenMode, setFullscreenMode] = useState<'single' | 'all' | 'custom'>(() => {
    return (localStorage.getItem('hotel_clean_fullscreen_mode') as 'single' | 'all' | 'custom') || 'single';
  });
  const [customSelectedFloors, setCustomSelectedFloors] = useState<number[]>(() => {
    const stored = localStorage.getItem('hotel_clean_fullscreen_custom_floors');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('hotel_clean_is_fullscreen_floor_view', isFullScreenFloorView ? 'true' : 'false');
  }, [isFullScreenFloorView]);

  useEffect(() => {
    localStorage.setItem('hotel_clean_fullscreen_mode', fullscreenMode);
  }, [fullscreenMode]);

  useEffect(() => {
    localStorage.setItem('hotel_clean_fullscreen_custom_floors', JSON.stringify(customSelectedFloors));
  }, [customSelectedFloors]);

  useEffect(() => {
    localStorage.setItem('hotel_clean_fullscreen_active_floor_index', String(activeFloorIndex));
  }, [activeFloorIndex]);

  // Swipe handlers for fullscreen floor carousel
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const current = e.changedTouches[0].clientX;
    const diff = touchStart - current;
    if (diff > 50) {
      setActiveFloorIndex(prev => Math.min(prev + 1, floors.length - 1));
    } else if (diff < -50) {
      setActiveFloorIndex(prev => Math.max(prev - 1, 0));
    }
    setTouchStart(null);
  };
  
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

  // Finish Cleaning Sheet/Modal State
  const [activeSheetRoom, setActiveSheetRoom] = useState<Room | null>(null);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [showSourceChoice, setShowSourceChoice] = useState(false);

  // Revert Clean Room Modal State
  const [selectedCleanRevertRoom, setSelectedCleanRevertRoom] = useState<Room | null>(null);

  const [activeHotel, setActiveHotel] = useState<any>(null);

  const showMutationError = (error: unknown, fallback: string) => {
    console.error(error);
    addToast(isDateLockedError(error) ? getDateLockedMessage(language) : fallback, 'warning');
  };

  useEffect(() => {
    db.setDate(activeDate);

    // Subscribe to rooms updates
    const unsubscribe = db.subscribeRooms((updatedRooms) => {
      setRooms(updatedRooms);
    });

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

    return () => unsubscribe();
  }, [hotelId, activeDate]);

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


  const handleFinishCleaningClick = (room: Room) => {
    setActiveSheetRoom(room);
    setNotes('');
    setPhoto(null);
    setCameraActive(false);
    setShowSourceChoice(false);
  };

  // Simulate camera snapshot using mock photo base64
  const triggerCameraMock = () => {
    setCameraActive(true);
    setShowSourceChoice(false);
    setTimeout(() => {
      // Return a simulated room photo (clean bathroom / room illustration)
      const mockPhotos = [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=400&q=80', // Bed clean
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80', // Clean bathroom
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=400&q=80'  // Bedroom
      ];
      const randomPhoto = mockPhotos[Math.floor(Math.random() * mockPhotos.length)];
      setPhoto(randomPhoto);
      setCameraActive(false);
      
      addToast(
        language === 'vi' ? 'Đã lấy ảnh mẫu!' : language === 'ja' ? 'デモ写真を使用しました！' : 'Demo photo applied!',
        'success'
      );
    }, 800);
  };

  const triggerRealCamera = () => {
    const fileInput = document.getElementById('camera-file-input');
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
      setPhoto(compressedBase64);
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

  const handleCameraBoxClick = () => {
    if (photo) {
      setPhoto(null);
      setShowSourceChoice(true);
    } else {
      setShowSourceChoice(true);
    }
  };

  const submitFinishedCleaning = async () => {
    if (!activeSheetRoom || !currentUser) return;
    try {
      const endedAt = new Date().toISOString();
      const durationMinutes = getTargetCleanMinutes(activeSheetRoom.type);
      const startedAt = new Date(Date.now() - durationMinutes * 60000).toISOString();
      
      // 1. Create a cleaning report log entry
      await db.createLog({
        roomId: activeSheetRoom.id,
        roomNumber: activeSheetRoom.roomNumber,
        floor: activeSheetRoom.floor,
        cleanerId: currentUser.id,
        cleanerName: currentUser.name,
        startedAt,
        endedAt,
        durationMinutes,
        notes: notes || 'Cleaned & inspected',
        photoAfter: photo || undefined
      });

      // 2. Mark room status as clean/ready
      await db.updateRoomStatus(activeSheetRoom.id, 'clean', currentUser.name, currentUser.id, currentUser.name);

      // Trigger success celebration effect!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      addToast(getTranslation(language, 'successClean'), 'success');
      
      setActiveSheetRoom(null);
    } catch (e) {
      showMutationError(e, 'Error finishing cleaning report');
    }
  };

  const submitHangingDNDOnly = async () => {
    if (!activeSheetRoom || !currentUser) return;
    try {
      const endedAt = new Date().toISOString();
      const durationMinutes = getTargetCleanMinutes(activeSheetRoom.type);
      const startedAt = new Date(Date.now() - durationMinutes * 60000).toISOString();
      
      // 1. Create a cleaning report log entry
      await db.createLog({
        roomId: activeSheetRoom.id,
        roomNumber: activeSheetRoom.roomNumber,
        floor: activeSheetRoom.floor,
        cleanerId: currentUser.id,
        cleanerName: currentUser.name,
        startedAt,
        endedAt,
        durationMinutes,
        notes: notes ? notes + ' - Chỉ cần treo đồ (DND)' : 'Chỉ cần treo đồ (DND)',
        photoAfter: photo || undefined
      });

      // 2. Mark room status as clean with note reflecting DND hanging
      await db.updateRoom({
        ...activeSheetRoom,
        status: 'clean',
        isChecked: false,
        checkedBy: undefined,
        checkedAt: undefined,
        photoDefect: undefined,
        notes: activeSheetRoom.notes ? activeSheetRoom.notes + ' - Chỉ cần treo đồ (DND)' : 'Chỉ cần treo đồ (DND)',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        assignedTo: currentUser.id,
        cleanerName: currentUser.name
      });

      // Trigger success celebration effect!
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
      
      setActiveSheetRoom(null);
    } catch (e) {
      showMutationError(e, 'Error saving report');
    }
  };

  const submitDNDRoom = async () => {
    if (!activeSheetRoom || !currentUser) return;
    try {
      const endedAt = new Date().toISOString();
      const durationMinutes = 0;
      const startedAt = endedAt;
      
      await db.createLog({
        roomId: activeSheetRoom.id,
        roomNumber: activeSheetRoom.roomNumber,
        floor: activeSheetRoom.floor,
        cleanerId: currentUser.id,
        cleanerName: currentUser.name,
        startedAt,
        endedAt,
        durationMinutes,
        notes: notes ? notes + ' - Khách treo DND (DD)' : 'Khách treo DND (DD)',
        photoAfter: photo || undefined
      });

      await db.updateRoom({
        ...activeSheetRoom,
        status: 'dnd',
        isChecked: false,
        checkedBy: undefined,
        checkedAt: undefined,
        photoDefect: undefined,
        notes: activeSheetRoom.notes ? activeSheetRoom.notes + ' - Khách treo DND (DD)' : 'Khách treo DND (DD)',
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
      
      setActiveSheetRoom(null);
    } catch (e) {
      showMutationError(e, 'Error saving DND room status');
    }
  };






  const handleRevertCleanToDirty = async (room: Room) => {
    const canRevert = 
      currentUser?.role === 'admin' || 
      currentUser?.role === 'kacho' || 
      currentUser?.role === 'checka' || 
      (!room.isChecked && 
        (room.assignedTo === currentUser?.id || 
         (room.cleanerName && room.cleanerName === currentUser?.name)));

    if (!canRevert) {
      addToast(
        language === 'vi'
          ? 'Bạn không có quyền hủy trạng thái dọn sạch của phòng này.'
          : language === 'ja'
            ? 'この部屋の清掃完了ステータスを取り消す権限がありません。'
            : 'You do not have permission to revert the clean status of this room.',
        'warning'
      );
      return;
    }

    try {
      await db.updateRoomStatus(room.id, 'dirty', currentUser?.name || 'System', '', '');
      addToast(
        language === 'vi' 
          ? `Đã chuyển phòng ${room.roomNumber} về trạng thái cần dọn`
          : language === 'ja'
            ? `部屋 ${room.roomNumber} を要清掃ステータスに戻しました`
            : `Reverted room ${room.roomNumber} to dirty status`,
        'success'
      );
      setSelectedCleanRevertRoom(null);
    } catch (e) {
      showMutationError(e, 'Error updating status');
    }
  };

  const handleRevertDNDToStay = async (room: Room) => {
    const canRevert = 
      currentUser?.role === 'admin' || 
      currentUser?.role === 'kacho' || 
      currentUser?.role === 'checka' || 
      (!room.isChecked && 
        (room.assignedTo === currentUser?.id || 
         (room.cleanerName && room.cleanerName === currentUser?.name)));

    if (!canRevert) {
      addToast(
        language === 'vi'
          ? 'Bạn không có quyền hủy trạng thái dọn sạch của phòng này.'
          : language === 'ja'
            ? 'この部屋の清掃完了ステータスを取り消す権限がありません。'
            : 'You do not have permission to revert the clean status of this room.',
        'warning'
      );
      return;
    }

    try {
      const cleanedNotes = (room.notes || '')
        .replace(' - Chỉ cần treo đồ (DND)', '')
        .replace('Chỉ cần treo đồ (DND)', '')
        .trim();

      await db.updateRoom({
        ...room,
        status: 'occupied',
        isChecked: false,
        notes: cleanedNotes || undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || 'System',
        assignedTo: currentUser?.id || '',
        cleanerName: currentUser?.name || ''
      });

      addToast(
        language === 'vi' 
          ? `Đã chuyển phòng ${room.roomNumber} về phòng STAY cần dọn.` 
          : language === 'ja'
            ? `部屋 ${room.roomNumber} を連泊要清掃に戻しました。`
            : `Reverted room ${room.roomNumber} to STAY.`,
        'success'
      );
      setSelectedCleanRevertRoom(null);
    } catch (e) {
      showMutationError(e, 'Error reverting room');
    }
  };


  const handleRoomCardClick = (room: Room) => {
    if (room.status === 'dirty' || room.status === 'eco' || room.status === 'cleaning' || (room.isStay && room.status === 'occupied')) {
      handleFinishCleaningClick(room);
    } else if (room.status === 'clean') {
      setSelectedCleanRevertRoom(room);
    }
  };

  // Filter and search logic
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesFloor = floorFilter === 'all' || room.floor.toString() === floorFilter;
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
      const matchesAssigned = assignedFilter === 'all' || (assignedFilter === 'mine' && room.assignedTo === currentUser?.id && (room.status === 'clean' || room.status === 'dnd'));
      return matchesFloor && matchesStatus && matchesAssigned;
    });
  }, [rooms, floorFilter, statusFilter, assignedFilter, currentUser]);

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

  // Metrics
  const { totalRooms, dirtyRooms, cleanRooms, myCleaningRooms } = useMemo(() => {
    return {
      totalRooms: rooms.length,
      dirtyRooms: rooms.filter(r => r.status === 'dirty').length,
      cleanRooms: rooms.filter(r => r.status === 'clean').length,
      myCleaningRooms: rooms.filter(r => (r.status === 'clean' || r.status === 'dnd') && r.assignedTo === currentUser?.id).length
    };
  }, [rooms, currentUser]);

  const floors = useMemo(() => {
    return Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  }, [rooms]);

  useEffect(() => {
    if (floors.length > 0 && customSelectedFloors.length === 0) {
      setCustomSelectedFloors(floors);
    }
  }, [floors]);

  const renderLayout = (content: React.ReactNode) => {
    if (isNested) {
      return content;
    }
    return (
      <div className="main-content">
        <div className="dashboard-layout">
          <aside className="sidebar-menu mobile-only-sidebar glass-panel">
          <div className="sidebar-mobile-actions" style={{ marginTop: '0' }}>
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
                  <User size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{currentUser?.name}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                    {currentUser?.role === 'admin' ? getTranslation(language, 'roleAdmin') :
                     currentUser?.role === 'front_desk' ? getTranslation(language, 'roleFrontDesk') :
                     currentUser?.role === 'checka' ? getTranslation(language, 'roleChecker') :
                     currentUser?.role === 'kacho' ? getTranslation(language, 'roleKacho') :
                     currentUser?.role === 'housekeeping' ? getTranslation(language, 'roleHousekeeping') : currentUser?.role}
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
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  backgroundColor: 'rgba(0,0,0,0.03)', 
                  padding: '0.35rem 0.75rem', 
                  borderRadius: '20px', 
                  border: '1px solid rgba(0,0,0,0.05)',
                  cursor: 'default',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  userSelect: 'none'
                }}
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
        {content}
      </div>
    </div>
  );
};

  if (isHousekeeper && !isNested && isCheckingSchedule) {
    return renderLayout(
      <main className="dashboard-content-panel" style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', width: '100%', gap: '1rem' }}>
          <div className="animate-spin" style={{ fontSize: '2rem' }}>⏳</div>
          <p style={{ opacity: 0.8, fontSize: '0.95rem', fontWeight: 600 }}>
            {language === 'vi' ? 'Đang kiểm tra lịch làm việc...' : language === 'ja' ? 'シフト確認中...' : 'Checking schedule...'}
          </p>
        </div>
      </main>
    );
  }

  if (isHousekeeper && !isNested && !hasSchedule) {
    return renderLayout(
      <main className="dashboard-content-panel" style={{ width: '100%' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh', 
          width: '100%',
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div className="glass-panel" style={{ 
            maxWidth: '480px', 
            width: '100%', 
            padding: '2.5rem 2rem', 
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              color: 'var(--status-cleaning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem'
            }}>
              🛎️
            </div>
            
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>
                {language === 'vi' ? 'Phòng Chờ Nhân Sự' : language === 'ja' ? 'スタッフ控室' : 'Staff Waiting Room'}
              </h2>
              <p style={{ fontSize: '0.9rem', opacity: 0.6, fontWeight: 700, margin: 0 }}>
                🏨 {activeHotel ? activeHotel.name : hotelId}
              </p>
            </div>

            <div style={{ 
              backgroundColor: 'rgba(0,0,0,0.02)', 
              padding: '1rem', 
              borderRadius: '8px', 
              border: '1px solid rgba(0,0,0,0.05)',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              color: 'var(--text-color)'
            }}>
              {language === 'vi' ? (
                <>
                  <p style={{ margin: '0 0 0.5rem 0' }}>Bạn hiện chưa có lịch phân công dọn phòng tại khách sạn này hôm nay.</p>
                  <strong style={{ color: 'var(--status-clean)' }}>Vui lòng đợi quản lý hoặc lễ tân thêm bạn vào danh sách phân công dọn dẹp.</strong>
                </>
              ) : language === 'ja' ? (
                <>
                  <p style={{ margin: '0 0 0.5rem 0' }}>本日、このホテルでの清掃シフトがまだ割り当てられていません。</p>
                  <strong style={{ color: 'var(--status-clean)' }}>管理者が清掃割り当てリストにあなたを追加するまでお待ちください。</strong>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.5rem 0' }}>You do not have a cleaning assignment for this hotel today yet.</p>
                  <strong style={{ color: 'var(--status-clean)' }}>Please wait for the manager or front desk to assign your schedule.</strong>
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
              <span className="animate-pulse" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-clean)' }}></span>
              <span>
                {language === 'vi' 
                  ? `Đang tự động kiểm tra lại sau ${countdown} giây...` 
                  : language === 'ja' 
                    ? `あと ${countdown} 秒後に自動チェック中...` 
                    : `Checking again in ${countdown} seconds...`}
              </span>
            </div>

            <button 
              type="button" 
              className="btn btn-secondary w-full"
              onClick={() => selectHotel('portal')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.5rem', 
                padding: '0.6rem',
                fontWeight: 600
              }}
            >
              <span>🚪</span>
              {language === 'vi' ? 'Quay lại cổng chọn khách sạn' : language === 'ja' ? 'ホテル選択に戻る' : 'Back to Hotel Selection'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return renderLayout(
    <main className="dashboard-content-panel" style={isNested ? { padding: '1rem 0' } : undefined}>
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
          {!isNested && (
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              {getTranslation(language, 'hkDashboard')}
            </h2>
          )}

      {/* Metrics Row */}
      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="metric-value">{totalRooms}</div>
            <div className="metric-label">{getTranslation(language, 'statsTotalRooms')}</div>
          </div>
        </div>

        <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-dirty)' }}>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-dirty)' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>DRY</span>
          </div>
          <div>
            <div className="metric-value">{dirtyRooms}</div>
            <div className="metric-label">{getTranslation(language, 'statsDirtyRooms')}</div>
          </div>
        </div>

        <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-clean)' }}>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)' }}>
            <CheckCircle size={20} style={{ color: 'var(--status-clean)' }} />
          </div>
          <div>
            <div className="metric-value">{cleanRooms}</div>
            <div className="metric-label">{getTranslation(language, 'statsCleanRooms')}</div>
          </div>
        </div>
      </div>

      {/* Housekeeping Filters */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Toggle List: Mine vs All */}
        <div style={{ display: 'flex', flex: 1, minWidth: '240px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-sm)', padding: '0.2rem' }}>
          <button
            className="btn btn-sm"
            style={{ 
              flex: 1, 
              backgroundColor: assignedFilter === 'all' ? 'var(--primary-color)' : 'transparent',
              color: assignedFilter === 'all' ? 'white' : 'inherit',
              padding: '0.4rem'
            }}
            onClick={() => setAssignedFilter('all')}
          >
            {getTranslation(language, 'all')} ({totalRooms})
          </button>
          <button
            className="btn btn-sm"
            style={{ 
              flex: 1, 
              backgroundColor: assignedFilter === 'mine' ? 'var(--primary-color)' : 'transparent',
              color: assignedFilter === 'mine' ? 'white' : 'inherit',
              padding: '0.4rem'
            }}
            onClick={() => setAssignedFilter('mine')}
          >
            {getTranslation(language, 'assignedToMe')} ({myCleaningRooms})
          </button>
        </div>

        {/* Floor Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}><Filter size={14} style={{ display: 'inline', marginRight: '4px' }} />{getTranslation(language, 'filterFloor')}:</label>
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

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getTranslation(language, 'filterStatus')}:</label>
          <select 
            className="form-input" 
            style={{ width: '160px', padding: '0.4rem 0.75rem' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">{getTranslation(language, 'all')}</option>
            <option value="dirty">{getTranslation(language, 'statusDirty')}</option>
            <option value="clean">{getTranslation(language, 'statusClean')}</option>
            <option value="vacant">{language === 'vi' ? 'Trống (Vacant)' : language === 'ja' ? '空室 (Vacant)' : 'Vacant'}</option>
            <option value="occupied">{getTranslation(language, 'statusOccupied')}</option>
            <option value="maintenance">{getTranslation(language, 'statusMaintenance')}</option>
          </select>
        </div>

        {/* Full screen button */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
              const initialFloor = floorFilter !== 'all' ? Number(floorFilter) : floors[0] || 0;
              const idx = floors.indexOf(initialFloor);
              setActiveFloorIndex(idx !== -1 ? idx : 0);
              setIsFullScreenFloorView(true);
            }}
            disabled={floors.length === 0}
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

      {/* Floor Grid View */}
      {Object.keys(roomsByFloor).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', opacity: 0.6 }} className="glass-panel">
          <Sparkles size={32} style={{ color: 'var(--status-clean)', marginBottom: '0.75rem' }} />
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

                <div className="room-grid">
                  {floorRooms
                    .sort((a: Room, b: Room) => {
                      const priorityA = a.priority === 'rush' ? 0 : 1;
                      const priorityB = b.priority === 'rush' ? 0 : 1;
                      if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                      }
                      return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
                    })
                    .map((room: Room) => {
                      const isDirty = room.status === 'dirty';
                      
                      const guestLabel = language === 'vi' 
                        ? `Set: ${room.guestCount} người` 
                        : language === 'ja' 
                          ? `セット: ${room.guestCount}人` 
                          : `Set: ${room.guestCount} Pax`;

                      const isEco = room.status === 'eco';
                      // Determine cursor style
                      const isClickable = !isLocked && (isDirty || isEco || room.status === 'cleaning' || room.status === 'clean' || (room.isStay && room.status === 'occupied'));

                      return (
                        <div 
                          key={room.id} 
                          className={`room-card ${room.status} ${room.isStay ? 'stay' : ''} ${room.isChecked ? 'checked' : ''} ${isClickable ? 'clickable' : ''}`}
                          onClick={() => isClickable && handleRoomCardClick(room)}
                          style={{ 
                            cursor: isClickable ? 'pointer' : 'default',
                            position: 'relative'
                          }}
                          title={room.notes ? `Ghi chú: ${room.notes}` : undefined}
                        >
                          <span className="stay-badge">{room.status === 'maintenance' ? 'Sửa' : room.status === 'vacant' ? 'Trống' : room.status === 'eco' ? 'ECO' : (room.status === 'dirty' || room.status === 'cleaning' || (room.isStay && room.status === 'occupied')) ? (room.isStay ? 'STAY' : 'OUT') : (room.status === 'dnd' || room.notes?.includes('Chỉ cần treo đồ')) ? 'DD' : room.isStay ? 'STAY' : 'OUT'}</span>
                          <div>
                            <div className="room-type-text">{getFormattedRoomType(room.type)}</div>
                            <div className="room-number" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                              {room.roomNumber}
                              {room.priority === 'rush' && (
                                <span className="priority-rush-badge animate-pulse" style={{
                                  fontSize: '0.5rem',
                                  fontWeight: 800,
                                  color: '#ffffff',
                                  backgroundColor: '#ef4444',
                                  padding: '0.1rem 0.25rem',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.1rem',
                                  boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)'
                                }}>
                                  ⚡ RUSH
                                </span>
                              )}
                              {(isDirty || isEco) && <Play size={14} style={isEco ? { color: 'var(--status-eco)' } : { color: 'var(--status-dirty)' }} fill={isEco ? 'var(--status-eco)' : 'var(--status-dirty)'} />}
                              {room.notes && <AlertTriangle size={14} style={{ color: 'var(--status-maintenance)' }} className="animate-pulse" />}
                            </div>
                          </div>

                          {/* Bottom info row */}
                          <div className="room-info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                            <span className="room-guest-count">
                              ※ {guestLabel}
                            </span>
                            {room.status === 'clean' && room.cleanerName && (
                              <span className="room-assignee" title={room.cleanerName}>
                                👤 {room.cleanerName.split(' ')[0]}
                              </span>
                            )}
                          </div>

                          {room.notes && (
                            <div style={{ 
                              fontSize: '0.65rem', 
                              opacity: 0.9, 
                              maxWidth: '100%', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap', 
                              marginTop: '0.25rem', 
                              borderTop: '1px dashed rgba(0,0,0,0.1)', 
                              paddingTop: '0.25rem', 
                              textAlign: 'left',
                              color: 'var(--status-maintenance)',
                              fontWeight: 700
                            }}>
                              ⚠️ {room.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })
      )}



      {/* Revert Clean Confirmation Modal */}
      {selectedCleanRevertRoom && (() => {
        const canRevert = 
          currentUser?.role === 'admin' || 
          currentUser?.role === 'kacho' || 
          currentUser?.role === 'checka' || 
          (!selectedCleanRevertRoom.isChecked && 
            (selectedCleanRevertRoom.assignedTo === currentUser?.id || 
             (selectedCleanRevertRoom.cleanerName && selectedCleanRevertRoom.cleanerName === currentUser?.name)));

        return (
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ maxWidth: '420px' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-maintenance)' }}>
                <AlertTriangle size={20} className="animate-pulse" />
                {language === 'vi' ? 'Hủy trạng thái dọn sạch' : language === 'ja' ? '清掃完了の取り消し' : 'Revert Clean Status'}
              </h3>
              
              <p className="modal-description">
                {language === 'vi' 
                  ? `Phòng ${selectedCleanRevertRoom.roomNumber} đã được báo dọn sạch. Bạn muốn chuyển phòng này về trạng thái nào?`
                  : language === 'ja'
                    ? `部屋 ${selectedCleanRevertRoom.roomNumber} は清掃完了と報告されています。どのステータスに戻しますか？`
                    : `Room ${selectedCleanRevertRoom.roomNumber} is marked as clean. Which status do you want to revert it to?`}
              </p>

              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem', 
                margin: '1.25rem 0', 
                padding: '0.75rem', 
                backgroundColor: 'var(--panel-bg-subtle)', 
                borderRadius: 'var(--radius-sm)', 
                border: '1px solid var(--border-color)', 
                fontSize: '0.85rem', 
                textAlign: 'left' 
              }}>
                <div>
                  <strong>{language === 'vi' ? '👤 Nhân viên dọn:' : language === 'ja' ? '👤 清掃担当:' : '👤 Cleaner:'}</strong>{' '}
                  {selectedCleanRevertRoom.cleanerName || 'N/A'}
                </div>
                <div>
                  <strong>{language === 'vi' ? '🕒 Giờ hoàn thành:' : language === 'ja' ? '🕒 完了時間:' : '🕒 Completion Time:'}</strong>{' '}
                  {selectedCleanRevertRoom.updatedAt ? new Date(selectedCleanRevertRoom.updatedAt).toLocaleTimeString() : 'N/A'}
                </div>
                <div>
                  <strong>{language === 'vi' ? '📝 Ghi chú NV:' : language === 'ja' ? '📝 清掃員メモ:' : '📝 Cleaner Notes:'}</strong>{' '}
                  {selectedCleanRevertRoom.notes || 'N/A'}
                </div>
                <div style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                  <strong>{language === 'vi' ? '🔍 Người kiểm tra (Check):' : language === 'ja' ? '🔍 検査担当:' : '🔍 Checked By:'}</strong>{' '}
                  {selectedCleanRevertRoom.checkedBy || (language === 'vi' ? 'Chưa kiểm tra' : language === 'ja' ? '未検査' : 'Pending')}
                  {selectedCleanRevertRoom.checkedBy && selectedCleanRevertRoom.checkedAt && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '0.25rem' }}>
                      ({new Date(selectedCleanRevertRoom.checkedAt).toLocaleTimeString()})
                    </span>
                  )}
                </div>
                {selectedCleanRevertRoom.isChecked && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <strong>{language === 'vi' ? 'Đã xem ghi chú của người dọn:' : language === 'ja' ? '清掃員メモ確認済:' : 'Viewed cleaner notes:'}</strong>{' '}
                      {selectedCleanRevertRoom.viewedCleanerNotes ? (
                        <span style={{ color: 'var(--status-clean)', fontWeight: 'bold' }}>☑ {language === 'vi' ? 'Đã xem' : '確認済'}</span>
                      ) : (
                        <span style={{ opacity: 0.6 }}>☐ {language === 'vi' ? 'Chưa xem' : '未確認'}</span>
                      )}
                    </div>
                    <div>
                      <strong>{language === 'vi' ? 'Ghi chú sự cố / kiểm phòng:' : language === 'ja' ? '指摘/異常報告メモ:' : 'Incident / Inspection Notes:'}</strong>{' '}
                      <span style={{ color: 'var(--status-maintenance)', fontWeight: 600 }}>{selectedCleanRevertRoom.checkerNotes || (language === 'vi' ? 'Không có ghi chú sự cố' : language === 'ja' ? '指摘なし' : 'None')}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Warning Message if Cannot Revert */}
              {!canRevert && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                  margin: '1.25rem 0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <div>
                    {selectedCleanRevertRoom.isChecked ? (
                      language === 'vi' 
                        ? 'Phòng này đã được nghiệm thu (Check). Bạn không thể quay lại trạng thái cần dọn. Chỉ có Checker, Kacho hoặc Admin mới có quyền thực hiện.'
                        : language === 'ja'
                          ? 'この客室はすでに検査済みです。要清掃ステータスに戻すことはできません。検査担当、Kacho、またはAdminのみが実行できます。'
                          : 'This room is already checked/approved. You cannot revert it to dirty. Only Checker, Kacho, or Admin can perform this action.'
                    ) : (
                      language === 'vi'
                        ? 'Bạn không được phân công dọn phòng này. Chỉ có nhân viên dọn phòng đó, Checker, Kacho hoặc Admin mới có thể quay lại trạng thái cần dọn.'
                        : language === 'ja'
                          ? 'この客室の清掃担当ではありません。担当の清掃員、検査担当、Kacho、またはAdminのみが要清掃に戻すことができます。'
                          : 'You are not assigned to clean this room. Only the assigned cleaner, Checker, Kacho, or Admin can revert its status.'
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                {canRevert ? (
                  <>
                    {selectedCleanRevertRoom.isStay && selectedCleanRevertRoom.notes?.includes('Chỉ cần treo đồ') ? (
                      <button 
                        type="button" 
                        className="btn btn-warning"
                        style={{ justifyContent: 'center', backgroundColor: '#f97316', color: 'white' }}
                        onClick={() => handleRevertDNDToStay(selectedCleanRevertRoom)}
                      >
                        🔁 {language === 'vi' ? 'Quay lại phòng STAY cần dọn' : language === 'ja' ? '連泊要清掃に戻す' : 'Revert to STAY (Dirty)'}
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="btn btn-danger"
                        style={{ justifyContent: 'center' }}
                        onClick={() => handleRevertCleanToDirty(selectedCleanRevertRoom)}
                      >
                        🚪 {language === 'vi' ? 'Quay lại "Cần dọn" (Chờ dọn)' : language === 'ja' ? '「要清掃」に戻す' : 'Revert to "Dirty"'}
                      </button>
                    )}
                    
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      style={{ justifyContent: 'center', marginTop: '0.5rem' }}
                      onClick={() => setSelectedCleanRevertRoom(null)}
                    >
                      {getTranslation(language, 'cancel')}
                    </button>
                  </>
                ) : (
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => setSelectedCleanRevertRoom(null)}
                  >
                    {language === 'vi' ? 'Đóng' : language === 'ja' ? '閉じる' : 'Close'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Finish Cleaning Bottom-Sheet / Dialog Panel */}
      {activeSheetRoom && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '440px' }}>
            <h3 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {getTranslation(language, 'cleaningSummary')} - Room {activeSheetRoom.roomNumber}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: 'var(--panel-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem', textAlign: 'left' }}>
              <div>
                <strong>{language === 'vi' ? 'Kiểu phòng:' : language === 'ja' ? '部屋タイプ:' : 'Room Type:'}</strong> {getFormattedRoomType(activeSheetRoom.type)} - {activeSheetRoom.floor}F
              </div>
              <div>
                <strong>{language === 'vi' ? 'Số khách dọn (Set):' : language === 'ja' ? '設定人数:' : 'Guests Count (Set):'}</strong> {activeSheetRoom.guestCount} {language === 'vi' ? 'người' : language === 'ja' ? '人' : 'Pax'}
              </div>
            </div>

            {activeSheetRoom.notes && (
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
                  {activeSheetRoom.notes}
                </p>
              </div>
            )}

            {activeSheetRoom.photoDefect && (
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
                  src={activeSheetRoom.photoDefect} 
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
            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'uploadPhoto')}</label>
              
              <input
                type="file"
                id="camera-file-input"
                style={{ display: 'none' }}
                accept="image/*"
                capture="environment"
                onChange={handleImageFileChange}
              />
              
              <div className="camera-box" onClick={handleCameraBoxClick}>
                {cameraActive ? (
                  <div style={{ textAlign: 'center' }}>
                    <div className="animate-spin" style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.85rem' }}>{getTranslation(language, 'loading')}</p>
                  </div>
                ) : photo ? (
                  <>
                    <img src={photo} alt="Verification Preview" className="camera-preview" />
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
            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'notes')}</label>
              <textarea
                className="form-input"
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={getTranslation(language, 'notesPlaceholder')}
              />
            </div>

            {/* Quick tag actions for notes */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => setNotes(prev => (prev ? prev + ', ' : '') + (language === 'ja' ? '忘れ物あり' : language === 'vi' ? 'Có đồ để quên' : 'Lost & Found item found'))}
              >
                🎒 {language === 'ja' ? '忘れ物' : 'Đồ để quên'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => setNotes(prev => (prev ? prev + ', ' : '') + (language === 'ja' ? '設備破損あり' : language === 'vi' ? 'Hỏng hóc thiết bị' : 'Maintenance issue'))}
              >
                🛠️ {language === 'ja' ? '設備破損' : 'Thiết bị hỏng'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => setNotes(prev => (prev ? prev + ', ' : '') + (language === 'ja' ? 'シーツ交換完了' : language === 'vi' ? 'Đã thay drap giường' : 'Bed sheets replaced'))}
              >
                🛏️ {language === 'ja' ? 'シーツ交換' : 'Thay drap'}
              </button>
            </div>

            {/* Action buttons */}
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setActiveSheetRoom(null)}
              >
                {getTranslation(language, 'cancel')}
              </button>
              {activeSheetRoom.isStay && (
                <>
                  <button
                    type="button"
                    className="btn"
                    style={{ backgroundColor: '#f97316', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={submitHangingDNDOnly}
                  >
                    <Sparkles size={18} />
                    {language === 'vi' ? 'Chỉ cần treo đồ' : language === 'ja' ? 'アメニティ吊り下げのみ' : 'Hang items only'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ backgroundColor: '#64748b', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={submitDNDRoom}
                  >
                    <AlertTriangle size={18} />
                    {language === 'vi' ? 'Trở thành phòng DD' : language === 'ja' ? 'DND部屋にする' : 'Make DD Room'}
                  </button>
                </>
              )}
              <button 
                type="button" 
                className="btn"
                style={{ backgroundColor: 'var(--status-clean)', color: 'white' }}
                onClick={submitFinishedCleaning}
              >
                <Check size={18} />
                {language === 'vi' ? 'Dọn xong ✓' : language === 'ja' ? '清掃完了 ✓' : 'Finish Clean ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN FLOOR CAROUSEL VIEW */}
      {isFullScreenFloorView && floors.length > 0 && (
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
                    value={floors[activeFloorIndex]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const idx = floors.indexOf(val);
                      if (idx !== -1) setActiveFloorIndex(idx);
                    }}
                  >
                    {floors.map(floorNum => (
                      <option key={floorNum} value={floorNum}>
                        {language === 'vi' ? `Tầng ${floorNum}` : language === 'ja' ? `${floorNum}階` : `Floor ${floorNum}`}
                      </option>
                    ))}
                  </select>

                  <button 
                    type="button"
                    className="btn btn-outline btn-icon"
                    style={{ padding: '0.4rem', display: 'flex', alignItems: 'center' }}
                    onClick={() => setActiveFloorIndex(prev => Math.min(prev + 1, floors.length - 1))}
                    disabled={activeFloorIndex === floors.length - 1}
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
                  {floors.map(floorNum => {
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
              ? floors
              : fullscreenMode === 'custom'
                ? customSelectedFloors
                : [floors[activeFloorIndex]]) as number[]).map((floorNum) => {
              const floorRooms = (roomsByFloor[floorNum] || [])
                .sort((a, b) => {
                  const priorityA = a.priority === 'rush' ? 0 : 1;
                  const priorityB = b.priority === 'rush' ? 0 : 1;
                  if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                  }
                  return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
                });
              
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
                      const isDirty = room.status === 'dirty';
                      
                      const guestLabel = language === 'vi' 
                        ? `Set: ${room.guestCount} người` 
                        : language === 'ja' 
                          ? `セット: ${room.guestCount}人` 
                          : `Set: ${room.guestCount} Pax`;

                      const isEco = room.status === 'eco';
                      const isClean = room.status === 'clean';
                      const isPending = isClean && !room.isChecked;
                      const isApproved = isClean && !!room.isChecked;

                      let statusText = room.status.toUpperCase();
                      if (isPending) {
                        statusText = language === 'vi' ? 'CHỜ DUYỆT 🔍' : language === 'ja' ? '要検査 🔍' : 'PENDING 🔍';
                      } else if (isApproved) {
                        statusText = language === 'vi' ? 'ĐÃ DUYỆT ✓' : language === 'ja' ? '合格 ✓' : 'APPROVED ✓';
                      } else if (room.status === 'dirty') {
                        statusText = language === 'vi' ? 'CẦN DỌN' : language === 'ja' ? '要清掃' : 'DIRTY';
                      }

                      const isClickable = !isLocked && (isDirty || isEco || room.status === 'cleaning' || room.status === 'clean' || (room.isStay && room.status === 'occupied'));

                      return (
                        <div 
                          key={room.id} 
                          className={`room-card ${room.status} ${room.isStay ? 'stay' : ''} ${room.isChecked ? 'checked' : ''} ${gridColumns !== 'auto' ? 'compact' : ''} ${isClickable ? 'clickable' : ''}`}
                          onClick={() => isClickable && handleRoomCardClick(room)}
                          style={{ 
                            cursor: isClickable ? 'pointer' : 'default',
                            position: 'relative'
                          }}
                          title={room.notes ? `Ghi chú: ${room.notes}` : undefined}
                        >
                          {gridColumns === 'auto' ? (
                            <>
                              <span className="stay-badge">{room.status === 'maintenance' ? 'Sửa' : room.status === 'vacant' ? 'Trống' : room.status === 'eco' ? 'ECO' : (room.status === 'dirty' || room.status === 'cleaning' || (room.isStay && room.status === 'occupied')) ? (room.isStay ? 'STAY' : 'OUT') : (room.status === 'dnd' || room.notes?.includes('Chỉ cần treo đồ')) ? 'DD' : room.isStay ? 'STAY' : 'OUT'}</span>
                              <div>
                                <div className="room-type-text">{getFormattedRoomType(room.type)}</div>
                                <div className="room-number" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                  {room.roomNumber}
                                  {room.priority === 'rush' && (
                                    <span className="priority-rush-badge animate-pulse" style={{
                                      fontSize: '0.5rem',
                                      fontWeight: 800,
                                      color: '#ffffff',
                                      backgroundColor: '#ef4444',
                                      padding: '0.1rem 0.25rem',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.1rem',
                                      boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)'
                                    }}>
                                      ⚡ RUSH
                                    </span>
                                  )}
                                  {(isDirty || isEco) && <Play size={14} style={isEco ? { color: 'var(--status-eco)' } : { color: 'var(--status-dirty)' }} fill={isEco ? 'var(--status-eco)' : 'var(--status-dirty)'} />}
                                  {room.notes && <AlertTriangle size={14} style={{ color: 'var(--status-maintenance)' }} className="animate-pulse" />}
                                </div>
                              </div>

                              <div className="room-info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                                <span className="room-guest-count" style={{ fontSize: '0.65rem', fontWeight: 600 }}>
                                  ※ {guestLabel}
                                </span>
                                <span 
                                  className="room-status-text"
                                  style={{ 
                                    fontSize: '0.65rem', 
                                    fontWeight: 700, 
                                    color: isApproved ? 'var(--status-clean)' : isPending ? 'var(--status-dirty)' : 'inherit',
                                    opacity: 0.8
                                  }}
                                >
                                  {statusText}
                                </span>
                                {room.status === 'clean' && room.cleanerName && (
                                  <span className="room-assignee" title={room.cleanerName}>
                                    👤 {room.cleanerName.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
};

export default HousekeepingDashboard;
