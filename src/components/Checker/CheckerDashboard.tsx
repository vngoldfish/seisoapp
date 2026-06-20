import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../Common/AppContext';
import { getTranslation } from '../../i18n/translations';
import { db } from '../../db/firebaseDB';
import type { Room, CleaningLog, User } from '../../db/dbInterface';
import { 
  Hotel, CheckCircle, AlertTriangle, Search, 
  ClipboardList, CheckCircle2, LayoutDashboard, Clock, Building, Users,
  Sun, Moon, LogOut, User as UserIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const CheckerDashboard: React.FC = () => {
  const { currentUser, language, addToast, activeDate, logout, darkMode, toggleDarkMode, setLanguage } = useApp();
  
  // Tab/Menu navigation inside Checker Dashboard
  const [activeTab, setActiveTab] = useState<'stats' | 'grid' | 'logs'>(() => {
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    const validTabs = ['stats', 'grid', 'logs'];
    return (queryTab && validTabs.includes(queryTab)) ? (queryTab as 'stats' | 'grid' | 'logs') : 'stats';
  });

  // DB States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [cleaners, setCleaners] = useState<User[]>([]);
  const [activeStaffIds, setActiveStaffIds] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const allUsers = await db.getUsers();
        const activeUsers = allUsers.filter(u => u.status !== 'quit');
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
  }, [activeDate]);

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

  useEffect(() => {
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
    setShowRecleanInput(false);
  }, [selectedRoom, logs, activeDate]);

  const handleRoomCardClick = (room: Room) => {
    setSelectedRoom(room);
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
        matchesCheck = room.status === 'clean' && !!room.isChecked;
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

  const { totalCleaned, pendingCheck, approvedCheck } = useMemo(() => {
    return {
      totalCleaned: rooms.filter(r => r.status === 'clean').length,
      pendingCheck: rooms.filter(r => r.status === 'clean' && !r.isChecked).length,
      approvedCheck: rooms.filter(r => r.status === 'clean' && r.isChecked).length
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

  return (
    <div className="main-content">
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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
                    <div className="metric-label">{language === 'vi' ? 'Tiến độ dọn phòng' : language === 'ja' ? '清掃進捗率' : 'Cleaning Progress'}</div>
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
                      🧹 {language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong ngày hôm nay' : language === 'ja' ? '本日のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch today'}
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
              {/* Metrics Panels */}
              <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
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

              {/* Filters Panel */}
              <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

                {/* Floor Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getTranslation(language, 'filterFloor')}:</label>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'vi' ? 'Trạng thái check' : language === 'ja' ? '検査別' : 'Check Status'}:</label>
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
                          <span>{floorNum}F</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.6 }}>
                            ({floorRooms.length} {getTranslation(language, 'room').toLowerCase()})
                          </span>
                        </h3>

                        <div className="room-grid">
                          {floorRooms
                            .sort((a: Room, b: Room) => a.roomNumber.localeCompare(b.roomNumber))
                            .map((room: Room) => {
                              const isClean = room.status === 'clean';
                              const isPending = isClean && !room.isChecked;
                              const isApproved = isClean && !!room.isChecked;
                              
                              let statusText = room.status.toUpperCase();
                              let cardClass = room.status;

                              // Custom visual highlight for unchecked rooms
                              if (isPending) {
                                statusText = language === 'vi' ? 'CHỜ DUYỆT 🔍' : language === 'ja' ? '要検査 🔍' : 'PENDING 🔍';
                              } else if (isApproved) {
                                statusText = language === 'vi' ? 'ĐÃ DUYỆT ✓' : language === 'ja' ? '合格 ✓' : 'APPROVED ✓';
                              }

                              return (
                                <div 
                                  key={room.id} 
                                  className={`room-card ${cardClass}`}
                                  onClick={() => handleRoomCardClick(room)}
                                  style={{ 
                                    cursor: 'pointer',
                                    position: 'relative',
                                    border: isPending ? '2px dashed var(--status-dirty)' : undefined,
                                    animation: isPending ? 'pulseBorder 2s infinite' : undefined
                                  }}
                                  title={room.notes ? `Notes: ${room.notes}` : undefined}
                                >
                                  {room.isStay && <span className="stay-badge">Stay</span>}
                                  <div>
                                    <div className="room-type-text">{room.type}</div>
                                    <div className="room-number" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      {room.roomNumber}
                                    </div>
                                  </div>

                                  <div className="room-info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isApproved ? 'var(--status-clean)' : isPending ? 'var(--status-dirty)' : 'inherit' }}>
                                      {statusText}
                                    </span>
                                    {room.cleanerName && (
                                      <span className="room-assignee" title={room.cleanerName}>
                                        👤 {room.cleanerName.split(' ')[0]}
                                      </span>
                                    )}
                                  </div>
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

          {/* Logs View */}
          {activeTab === 'logs' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>{getTranslation(language, 'cleaningSummary')}</h3>
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>{getTranslation(language, 'noData')}</div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'roomNumber')}</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'cleanerName')}</th>
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
                            <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>{new Date(log.startedAt).toLocaleTimeString()}</td>
                            <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>{new Date(log.endedAt).toLocaleTimeString()}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span className="badge badge-clean" style={{ fontSize: '0.65rem' }}>{log.durationMinutes} mins</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.notes}>
                              {log.notes}
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              {log.photoAfter ? (
                                <a href={log.photoAfter} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600 }}>
                                  View Photo
                                </a>
                              ) : (
                                <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>No Photo</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Checker Inspection Modal */}
      {selectedRoom && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '460px' }}>
            <h3 className="modal-title">
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
                {selectedRoom.status === 'clean' && (
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

            {selectedRoom.status === 'clean' ? (
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
                      <strong>{language === 'vi' ? 'Thời gian dọn:' : 'Duration:'} </strong> {roomLog.durationMinutes} phút ({new Date(roomLog.startedAt).toLocaleTimeString()} - {new Date(roomLog.endedAt).toLocaleTimeString()})
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong>{language === 'vi' ? 'Ghi chú của NV:' : 'Cleaner Notes:'} </strong> {roomLog.notes}
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
                  <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                    {language === 'vi' ? 'Chưa tìm thấy log dọn phòng của ngày hôm nay.' : 'No cleaning logs found for this date.'}
                  </p>
                )}

                {/* Inspection Checklist */}
                {!selectedRoom.isChecked && (
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(0,0,0,0.05)',
                    marginTop: '1.25rem'
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
                  <div className="modal-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                    {!selectedRoom.isChecked && (
                      <button
                        type="button"
                        className="btn"
                        style={{ backgroundColor: 'var(--status-maintenance)', color: 'white', marginRight: 'auto' }}
                        onClick={() => setShowRecleanInput(true)}
                      >
                        🔄 {language === 'vi' ? 'Yêu cầu dọn lại' : language === 'ja' ? '再清掃要求' : 'Reclean'}
                      </button>
                    )}
                    
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => setSelectedRoom(null)}
                    >
                      {language === 'vi' ? 'Đóng' : 'Close'}
                    </button>
                    
                    {!selectedRoom.isChecked && (
                      <button 
                        type="button" 
                        className="btn"
                        style={{ backgroundColor: 'var(--status-clean)', color: 'white' }}
                        onClick={handleApproveClean}
                      >
                        <CheckCircle size={18} />
                        {language === 'vi' ? 'Phê duyệt sạch' : language === 'ja' ? '清掃を承認' : 'Approve Ready'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="modal-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedRoom(null)}
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckerDashboard;
