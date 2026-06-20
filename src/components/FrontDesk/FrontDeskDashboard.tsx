import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../Common/AppContext';
import { getTranslation } from '../../i18n/translations';
import { db } from '../../db/firebaseDB';
import type { Room, User, CleaningLog } from '../../db/dbInterface';
import { Search, Volume2, VolumeX, CheckCircle2, Info, Play, CheckCircle, AlertTriangle, Hotel, Users, LayoutDashboard, Clock, Building, Sun, Moon, LogOut, User as UserIcon, LayoutGrid, List, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';

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

export const FrontDeskDashboard: React.FC = () => {
  const { currentUser, language, addToast, triggerSoundAlert, activeDate, logout, darkMode, toggleDarkMode, setLanguage } = useApp();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
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
  
  // Room Setup Modal State
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomLog, setRoomLog] = useState<CleaningLog | null>(null);
  const [recleanReason, setRecleanReason] = useState('');
  const [showRecleanInput, setShowRecleanInput] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  // Defect checklist states
  const [defectFloor, setDefectFloor] = useState(false);
  const [defectAmenities, setDefectAmenities] = useState(false);
  const [defectBathroom, setDefectBathroom] = useState(false);
  const [defectBed, setDefectBed] = useState(false);
  const [defectTrash, setDefectTrash] = useState(false);
  const [defectDust, setDefectDust] = useState(false);
  const [defectOther, setDefectOther] = useState(false);
  const [defectOtherText, setDefectOtherText] = useState('');
  const [setupForm, setSetupForm] = useState({
    status: 'vacant' as Room['status'],
    isStay: false,
    guestCount: 0,
    notes: ''
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cleaners, setCleaners] = useState<User[]>([]);
  const [activeStaffIds, setActiveStaffIds] = useState<string[]>([]);
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
  const [activeTab, setActiveTab] = useState<'stats' | 'grid' | 'staff'>(() => {
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    const isKacho = currentUser?.role === 'kacho';
    const defaultTab = isKacho ? 'stats' : 'grid';
    const validTabs = ['stats', 'grid', 'staff'];
    return (queryTab && validTabs.includes(queryTab)) ? (queryTab as 'stats' | 'grid' | 'staff') : defaultTab;
  });

  const [gridMode, setGridMode] = useState<'work' | 'setup'>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVal = params.get('gridMode');
    if (urlVal === 'work' || urlVal === 'setup') return urlVal;
    const localVal = localStorage.getItem('hotel_clean_grid_mode');
    if (localVal === 'work' || localVal === 'setup') return localVal;
    return 'work';
  });

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

  const getCleanerActivity = (cleanerId: string) => {
    const activeRooms = rooms.filter(r => r.status === 'cleaning' && r.assignedTo === cleanerId);
    const activeDatePrefix = activeDate;
    const todayLogs = logs.filter(l => l.cleanerId === cleanerId && l.endedAt.startsWith(activeDatePrefix));
    return {
      activeRooms,
      todayLogs
    };
  };

  const hasRestoredFloorRef = useRef(false);



  // Store previous room statuses to track transitions and play sounds
  const prevRoomStatuses = useRef<Record<string, Room['status']>>({});
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const languageRef = useRef(language);
  languageRef.current = language;

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const allUsers = await db.getUsers();
        const activeUsers = allUsers.filter(u => u.status !== 'quit');
        setAllHotelUsers(activeUsers);

        const housekeeperUsers = activeUsers.filter(u => u.role === 'housekeeping');
        setCleaners(housekeeperUsers);

        const activeIds = await db.getActiveStaff(activeDate);
        // Ensure only active staff are assigned
        const activeCleanersIds = activeIds.filter(id => activeUsers.some(u => u.id === id));
        setActiveStaffIds(activeCleanersIds);
      } catch (e) {
        console.error('Failed to fetch staff data:', e);
      }
    };
    fetchStaffData();
  }, [activeDate]);

  // daily staff search state
  const [dailyStaffSearchTerm, setDailyStaffSearchTerm] = useState<string>('');

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

  useEffect(() => {
    // Subscribe to real-time room updates
    const unsubscribe = db.subscribeRooms((updatedRooms) => {
      // Find if any room transitioned to 'dirty' (checkout) to trigger alert
      let newDirtyCount = 0;
      let lastDirtyRoom = '';

      updatedRooms.forEach(room => {
        const prevStatus = prevRoomStatuses.current[room.id];
        if (prevStatus && prevStatus !== 'dirty' && room.status === 'dirty') {
          newDirtyCount++;
          lastDirtyRoom = room.roomNumber;
        }
        // Update ref value
        prevRoomStatuses.current[room.id] = room.status;
      });

      if (newDirtyCount > 0) {
        // Play notification sound
        if (soundEnabledRef.current) {
          triggerSoundAlert();
        }
        // Show Toast
        addToast(
          getTranslation(languageRef.current, 'notificationNewDirty', { room: lastDirtyRoom }),
          'warning'
        );
      } else {
        // Initialize ref for the first load
        if (Object.keys(prevRoomStatuses.current).length === 0) {
          updatedRooms.forEach(room => {
            prevRoomStatuses.current[room.id] = room.status;
          });
        }
      }

      setRooms(updatedRooms);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Subscribe to logs updates
    const unsubscribeLogs = db.subscribeLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return () => {
      unsubscribeLogs();
    };
  }, []);

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

    if (selectedRoom) {
      const activeDatePrefix = activeDate; // e.g. "2026-06-20"
      const matchingLog = logs
        .filter(log => log.roomId === selectedRoom.id && log.endedAt.startsWith(activeDatePrefix))
        .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())[0];
      setRoomLog(matchingLog || null);
    } else {
      setRoomLog(null);
    }
    setRecleanReason('');
  }, [selectedRoom, logs, activeDate]);

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setSetupForm({
      status: room.status,
      isStay: room.isStay,
      guestCount: room.guestCount,
      notes: room.notes || ''
    });
    setSetupModalOpen(true);
  };

  const saveRoomSetup = async () => {
    if (!selectedRoom || !currentUser) return;
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
    try {
      const defects = getSelectedDefects();

      // Mark as checked (approved)
      await db.updateRoom({
        ...selectedRoom,
        isChecked: true,
        checkedBy: currentUser.name,
        checkedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      });

      // Update log with defects
      if (roomLog) {
        await db.updateLog({
          ...roomLog,
          errors: defects
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
      setSetupModalOpen(false);
      setSelectedRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error approving room', 'warning');
    }
  };

  const handleRequestReclean = async () => {
    if (!selectedRoom || !currentUser) return;
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
      
      // Revert status to dirty, reset isChecked, and add notes
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
      setSetupModalOpen(false);
      setSelectedRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error requesting reclean', 'warning');
    }
  };

  // Get unique floors for filter dropdown
  const floors = useMemo(() => {
    return Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  }, [rooms]);

  // Filter and search logic
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFloor = floorFilter === 'all' || room.floor.toString() === floorFilter;
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
      return matchesSearch && matchesFloor && matchesStatus;
    });
  }, [rooms, searchTerm, floorFilter, statusFilter]);

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

  // Group rooms for full-screen carousel (ignores floor filter, respects search and status)
  const carouselRoomsByFloor = useMemo(() => {
    const filteredForCarousel = rooms.filter(room => {
      const matchesSearch = room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return filteredForCarousel.reduce((acc, room) => {
      if (!acc[room.floor]) {
        acc[room.floor] = [];
      }
      acc[room.floor].push(room);
      return acc;
    }, {} as Record<number, Room[]>);
  }, [rooms, searchTerm, statusFilter]);

  const carouselSortedFloors = useMemo(() => {
    return Object.keys(carouselRoomsByFloor)
      .map(Number)
      .sort((a, b) => a - b);
  }, [carouselRoomsByFloor]);

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

  // Calculate quick metrics
  const { totalRoomsCount, cleanRoomsCount, dirtyRoomsCount, cleaningRoomsCount, occupiedRoomsCount } = useMemo(() => {
    return {
      totalRoomsCount: rooms.length,
      cleanRoomsCount: rooms.filter(r => r.status === 'clean').length,
      dirtyRoomsCount: rooms.filter(r => r.status === 'dirty').length,
      cleaningRoomsCount: rooms.filter(r => r.status === 'cleaning').length,
      occupiedRoomsCount: rooms.filter(r => r.status === 'occupied').length
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

    const activeWorkers = activeStaffIds.length;

    // Filter logs for today
    const todayLogs = logs.filter(log => log.endedAt.startsWith(activeDate) && log.durationMinutes > 0);
    const totalDuration = todayLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
    const finishedCount = todayLogs.length;
    const avgCleaningTime = finishedCount > 0 ? Math.round(totalDuration / finishedCount) : 0;

    // Cleaner productivity leaderboard
    const cleanerMap: Record<string, { name: string; count: number; totalDuration: number }> = {};
    todayLogs.forEach(log => {
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

    todayLogs.forEach(log => {
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
      ? Math.round((todayLogs.filter(l => l.errors && l.errors.length > 0).length / finishedCount) * 100)
      : 0;

    const errorBreakdown = Object.entries(errorTypeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const cleanerErrorLeaderboard = Object.values(cleanerErrorMap)
      .sort((a, b) => b.count - a.count);

    // Hourly room completion trend (8am to 6pm+)
    const hourlyBins: Record<number, number> = {};
    for (let h = 8; h <= 18; h++) {
      hourlyBins[h] = 0;
    }
    todayLogs.forEach(log => {
      try {
        const dateObj = new Date(log.endedAt);
        if (!isNaN(dateObj.getTime())) {
          let hour = dateObj.getHours();
          if (hour < 8) hour = 8;
          if (hour > 18) hour = 18;
          hourlyBins[hour] = (hourlyBins[hour] || 0) + 1;
        }
      } catch (e) {}
    });

    const hourlyTrend = Object.keys(hourlyBins).map(hStr => {
      const h = Number(hStr);
      const label = h === 18 ? '18:00+' : `${h.toString().padStart(2, '0')}:00`;
      return { hour: h, label, count: hourlyBins[h] };
    });

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
      cleanerErrorLeaderboard
    };
  }, [rooms, logs, activeStaffIds, activeDate]);

  const sortedTodayCleaners = useMemo(() => {
    const filtered = cleaners.filter(cleaner => {
      const isActive = activeStaffIds.includes(cleaner.id);
      const matchesSearch = cleaner.name.toLowerCase().includes(dailyStaffSearchTerm.toLowerCase()) ||
        cleaner.username.toLowerCase().includes(dailyStaffSearchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (currentUser?.role === 'front_desk') {
        return isActive;
      }
      return true;
    });

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
  }, [cleaners, dailyStaffSearchTerm, staffSortField, staffSortOrder, activeStaffIds, language, currentUser]);

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
      {/* Sound settings and title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {getTranslation(language, 'fdDashboard')}
        </h2>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`btn ${soundEnabled ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <span>{getTranslation(language, 'soundAlert')}: {soundEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>



      <div className="dashboard-layout">
        <aside className="sidebar-menu glass-panel">
          {currentUser?.role === 'kacho' && (
            <button
              className={`sidebar-link ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              <LayoutDashboard size={16} />
              <span>{language === 'vi' ? 'Thống kê' : language === 'ja' ? '分析統計' : 'Analytics'}</span>
            </button>
          )}
          <button
            className={`sidebar-link ${activeTab === 'grid' ? 'active' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            <Hotel size={16} />
            <span>{language === 'vi' ? 'Sơ đồ phòng' : language === 'ja' ? '客室状況' : 'Room Grid'}</span>
          </button>
          <button
            className={`sidebar-link ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={16} />
            <span>
              {currentUser?.role === 'front_desk'
                ? (language === 'vi' ? 'Nhân sự hôm nay' : language === 'ja' ? '本日のスタッフ' : 'Today\'s Staff')
                : (language === 'vi' ? 'Phân công dọn dẹp' : language === 'ja' ? '出勤スタッフ設定' : 'Staff Assignment')
              }
            </span>
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

        <main className="dashboard-content-panel">

      {activeTab === 'stats' && branchStats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Metrics Row */}
          <div className="metrics-grid">
            {/* Progress Card */}
            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-clean)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)' }}>
                <CheckCircle2 size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="metric-value">{branchStats.percentClean}%</div>
                <div className="metric-label">{language === 'vi' ? 'Tiến độ dọn phòng' : language === 'ja' ? '清縮進捗率' : 'Cleaning Progress'}</div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden', marginTop: '0.4rem' }}>
                  <div style={{ width: `${branchStats.percentClean}%`, height: '100%', backgroundColor: 'var(--status-clean)' }} />
                </div>
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
                  {language === 'vi' ? `Tính từ ${branchStats.leaderboard.reduce((acc, c) => acc + c.count, 0)} lượt hoàn thành` : language === 'ja' ? `完了${branchStats.leaderboard.reduce((acc, c) => acc + c.count, 0)}件に基づく` : `Based on ${branchStats.leaderboard.reduce((acc, c) => acc + c.count, 0)} completions`}
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
                <div className="metric-label">{language === 'vi' ? 'Nhân sự làm việc hôm nay' : language === 'ja' ? '本日の出勤スタッフ数' : 'Active Staff Today'}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                  {language === 'vi' ? `Trên tổng số ${cleaners.length} nhân viên` : language === 'ja' ? `登録スタッフ数: ${cleaners.length}名` : `Out of ${cleaners.length} cleaners`}
                </div>
              </div>
            </div>

            {/* Setup Card */}
            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-dirty)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-dirty)' }}>
                <Building size={20} />
              </div>
              <div>
                <div className="metric-value">{branchStats.total} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{language === 'vi' ? 'phòng' : language === 'ja' ? '室' : 'rooms'}</span></div>
                <div className="metric-label">{language === 'vi' ? 'Tỉ lệ Stay / Checkout' : language === 'ja' ? '滞在 / アウト比率' : 'Stay / Checkout Ratio'}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                  🏠 {branchStats.stayRooms} {language === 'vi' ? 'Stay' : language === 'ja' ? '滞在' : 'Stay'} | 🚪 {branchStats.checkoutRooms} Checkout
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
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
                          { key: 'dirty', label: language === 'vi' ? 'Bẩn' : language === 'ja' ? '未清掃' : 'Dirty', value: branchStats.dirty, color: 'var(--status-dirty)' },
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
                {language === 'vi' ? 'Lượng Hoàn Thành Theo Giờ' : language === 'ja' ? '時間帯別清掃完了数' : 'Hourly Completion Trend'}
              </h4>
              
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(() => {
                  const maxCount = Math.max(...branchStats.hourlyTrend.map(t => t.count), 4);
                  const width = 380;
                  const height = 180;
                  const paddingLeft = 25;
                  const paddingBottom = 25;
                  const paddingTop = 20;
                  const paddingRight = 10;
                  
                  const usableWidth = width - paddingLeft - paddingRight;
                  const usableHeight = height - paddingTop - paddingBottom;
                  
                  const colWidth = usableWidth / branchStats.hourlyTrend.length;
                  const barWidth = Math.max(14, colWidth - 8);

                  return (
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
                        const barHeight = (t.count / maxCount) * usableHeight;
                        const x = paddingLeft + i * colWidth + (colWidth - barWidth) / 2;
                        const y = height - paddingBottom - barHeight;
                        return (
                          <g key={i}>
                            {/* Bar rect */}
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barHeight}
                              rx="3"
                              fill="var(--primary-color)"
                              opacity={t.count > 0 ? 0.85 : 0.15}
                              style={{ transition: 'all 0.5s ease' }}
                            />
                            
                            {/* Label text */}
                            <text
                              x={x + barWidth / 2}
                              y={height - 8}
                              textAnchor="middle"
                              fill="currentColor"
                              style={{ fontSize: '0.6rem', opacity: 0.7 }}
                            >
                              {t.label.split(':')[0]}
                            </text>

                            {/* Value label */}
                            {t.count > 0 && (
                              <text
                                x={x + barWidth / 2}
                                y={y - 5}
                                textAnchor="middle"
                                fill="currentColor"
                                style={{ fontSize: '0.65rem', fontWeight: 700 }}
                              >
                                {t.count}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Housekeeper Leaderboard */}
            <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: 'span 2' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                {language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Hôm nay)' : language === 'ja' ? 'スタッフ清掃実績ランキング (本日)' : 'Housekeeper Leaderboard (Today)'}
              </h4>
              
              {branchStats.leaderboard.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                  🧹 {language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong ngày hôm nay' : language === 'ja' ? '本日のこの店舗 của清掃実績はまだありません' : 'No cleaning logs recorded for this branch today'}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {branchStats.leaderboard.map((cleaner, index) => {
                      const maxRooms = Math.max(...branchStats.leaderboard.map(c => c.count), 1);
                      const percent = (cleaner.count / maxRooms) * 100;
                      const rankMedal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                      
                      return (
                        <div 
                          key={index} 
                          className="glass-panel" 
                          style={{ 
                            padding: '1rem', 
                            backgroundColor: 'rgba(255, 255, 255, 0.3)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '1rem',
                            borderLeft: index < 3 ? `4px solid ${index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : '#b45309'}` : '1px solid rgba(0,0,0,0.05)'
                          }}
                        >
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800 }}>
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
                              <span style={{ color: 'var(--primary-color)' }}>{cleaner.count} {language === 'vi' ? 'phòng' : language === 'ja' ? '室' : 'rooms'}</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.4rem' }}>
                              <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--primary-color)' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', opacity: 0.8, fontWeight: 500 }}>
                              <span>⏱️ Avg: {cleaner.avgTime} {language === 'vi' ? 'phút / phòng' : language === 'ja' ? '分 / 室' : 'mins / room'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Housekeeper Speed Comparison SVG Chart */}
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1.5rem' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-color)' }}>
                      📊 {language === 'vi' ? 'Biểu Đồ So Sánh Tốc Độ Dọn Dẹp (Thời gian trung bình)' : language === 'ja' ? 'スタッフ清掃速度比較グラフ (平均時間)' : 'Housekeeper Speed Comparison Chart (Avg Duration)'}
                    </h5>
                    
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                      {(() => {
                        const maxAvgTime = Math.max(...branchStats.leaderboard.map(c => c.avgTime), 50);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {branchStats.leaderboard.map((cleaner, i) => {
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
            <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: 'span 2' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                ⚠️ {language === 'vi' ? 'Thống Kê Lỗi Dọn Dẹp (Hôm nay)' : language === 'ja' ? '清掃不備インスペクション統計 (本日)' : 'Cleaning Defects Inspection Stats (Today)'}
              </h4>

              {branchStats.totalErrors === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                  ✨ {language === 'vi' ? 'Không phát hiện lỗi dọn dẹp nào trong ngày hôm nay!' : language === 'ja' ? '本日は清掃不備の指摘はありません！' : 'No cleaning defects reported today!'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
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
                    <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                      <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                        👤 {language === 'vi' ? 'Chi tiết lỗi theo nhân viên:' : language === 'ja' ? 'スタッフ別指摘詳細:' : 'Defects by Housekeeper:'}
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {branchStats.cleanerErrorLeaderboard.map((cleaner, i) => (
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
                    </div>
                  </div>

                  {/* Error frequency horizontal bar chart */}
                  <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
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
          {/* Metrics Row */}
          <div className="metrics-grid">
            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
                <Info size={20} />
              </div>
              <div>
                <div className="metric-value">{totalRoomsCount}</div>
                <div className="metric-label">{getTranslation(language, 'statsTotalRooms')}</div>
              </div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-occupied)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(100, 116, 139, 0.1)', color: 'var(--status-occupied)' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>OCC</span>
              </div>
              <div>
                <div className="metric-value">{occupiedRoomsCount}</div>
                <div className="metric-label">{getTranslation(language, 'statusOccupied').split(' ')[0]}</div>
              </div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-dirty)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-dirty)' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>DRY</span>
              </div>
              <div>
                <div className="metric-value">{dirtyRoomsCount}</div>
                <div className="metric-label">{getTranslation(language, 'statsDirtyRooms')}</div>
              </div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-cleaning)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--status-cleaning)' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>CLN</span>
              </div>
              <div>
                <div className="metric-value">{cleaningRoomsCount}</div>
                <div className="metric-label">{getTranslation(language, 'statsCleaningRooms')}</div>
              </div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-clean)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--status-clean)' }} />
              </div>
              <div>
                <div className="metric-value">{cleanRoomsCount}</div>
                <div className="metric-label">{getTranslation(language, 'statsCleanRooms')}</div>
              </div>
            </div>
          </div>

          {/* Active Staff Bar */}
          {(currentUser?.role === 'front_desk' || currentUser?.role === 'checka' || currentUser?.role === 'kacho') && (
            <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                👥 {language === 'vi' ? 'Nhân sự dọn phòng hôm nay:' : language === 'ja' ? '本日の清掃スタッフ:' : 'Cleaners on duty today:'}
              </span>
              {cleaners.filter(c => activeStaffIds.includes(c.id)).length === 0 ? (
                <span style={{ opacity: 0.6, fontStyle: 'italic' }}>
                  {language === 'vi' ? 'Chưa có nhân sự nào được phân công' : language === 'ja' ? 'スタッフ未設定' : 'No staff assigned yet'}
                </span>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {cleaners.filter(c => activeStaffIds.includes(c.id)).map(c => {
                    const { activeRooms, todayLogs } = getCleanerActivity(c.id);
                    const isCleaning = activeRooms.length > 0;
                    
                    return (
                      <span 
                        key={c.id} 
                        style={{ 
                          backgroundColor: isCleaning ? 'rgba(249, 115, 22, 0.08)' : 'rgba(16, 185, 129, 0.08)', 
                          color: isCleaning ? 'var(--status-cleaning)' : 'var(--status-clean)', 
                          padding: '0.25rem 0.6rem', 
                          borderRadius: '6px', 
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          border: isCleaning ? '1px solid rgba(249, 115, 22, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isCleaning ? 'var(--status-cleaning)' : 'var(--status-clean)' }}></span>
                        {c.name}
                        {activeRooms.length > 0 && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9 }}>
                            (🧹 {activeRooms.map(r => r.roomNumber).join(', ')})
                          </span>
                        )}
                        {todayLogs.length > 0 && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.8 }}>
                            (✓ {todayLogs.length})
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Filter and search panel */}
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
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

            {/* Floor filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getTranslation(language, 'filterFloor')}:</label>
              <select 
                className="form-input" 
                style={{ width: '120px', padding: '0.5rem 0.75rem' }}
                value={floorFilter}
                onChange={e => setFloorFilter(e.target.value)}
              >
                <option value="all">{getTranslation(language, 'all')}</option>
                {floors.map(floor => (
                  <option key={floor} value={floor}>{floor}F</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getTranslation(language, 'filterStatus')}:</label>
              <select 
                className="form-input" 
                style={{ width: '180px', padding: '0.5rem 0.75rem' }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">{getTranslation(language, 'all')}</option>
                <option value="occupied">{getTranslation(language, 'statusOccupied')}</option>
                <option value="dirty">{getTranslation(language, 'statusDirty')}</option>
                <option value="cleaning">{getTranslation(language, 'statusCleaning')}</option>
                <option value="clean">{getTranslation(language, 'statusClean')}</option>
                <option value="maintenance">{getTranslation(language, 'statusMaintenance')}</option>
              </select>
            </div>

             {/* Grid Columns filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'vi' ? 'Số cột:' : language === 'ja' ? 'グリッド列:' : 'Columns:'}</label>
              <select 
                className="form-input" 
                style={{ width: '100px', padding: '0.5rem 0.75rem' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

            {/* Full Screen Carousel View trigger */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
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

          {/* Rooms Floor Grid */}
          {Object.keys(roomsByFloor).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }} className="glass-panel">
              {getTranslation(language, 'noData')}
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
                      <span>{floorNum}F</span>
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
                          const guestLabel = language === 'ja' 
                            ? `予定人数:${room.guestCount}人` 
                            : language === 'vi' 
                              ? `Dự kiến:${room.guestCount} người` 
                              : `Set:${room.guestCount} Pax`;

                          const isClean = room.status === 'clean';
                          const isPending = isClean && !room.isChecked;
                          
                          const cardStyle: React.CSSProperties = {
                            cursor: 'pointer',
                            position: 'relative'
                          };
                          
                          if (isPending) {
                            cardStyle.border = '2px dashed var(--status-dirty)';
                            cardStyle.animation = 'pulseBorder 2s infinite';
                          }

                          const iconSize = gridColumns !== 'auto' && Number(gridColumns) >= 12 ? 10 : gridColumns !== 'auto' && Number(gridColumns) >= 8 ? 12 : 14;

                          const isCompact = gridColumns !== 'auto';

                          return (
                            <div 
                              key={room.id} 
                              className={`room-card ${room.status} ${isCompact ? 'compact' : ''}`}
                              onClick={() => handleRoomClick(room)}
                              title={room.notes ? `Ghi chú: ${room.notes}` : undefined}
                              style={cardStyle}
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
                                  {room.isStay && <span className="stay-badge">Stay</span>}
                                  
                                  <div>
                                    <div className="room-type-text">{getFormattedRoomType(room.type)}</div>
                                    <div className="room-number" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                      {room.roomNumber}
                                      {room.status === 'dirty' && <Play size={iconSize} style={{ color: 'var(--status-dirty)' }} fill="var(--status-dirty)" />}
                                      {room.status === 'eco' && <Play size={iconSize} style={{ color: 'var(--status-eco)' }} fill="var(--status-eco)" />}
                                      {room.status === 'cleaning' && <CheckCircle size={iconSize} style={{ color: 'var(--status-cleaning)' }} />}
                                      {room.notes && <AlertTriangle size={iconSize} style={{ color: 'var(--status-maintenance)' }} className="animate-pulse" />}
                                      {room.status === 'clean' && (
                                        <span style={{ 
                                          fontSize: '0.55rem', 
                                          fontWeight: 800, 
                                          color: room.isChecked ? 'var(--status-clean)' : 'var(--status-dirty)',
                                          backgroundColor: room.isChecked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                                          padding: '0.1rem 0.25rem',
                                          borderRadius: '4px',
                                          marginLeft: '0.25rem',
                                          display: 'inline-flex',
                                          alignItems: 'center'
                                        }}>
                                          {room.isChecked ? '✓' : '🔍'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Bottom info row with guest count and cleaner assignee */}
                                  <div className="room-info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                                    <span className="room-guest-count">
                                      <span className="guest-label-full">※ {guestLabel}</span>
                                      <span className="guest-label-compact">👤 {room.guestCount}</span>
                                    </span>
                                    {(room.status === 'cleaning' || room.status === 'clean') && room.cleanerName && (
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
        </>
      )}

      {activeTab === 'staff' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📅 {currentUser?.role === 'front_desk'
                   ? (language === 'vi' ? `Nhân sự ngày ${activeDate}` : language === 'ja' ? `${activeDate} のスタッフ一覧` : `Staff directory for ${activeDate}`)
                   : (language === 'vi' ? `Phân công nhân sự ngày ${activeDate}` : language === 'ja' ? `${activeDate} の出勤スタッフ設定` : `Cleaners Assignment for ${activeDate}`)
                 }
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
                  <p style={{ opacity: 0.6, padding: '1rem 0' }}>
                    {currentUser?.role === 'front_desk'
                      ? (language === 'vi' ? 'Chưa có nhân viên dọn phòng nào được phân công làm việc hôm nay.' : language === 'ja' ? '本日出勤予定の清掃スタッフは設定されていません。' : 'No housekeeping staff assigned to work today.')
                      : (language === 'vi' ? 'Không tìm thấy nhân viên phù hợp.' : language === 'ja' ? '一致するスタッフが見つかりません。' : 'No matching staff found.')
                    }
                  </p>
                ) : (
                  <>
                    <div style={staffLayout === 'grid' 
                      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }
                      : { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }
                    }>
                      {paginatedTodayCleaners.map(cleaner => {
                        const isActive = activeStaffIds.includes(cleaner.id);
                        const isEditable = currentUser?.role === 'checka' || currentUser?.role === 'admin' || currentUser?.role === 'kacho';
                        const { activeRooms, todayLogs } = getCleanerActivity(cleaner.id);
                        return (
                          <div 
                            key={cleaner.id}
                            onClick={isEditable ? () => handleStaffToggle(cleaner.id) : undefined}
                            style={staffLayout === 'grid' ? { 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              backgroundColor: isActive ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0,0,0,0.02)',
                              border: isActive ? '1px solid var(--status-clean)' : '1px solid rgba(0,0,0,0.05)',
                              padding: '1rem',
                              borderRadius: 'var(--radius-md)',
                              cursor: isEditable ? 'pointer' : 'default',
                              opacity: !isEditable && !isActive ? 0.5 : 1, // Dim unassigned cleaners for read-only view
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
                              cursor: isEditable ? 'pointer' : 'default',
                              opacity: !isEditable && !isActive ? 0.5 : 1,
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
            /* Render total active staff directory list */
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
                      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }
                      : { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }
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
            {currentUser?.role === 'front_desk' ? (
              language === 'vi' 
                ? '* Bạn đang ở chế độ Chỉ xem danh sách nhân sự hôm nay và tổng thể khách sạn này.' 
                : language === 'ja'
                  ? '※ 現在、本日のスタッフリストとホテルの総スタッフリストの閲覧モードです。' 
                  : '* You are in read-only mode for today\'s staff and the hotel directory.'
            ) : (
              language === 'vi' 
                ? '* Lưu ý: Chỉ những nhân viên được chọn tại đây mới có thể đăng nhập để thao tác dọn phòng trong ngày này.' 
                : language === 'ja'
                  ? '※ 注意: ここで選択されたスタッフのみが,指定した日付にログインして清掃作業を行えます。' 
                  : '* Note: Only cleaners selected here will be permitted to log in to perform tasks on this date.'
            )}
          </p>
        </div>
      )}
        </main>
      </div>

      {/* Room Configuration Modal */}
      {setupModalOpen && selectedRoom && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '440px' }}>
            <h3 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {gridMode === 'setup' ? '⚙️' : '🔍'} {gridMode === 'setup'
                ? (language === 'vi' ? `Thiết lập phòng ${selectedRoom.roomNumber}` : language === 'ja' ? `客室 ${selectedRoom.roomNumber} 設定` : `Setup Room ${selectedRoom.roomNumber}`)
                : (language === 'vi' ? `Chi tiết kiểm phòng ${selectedRoom.roomNumber}` : language === 'ja' ? `客室 ${selectedRoom.roomNumber} 検査詳細` : `Room Inspection Details ${selectedRoom.roomNumber}`)}
            </h3>
            <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '-0.5rem', marginBottom: '1rem' }}>
              {selectedRoom.type} - {selectedRoom.floor}F
            </p>

            {gridMode === 'setup' ? (
              <>
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
                        backgroundColor: setupForm.status === 'dirty' && !setupForm.isStay ? 'var(--status-dirty)' : 'rgba(0,0,0,0.03)',
                        color: setupForm.status === 'dirty' && !setupForm.isStay ? '#0f172a' : 'inherit',
                        border: '1px solid rgba(0,0,0,0.05)',
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
                        backgroundColor: setupForm.status === 'dirty' && setupForm.isStay ? 'var(--status-dirty)' : 'rgba(0,0,0,0.03)',
                        color: setupForm.status === 'dirty' && setupForm.isStay ? '#0f172a' : 'inherit',
                        border: '1px solid rgba(0,0,0,0.05)',
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
                    <option value="dirty">{getTranslation(language, 'statusDirty')}</option>
                    <option value="eco">{language === 'vi' ? 'Chỉ treo đồ (Eco) - Màu tím' : language === 'ja' ? 'ECO (吊り下げ) - 紫色' : 'Eco (Hang items) - Purple'}</option>
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
              </>
            ) : (
              // In Work Mode: show read-only details
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '0.5rem 0 1.25rem 0' }}>
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>{language === 'vi' ? 'Trạng thái phòng:' : 'Room Status:'} </strong>
                  <span className={`badge badge-${selectedRoom.status}`} style={{ fontSize: '0.65rem', marginLeft: '0.25rem' }}>
                    {selectedRoom.status.toUpperCase()}
                  </span>
                  {selectedRoom.status === 'clean' && (
                    <span className={`badge badge-${selectedRoom.isChecked ? 'clean' : 'dirty'}`} style={{ fontSize: '0.65rem', marginLeft: '0.25rem' }}>
                      {selectedRoom.isChecked 
                        ? (language === 'vi' ? 'Đã duyệt ✓' : 'Checked ✓') 
                        : (language === 'vi' ? 'Chờ duyệt 🔍' : 'Pending 🔍')}
                    </span>
                  )}
                </div>
                {selectedRoom.isStay && (
                  <div style={{ fontSize: '0.9rem' }}>
                    <strong>{language === 'vi' ? 'Loại khách:' : 'Guest Type:'} </strong>
                    <span style={{ fontWeight: 600 }}>{language === 'vi' ? 'Khách ở tiếp (Stay)' : 'Stay-over Guest'}</span>
                  </div>
                )}
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
            )}

            {/* Housekeeping Report inside modal for clean rooms */}
            {selectedRoom.status === 'clean' && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {language === 'vi' ? '📋 Báo cáo từ dọn phòng:' : language === 'ja' ? '📋 清掃レポート:' : '📋 Housekeeping Report:'}
                </h4>
                {roomLog ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div><strong>{language === 'vi' ? 'Nhân viên:' : language === 'ja' ? '清掃担当:' : 'Cleaner:'}</strong> {roomLog.cleanerName}</div>
                    <div><strong>{language === 'vi' ? 'Thời gian dọn:' : language === 'ja' ? '清掃時間:' : 'Duration:'}</strong> {roomLog.durationMinutes} {language === 'vi' ? 'phút' : language === 'ja' ? '分' : 'mins'}</div>
                    <div><strong>{language === 'vi' ? 'Ghi chú của NV:' : language === 'ja' ? '清掃メモ:' : 'Notes:'}</strong> {roomLog.notes || 'N/A'}</div>
                    {roomLog.photoAfter && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{language === 'vi' ? 'Ảnh kiểm chứng:' : language === 'ja' ? '清掃完了写真:' : 'Verification Photo:'}</div>
                        <img 
                          src={roomLog.photoAfter} 
                          alt="Verification" 
                          style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,0.1)' }} 
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                    {language === 'vi' ? 'Chưa tìm thấy log dọn phòng.' : language === 'ja' ? '清掃ログが見つかりません。' : 'No cleaning logs found.'}
                  </p>
                )}
              </div>
            )}

            {/* Inspection Checklist */}
            {selectedRoom.status === 'clean' && !selectedRoom.isChecked && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.4)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(0,0,0,0.05)',
                marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-color)' }}>
                  🔍 {language === 'vi' ? 'Phiếu Kiểm Tra Chất Lượng:' : language === 'ja' ? '客室インスペクションシート:' : 'Quality Inspection Checklist:'}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-color)' }}>
                    <input type="checkbox" checked={defectFloor} onChange={e => setDefectFloor(e.target.checked)} />
                    <span>{language === 'vi' ? 'Chưa lau sàn / hút bụi' : language === 'ja' ? '床掃除・掃除機未実施' : 'Floor dusty/dirty'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-color)' }}>
                    <input type="checkbox" checked={defectAmenities} onChange={e => setDefectAmenities(e.target.checked)} />
                    <span>{language === 'vi' ? 'Thiếu đồ dùng / khăn' : language === 'ja' ? 'アメニティ・タオル不足' : 'Missing towels/amenities'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-color)' }}>
                    <input type="checkbox" checked={defectBathroom} onChange={e => setDefectBathroom(e.target.checked)} />
                    <span>{language === 'vi' ? 'Bần nhà vệ sinh / bồn tắm' : language === 'ja' ? '水回り・浴室汚れ' : 'Dirty bathroom'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-color)' }}>
                    <input type="checkbox" checked={defectBed} onChange={e => setDefectBed(e.target.checked)} />
                    <span>{language === 'vi' ? 'Ga giường nhăn / bẩn' : language === 'ja' ? 'シーツしわ・汚れ' : 'Wrinkled/dirty sheet'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-color)' }}>
                    <input type="checkbox" checked={defectTrash} onChange={e => setDefectTrash(e.target.checked)} />
                    <span>{language === 'vi' ? 'Chưa đổ rác' : language === 'ja' ? 'ゴミ未回収' : 'Trash not emptied'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-color)' }}>
                    <input type="checkbox" checked={defectDust} onChange={e => setDefectDust(e.target.checked)} />
                    <span>{language === 'vi' ? 'Còn bụi trên bàn / tủ' : language === 'ja' ? '家具ほこり残り' : 'Dust on furniture'}</span>
                  </label>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-color)', marginBottom: '0.25rem' }}>
                    <input type="checkbox" checked={defectOther} onChange={e => setDefectOther(e.target.checked)} />
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
                    />
                  )}
                </div>
              </div>
            )}

            {/* Reclean Input Area */}
            {selectedRoom.status === 'clean' && showRecleanInput && (
              <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1rem' }}>
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

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setSetupModalOpen(false); setSelectedRoom(null); }}
                style={{ marginRight: 'auto' }}
              >
                {getTranslation(language, 'cancel')}
              </button>

              {gridMode === 'work' && !showRecleanInput && (
                <button
                  type="button"
                  className="btn"
                  style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
                  onClick={() => {
                    setGridMode('setup');
                    setSetupForm({
                      status: selectedRoom.status,
                      isStay: selectedRoom.isStay,
                      guestCount: selectedRoom.guestCount,
                      notes: selectedRoom.notes || ''
                    });
                  }}
                >
                  ⚙️ {language === 'vi' ? 'Cài đặt phòng' : language === 'ja' ? '客室設定' : 'Room Setup'}
                </button>
              )}

              {selectedRoom.status === 'clean' && !selectedRoom.isChecked && !showRecleanInput && (
                <>
                  <button
                    type="button"
                    className="btn"
                    style={{ backgroundColor: 'var(--status-maintenance)', color: 'white' }}
                    onClick={() => setShowRecleanInput(true)}
                  >
                    🔄 {language === 'vi' ? 'Yêu cầu dọn lại' : language === 'ja' ? '再清掃要求' : 'Reclean'}
                  </button>
                  <button 
                    type="button" 
                    className="btn"
                    style={{ backgroundColor: 'var(--status-clean)', color: 'white' }}
                    onClick={handleApproveClean}
                  >
                    <CheckCircle size={18} />
                    {language === 'vi' ? 'Duyệt sạch' : language === 'ja' ? '承認' : 'Approve'}
                  </button>
                </>
              )}

              {gridMode === 'setup' && !showRecleanInput && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveRoomSetup}
                >
                  {getTranslation(language, 'save')}
                </button>
              )}
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
            <div className="floor-selector-container">
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
                    {language === 'vi' ? `Tầng ${floorNum}F` : language === 'ja' ? `${floorNum}階` : `Floor ${floorNum}F`}
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
          <div className="fullscreen-floor-body">
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
              {(carouselRoomsByFloor[carouselSortedFloors[activeFloorIndex]] || [])
                .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
                .map((room) => {
                  const guestLabel = language === 'ja' 
                    ? `予定人数:${room.guestCount}人` 
                    : language === 'vi' 
                      ? `Dự kiến:${room.guestCount} người` 
                      : `Set:${room.guestCount} Pax`;

                  const isClean = room.status === 'clean';
                  const isPending = isClean && !room.isChecked;
                  
                  const cardStyle: React.CSSProperties = {
                    cursor: 'pointer',
                    position: 'relative'
                  };
                  
                  if (isPending) {
                    cardStyle.border = '2px dashed var(--status-dirty)';
                    cardStyle.animation = 'pulseBorder 2s infinite';
                  }

                  const iconSize = gridColumns !== 'auto' && Number(gridColumns) >= 12 ? 10 : gridColumns !== 'auto' && Number(gridColumns) >= 8 ? 12 : 14;
                  const isCompact = gridColumns !== 'auto';

                  return (
                    <div 
                      key={room.id} 
                      className={`room-card ${room.status} ${isCompact ? 'compact' : ''}`}
                      onClick={() => handleRoomClick(room)}
                      title={room.notes ? `Ghi chú: ${room.notes}` : undefined}
                      style={cardStyle}
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
                          {room.isStay && <span className="stay-badge">Stay</span>}
                          
                          <div>
                            <div className="room-type-text">{getFormattedRoomType(room.type)}</div>
                            <div className="room-number" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                              {room.roomNumber}
                              {room.status === 'dirty' && <Play size={iconSize} style={{ color: 'var(--status-dirty)' }} fill="var(--status-dirty)" />}
                              {room.status === 'eco' && <Play size={iconSize} style={{ color: 'var(--status-eco)' }} fill="var(--status-eco)" />}
                              {room.status === 'cleaning' && <CheckCircle size={iconSize} style={{ color: 'var(--status-cleaning)' }} />}
                              {room.notes && <AlertTriangle size={iconSize} style={{ color: 'var(--status-maintenance)' }} className="animate-pulse" />}
                              {room.status === 'clean' && (
                                <span style={{ 
                                  fontSize: '0.55rem', 
                                  fontWeight: 800, 
                                  color: room.isChecked ? 'var(--status-clean)' : 'var(--status-dirty)',
                                  backgroundColor: room.isChecked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                                  padding: '0.1rem 0.25rem',
                                  borderRadius: '4px',
                                  marginLeft: '0.25rem',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}>
                                  {room.isChecked ? '✓' : '🔍'}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="room-info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                            <span className="room-guest-count">
                              <span className="guest-label-full">※ {guestLabel}</span>
                              <span className="guest-label-compact">👤 {room.guestCount}</span>
                            </span>
                            {(room.status === 'cleaning' || room.status === 'clean') && room.cleanerName && (
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
                              color: 'var(--status-maintenance)'
                            }}>
                              📝 {room.notes}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="fullscreen-floor-dots">
            {carouselSortedFloors.map((floorNum, idx) => (
              <span 
                key={floorNum}
                className={`dot ${idx === activeFloorIndex ? 'active' : ''}`}
                onClick={() => setActiveFloorIndex(idx)}
              />
            ))}
          </div>

          {/* Running Clock / Date at the very bottom */}
          <div className="fullscreen-footer-clock">
            {getDisplayDateTime()}
          </div>
        </div>
      )}
    </div>
  );
};

export default FrontDeskDashboard;
