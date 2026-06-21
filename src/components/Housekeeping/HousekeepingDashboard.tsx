import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../Common/AppContext';
import { getTranslation } from '../../i18n/translations';
import { db } from '../../db/firebaseDB';
import type { Room } from '../../db/dbInterface';
import { Play, CheckCircle, Camera, Check, Sparkles, Filter, ClipboardList, AlertTriangle, Sun, Moon, LogOut, User } from 'lucide-react';
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

export const HousekeepingDashboard: React.FC = () => {
  const { currentUser, language, addToast, activeDate, logout, darkMode, toggleDarkMode, setLanguage, hotelId } = useApp();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'mine'>('all');
  const [showLegend, setShowLegend] = useState(false);
  
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

  // Start Cleaning Confirmation Modal State
  const [selectedStartRoom, setSelectedStartRoom] = useState<Room | null>(null);

  // Revert Clean Room Modal State
  const [selectedCleanRevertRoom, setSelectedCleanRevertRoom] = useState<Room | null>(null);

  // Map to track when a cleaner starts cleaning a room (stored locally or in memory)
  // key: roomId, value: startedAt ISOString
  const [startedTimestamps, setStartedTimestamps] = useState<Record<string, string>>({});

  useEffect(() => {
    // Subscribe to rooms updates
    const unsubscribe = db.subscribeRooms((updatedRooms) => {
      setRooms(updatedRooms);
    });

    // Load started times from localStorage to survive page refresh
    const savedTimestamps = localStorage.getItem('hotel_clean_started_times');
    if (savedTimestamps) {
      setStartedTimestamps(JSON.parse(savedTimestamps));
    }

    return () => unsubscribe();
  }, [hotelId]);

  const saveStartedTimestamps = (newTimestamps: Record<string, string>) => {
    setStartedTimestamps(newTimestamps);
    localStorage.setItem('hotel_clean_started_times', JSON.stringify(newTimestamps));
  };

  const handleStartCleaning = async (room: Room) => {
    if (!currentUser) return;
    try {
      // Transition room status to "cleaning" and assign to active cleaner
      await db.updateRoomStatus(room.id, 'cleaning', currentUser.name, currentUser.id, currentUser.name);
      
      const startTime = new Date().toISOString();
      saveStartedTimestamps({
        ...startedTimestamps,
        [room.id]: startTime
      });

      addToast(
        language === 'vi' 
          ? `Đã bắt đầu dọn phòng ${room.roomNumber}`
          : language === 'ja'
            ? `部屋 ${room.roomNumber} の清掃を開始しました`
            : `Started cleaning room ${room.roomNumber}`,
        'info'
      );
      setSelectedStartRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error updating status', 'warning');
    }
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
      const startedAt = startedTimestamps[activeSheetRoom.id] || new Date(Date.now() - 1800000).toISOString(); // fallback 30m ago
      
      // Calculate duration
      const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
      const durationMinutes = Math.max(1, Math.round(diffMs / 60000));

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

      // 3. Clear start timestamp
      const nextTimestamps = { ...startedTimestamps };
      delete nextTimestamps[activeSheetRoom.id];
      saveStartedTimestamps(nextTimestamps);

      // Trigger success celebration effect!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      addToast(getTranslation(language, 'successClean'), 'success');
      
      setActiveSheetRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error finishing cleaning report', 'warning');
    }
  };

  const handleCancelCleaning = async (room: Room) => {
    try {
      await db.updateRoomStatus(room.id, 'dirty', currentUser?.name || 'System', '', '');
      
      // Clear timestamp
      const nextTimestamps = { ...startedTimestamps };
      delete nextTimestamps[room.id];
      saveStartedTimestamps(nextTimestamps);

      addToast(
        language === 'vi' 
          ? `Đã hủy dọn phòng ${room.roomNumber}`
          : language === 'ja'
            ? `部屋 ${room.roomNumber} の清掃をキャンセルしました`
            : `Cancelled cleaning for room ${room.roomNumber}`,
        'info'
      );
      
      setActiveSheetRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error reverting status', 'warning');
    }
  };

  const handleRevertCleanToCleaning = async (room: Room) => {
    if (!currentUser) return;
    try {
      await db.updateRoomStatus(room.id, 'cleaning', currentUser.name, currentUser.id, currentUser.name);
      
      const startTime = new Date().toISOString();
      saveStartedTimestamps({
        ...startedTimestamps,
        [room.id]: startTime
      });

      addToast(
        language === 'vi' 
          ? `Đã chuyển phòng ${room.roomNumber} về trạng thái đang dọn`
          : language === 'ja'
            ? `部屋 ${room.roomNumber} を清掃中ステータスに戻しました`
            : `Reverted room ${room.roomNumber} to cleaning status`,
        'success'
      );
      setSelectedCleanRevertRoom(null);
    } catch (e) {
      console.error(e);
      addToast('Error updating status', 'warning');
    }
  };

  const handleRevertCleanToDirty = async (room: Room) => {
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
      console.error(e);
      addToast('Error updating status', 'warning');
    }
  };

  const handleRoomCardClick = (room: Room) => {
    if (room.status === 'dirty') {
      setSelectedStartRoom(room);
    } else if (room.status === 'eco') {
      handleFinishCleaningClick(room);
    } else if (room.status === 'cleaning') {
      if (room.assignedTo === currentUser?.id) {
        handleFinishCleaningClick(room);
      } else {
        addToast(
          language === 'vi' 
            ? `Phòng đang được dọn bởi ${room.cleanerName}`
            : `この部屋は ${room.cleanerName} が清掃中です`,
          'warning'
        );
      }
    } else if (room.status === 'clean') {
      setSelectedCleanRevertRoom(room);
    }
  };

  // Filter and search logic
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesFloor = floorFilter === 'all' || room.floor.toString() === floorFilter;
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
      const matchesAssigned = assignedFilter === 'all' || (assignedFilter === 'mine' && room.assignedTo === currentUser?.id);
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
  const { totalRooms, dirtyRooms, cleaningRooms, cleanRooms, myCleaningRooms } = useMemo(() => {
    return {
      totalRooms: rooms.length,
      dirtyRooms: rooms.filter(r => r.status === 'dirty').length,
      cleaningRooms: rooms.filter(r => r.status === 'cleaning').length,
      cleanRooms: rooms.filter(r => r.status === 'clean').length,
      myCleaningRooms: rooms.filter(r => r.status === 'cleaning' && r.assignedTo === currentUser?.id).length
    };
  }, [rooms, currentUser]);

  const floors = useMemo(() => {
    return Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  }, [rooms]);

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

        <main className="dashboard-content-panel">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        {getTranslation(language, 'hkDashboard')}
      </h2>

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

        <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-cleaning)' }}>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--status-cleaning)' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>CLN</span>
          </div>
          <div>
            <div className="metric-value">{cleaningRooms}</div>
            <div className="metric-label">{getTranslation(language, 'statsCleaningRooms')}</div>
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
            <option value="cleaning">{getTranslation(language, 'statusCleaning')}</option>
            <option value="clean">{getTranslation(language, 'statusClean')}</option>
            <option value="vacant">{language === 'vi' ? 'Trống (Vacant)' : language === 'ja' ? '空室 (Vacant)' : 'Vacant'}</option>
            <option value="occupied">{getTranslation(language, 'statusOccupied')}</option>
            <option value="maintenance">{getTranslation(language, 'statusMaintenance')}</option>
          </select>
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
              <div style={{ width: '28px', height: '28px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.18)', backgroundColor: '#f1f5f9' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {language === 'vi' ? 'Phòng trống (Trắng nhạt)' : language === 'ja' ? '空室 (薄白)' : 'Vacant (Off-White)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#ef4444' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {language === 'vi' ? 'Phòng out cần dọn (Đỏ)' : language === 'ja' ? 'アウト清掃必要 (赤)' : 'Checkout Dirty (Red)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #ef4444 50%, #38bdf8 50%)' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {language === 'vi' ? 'Vệ sinh xong (Đỏ / Xanh da trời)' : language === 'ja' ? '清掃完了 (赤 / 水色)' : 'Cleaned (Red / Sky Blue)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #38bdf8 50%, #22c55e 50%)' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {language === 'vi' ? 'Đã duyệt (Xanh da trời / Xanh lá)' : language === 'ja' ? '客室検査合格 (水色 / 緑)' : 'Approved (Sky Blue / Green)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#8b5cf6' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {language === 'vi' ? 'Phòng stay - dọn (Tím)' : language === 'ja' ? '滞在清掃 (紫)' : 'Stay Room (Purple)'}
              </span>
            </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #8b5cf6 50%, #38bdf8 50%)' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {language === 'vi' ? 'Stay DND hoặc Đã dọn (Tím / Xanh da trời)' : language === 'ja' ? '滞在 DND または清掃完了 (紫 / 水色)' : 'Stay DND or Cleaned (Purple / Sky Blue)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#334155' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {language === 'vi' ? 'Đang sửa chữa (Đen nhẹ)' : language === 'ja' ? '故障・修繕中 (薄黒)' : 'Maintenance (Charcoal)'}
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
                  <span>{floorNum}F</span>
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
                      const isAssignedToMe = room.assignedTo === currentUser?.id;
                      const isCleaning = room.status === 'cleaning';
                      const isDirty = room.status === 'dirty';
                      
                      const guestLabel = language === 'vi' 
                        ? `Set: ${room.guestCount} người` 
                        : language === 'ja' 
                          ? `セット: ${room.guestCount}人` 
                          : `Set: ${room.guestCount} Pax`;

                      const isEco = room.status === 'eco';
                      // Determine cursor style
                      const isClickable = isDirty || isEco || (isCleaning && isAssignedToMe) || room.status === 'clean';

                      return (
                        <div 
                          key={room.id} 
                          className={`room-card ${room.status} ${isClickable ? 'clickable' : ''}`}
                          onClick={() => isClickable && handleRoomCardClick(room)}
                          style={{ 
                            cursor: isClickable ? 'pointer' : 'default',
                            position: 'relative'
                          }}
                          title={room.notes ? `Ghi chú: ${room.notes}` : undefined}
                        >
                          {room.isStay && <span className="stay-badge">Stay</span>}
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
                              {isCleaning && isAssignedToMe && <CheckCircle size={14} style={{ color: 'var(--status-cleaning)' }} />}
                              {room.notes && <AlertTriangle size={14} style={{ color: 'var(--status-maintenance)' }} className="animate-pulse" />}
                            </div>
                          </div>

                          {/* Bottom info row */}
                          <div className="room-info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                            <span className="room-guest-count">
                              ※ {guestLabel}
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
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })
      )}

      {/* Start Cleaning Confirmation Modal */}
      {selectedStartRoom && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)' }}>
              <Play size={20} fill="var(--primary-color)" />
              {language === 'vi' ? 'Bắt đầu dọn phòng' : language === 'ja' ? '清掃開始の確認' : 'Start Cleaning Confirm'}
            </h3>
            
            <p className="modal-description">
              {language === 'vi' 
                ? `Bạn có muốn bắt đầu dọn phòng ${selectedStartRoom.roomNumber} không?`
                : language === 'ja'
                  ? `部屋 ${selectedStartRoom.roomNumber} の清掃を開始しますか？`
                  : `Do you want to start cleaning room ${selectedStartRoom.roomNumber}?`}
            </p>

            {selectedStartRoom.notes && (
              <div style={{
                marginTop: '1rem',
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
                  {selectedStartRoom.notes}
                </p>
              </div>
            )}

            {selectedStartRoom.photoDefect && (
              <div style={{
                marginTop: '1rem',
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
                  src={selectedStartRoom.photoDefect} 
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

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setSelectedStartRoom(null)}
              >
                {getTranslation(language, 'cancel')}
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => handleStartCleaning(selectedStartRoom)}
              >
                {getTranslation(language, 'confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Clean Confirmation Modal */}
      {selectedCleanRevertRoom && (
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="btn"
                style={{ backgroundColor: 'var(--status-cleaning)', color: 'white', justifyContent: 'center' }}
                onClick={() => handleRevertCleanToCleaning(selectedCleanRevertRoom)}
              >
                🔄 {language === 'vi' ? 'Quay lại "Đang dọn" (Nhận lại dọn)' : language === 'ja' ? '「清掃中」に戻す (自分に割当)' : 'Revert to "Cleaning" (Assign to me)'}
              </button>
              
              <button 
                type="button" 
                className="btn btn-danger"
                style={{ justifyContent: 'center' }}
                onClick={() => handleRevertCleanToDirty(selectedCleanRevertRoom)}
              >
                🚪 {language === 'vi' ? 'Quay lại "Cần dọn" (Bỏ dọn/Chờ dọn)' : language === 'ja' ? '「要清掃」に戻す (未割当)' : 'Revert to "Dirty" (Unassigned)'}
              </button>
              
              <button 
                type="button" 
                className="btn btn-secondary"
                style={{ justifyContent: 'center', marginTop: '0.5rem' }}
                onClick={() => setSelectedCleanRevertRoom(null)}
              >
                {getTranslation(language, 'cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finish Cleaning Bottom-Sheet / Dialog Panel */}
      {activeSheetRoom && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '440px' }}>
            <h3 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {getTranslation(language, 'cleaningSummary')} - Room {activeSheetRoom.roomNumber}
            </h3>

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
              {activeSheetRoom.status === 'cleaning' && (
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  style={{ marginRight: 'auto' }}
                  onClick={() => handleCancelCleaning(activeSheetRoom)}
                >
                  {language === 'vi' ? 'Hủy dọn phòng' : language === 'ja' ? '清掃をキャンセル' : 'Stop Cleaning'}
                </button>
              )}
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setActiveSheetRoom(null)}
              >
                {getTranslation(language, 'cancel')}
              </button>
              <button 
                type="button" 
                className="btn"
                style={{ backgroundColor: 'var(--status-clean)', color: 'white' }}
                onClick={submitFinishedCleaning}
              >
                <Check size={18} />
                {getTranslation(language, 'save')}
              </button>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
};

export default HousekeepingDashboard;
