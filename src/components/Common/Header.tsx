import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { getTranslation } from '../../i18n/translations';
import { LogOut, Sun, Moon, Hotel, User, Menu } from 'lucide-react';
import { db } from '../../db/firebaseDB';
import type { Hotel as HotelType, FinalizedDayReport } from '../../db/dbInterface';

export const Header: React.FC = () => {
  const { 
    currentUser, 
    language, 
    setLanguage, 
    logout, 
    darkMode, 
    toggleDarkMode, 
    hotelId, 
    selectHotel, 
    activeHotel, 
    activeDate, 
    changeActiveDate,
    isLocked,
    toggleDayLock
  } = useApp();
  const [hotelsList, setHotelsList] = useState<HotelType[]>([]);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDate, setTempDate] = useState(activeDate);

  const handleToggleLockClick = async () => {
    if (!currentUser) return;

    if (isLocked) {
      // Unlocking: Only Admin can unlock
      if (currentUser.role !== 'admin') {
        const warningMsg = language === 'vi'
          ? 'Chỉ Admin mới có quyền mở khóa dữ liệu.'
          : language === 'ja'
            ? '管理者のみがデータのロックを解除できます。'
            : 'Only Admin has permission to unlock the data.';
        alert(warningMsg);
        return;
      }

      const confirmMessage = language === 'vi'
        ? `Bạn có chắc chắn muốn MỞ KHÓA dữ liệu ngày ${activeDate}?`
        : language === 'ja'
          ? `日付 ${activeDate} のロックを解除しますか？`
          : `Are you sure you want to UNLOCK date ${activeDate}?`;

      if (window.confirm(confirmMessage)) {
        try {
          await toggleDayLock();
          await db.deleteFinalizedDayReport(`${hotelId}_${activeDate}`);
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      // Locking: Validate that all rooms are clean/finished (not dirty, not cleaning)
      try {
        const rooms = await db.getRooms();
        const unfinished = rooms.filter(r => r.status === 'dirty');
        if (unfinished.length > 0) {
          const roomListStr = unfinished.map(r => r.roomNumber).join(', ');
          const alertMsg = language === 'vi'
            ? `Không thể chốt ngày. Các phòng sau chưa dọn xong: ${roomListStr}`
            : language === 'ja'
              ? `日付を締め切ることができません。以下の客室の清掃が完了していません: ${roomListStr}`
              : `Cannot lock day. The following rooms are not completed: ${roomListStr}`;
          alert(alertMsg);
          return;
        }

        const confirmMessage = language === 'vi'
          ? `Xác nhận CHỐT hoàn tất ngày ${activeDate}?\nSau khi chốt, toàn bộ dữ liệu dọn dẹp và phòng sẽ không thể chỉnh sửa.`
          : language === 'ja'
            ? `日付 ${activeDate} の業務を締め切りますか？\n締め切り後は客室状態や清掃データの変更ができなくなります。`
            : `Confirm LOCKING/FINALIZING date ${activeDate}?\nOnce locked, all cleaning and room data will be frozen and cannot be modified.`;

        if (window.confirm(confirmMessage)) {
          await toggleDayLock();

          // Compute finalized day report and save it
          const logs = await db.getLogs();
          const getLocalDateString = (isoString: string): string => {
            if (!isoString) return '';
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          const dayLogs = logs.filter(l => l.endedAt && getLocalDateString(l.endedAt) === activeDate);
          const cleanerMap: Record<string, { name: string; rooms: Set<string> }> = {};
          dayLogs.forEach(log => {
            const cid = log.cleanerId;
            if (!cleanerMap[cid]) {
              cleanerMap[cid] = { name: log.cleanerName, rooms: new Set() };
            }
            cleanerMap[cid].rooms.add(log.roomId);
          });
          const staffReport = Object.entries(cleanerMap).map(([cleanerId, val]) => ({
            cleanerId,
            cleanerName: val.name,
            roomsCleanedCount: val.rooms.size
          }));

          const report: FinalizedDayReport = {
            id: `${hotelId}_${activeDate}`,
            hotelId,
            hotelName: activeHotel?.name || hotelId,
            date: activeDate,
            totalRooms: rooms.length,
            totalCleaned: rooms.filter(r => r.status === 'clean' || r.status === 'eco' || (r.status === 'dnd' && r.isStay && r.isChecked)).length,
            staffReport,
            finalizedAt: new Date().toISOString(),
            finalizedBy: currentUser.name || currentUser.username
          };

          await db.saveFinalizedDayReport(report);
        }
      } catch (e) {
        console.error(e);
        alert(language === 'vi' ? 'Đã xảy ra lỗi khi chốt ngày.' : 'An error occurred while locking the day.');
      }
    }
  };

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const list = await db.getHotels();
        setHotelsList(list);
      } catch (e) {
        console.error('Header failed to fetch hotels:', e);
      }
    };
    const shouldFetch = currentUser?.role === 'admin' || (currentUser?.hotelIds && currentUser.hotelIds.length > 1);
    if (shouldFetch) {
      fetchHotels();
    }
  }, [currentUser, hotelId]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (document.body.classList.contains('mobile-sidebar-open')) {
        if (target.closest('.sidebar-link') || (!target.closest('.sidebar-menu') && !target.closest('.mobile-menu-toggle-btn'))) {
          document.body.classList.remove('mobile-sidebar-open');
        }
      }
    };
    document.addEventListener('click', handleGlobalClick);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.body.classList.remove('mobile-sidebar-open');
    };
  }, []);

  useEffect(() => {
    const handleOpenDateModal = () => {
      setTempDate(activeDate);
      setShowDateModal(true);
      document.body.classList.remove('mobile-sidebar-open');
    };
    window.addEventListener('open-date-modal', handleOpenDateModal);
    return () => window.removeEventListener('open-date-modal', handleOpenDateModal);
  }, [activeDate]);

  const roleLabel = useMemo(() => {
    if (!currentUser) return '';

    switch (currentUser.role) {
      case 'admin': return getTranslation(language, 'roleAdmin');
      case 'front_desk': return getTranslation(language, 'roleFrontDesk');
      case 'housekeeping': return getTranslation(language, 'roleHousekeeping');
      case 'checka': return getTranslation(language, 'roleChecker');
      case 'kacho': return getTranslation(language, 'roleKacho');
      default: return currentUser.role;
    }
  }, [currentUser, language]);

  const hotelName = useMemo(() => {
    if (hotelId === 'admin') return language === 'vi' ? 'Bảng Điều Khiển Admin' : language === 'ja' ? '管理画面 (Admin)' : 'Admin Panel';
    if (activeHotel) return activeHotel.name;
    return hotelId === 'ks2' ? 'Fuji Hotel (富士ホテル)' : 'Sakura Hotel (さくらホテル)';
  }, [activeHotel, hotelId, language]);

  if (!currentUser) return null;

  return (
    <header className="header glass-panel">
      <div className="header-brand">
        {currentUser && ['admin', 'front_desk', 'checka', 'kacho', 'housekeeping'].includes(currentUser.role) && (
          <button 
            onClick={() => document.body.classList.toggle('mobile-sidebar-open')}
            className="mobile-menu-toggle-btn"
            aria-label="Toggle menu"
          >
            <Menu size={22} />
          </button>
        )}
        <div 
          className="header-logo" 
          style={{ color: hotelId === 'ks2' ? '#0ea5e9' : '#ec4899', cursor: 'pointer' }}
          onClick={() => selectHotel('portal')}
          title={language === 'vi' ? 'Quay lại cổng chọn khách sạn' : language === 'ja' ? 'ホテル選択画面に戻る' : 'Back to hotel selection portal'}
        >
          <Hotel size={28} />
        </div>
        <div className="header-title">
          <h1>{getTranslation(language, 'loginTitle')}</h1>
          {(currentUser.role === 'admin' || (currentUser.hotelIds && currentUser.hotelIds.length > 1)) && hotelId !== 'admin' ? (
            <select
              value={hotelId}
              onChange={e => selectHotel(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: hotelId === 'ks2' ? '#0ea5e9' : '#ec4899',
                cursor: 'pointer',
                outline: 'none',
                padding: '0',
                margin: '0.1rem 0 0 0',
                fontFamily: 'inherit'
              }}
            >
              {hotelsList
                .filter(h => currentUser.role === 'admin' || currentUser.hotelIds?.includes(h.id))
                .map(h => (
                  <option key={h.id} value={h.id} style={{ color: 'var(--text-color)' }}>
                    {h.id === 'ks2' ? '🗻 ' : h.id === 'ks1' ? '🌸 ' : '🏨 '}{h.name}
                  </option>
                ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: hotelId === 'admin' ? '#ef4444' : hotelId === 'ks2' ? '#0ea5e9' : '#ec4899', display: 'block', marginTop: '0.1rem' }}>
              {hotelId === 'admin' ? '🛠️ ' : hotelId === 'ks2' ? '🗻 ' : hotelId === 'ks1' ? '🌸 ' : '🏨 '}{hotelName}
            </span>
          )}
        </div>
      </div>

      <div className="header-actions">
        {/* Quay về chọn KS Button */}
        {currentUser && hotelId && hotelId !== 'portal' && (
          <button
            onClick={() => selectHotel('portal')}
            className="btn btn-secondary btn-sm animate-fade-in"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              padding: '0.35rem 0.75rem', 
              borderRadius: '20px', 
              fontWeight: 700, 
              fontSize: '0.8rem',
              border: '1px solid rgba(0,0,0,0.05)',
              marginRight: '0.5rem',
              cursor: 'pointer'
            }}
            title={language === 'vi' ? 'Quay về chọn khách sạn' : language === 'ja' ? 'ホテル選択に戻る' : 'Return to Hotel Selection'}
          >
            <span>🏨</span>
            <span>{language === 'vi' ? 'Chọn khách sạn' : language === 'ja' ? 'ホテル選択' : 'Select Hotel'}</span>
          </button>
        )}



        {/* Date Selector Pill */}
        <div 
          onClick={() => {
            if (currentUser.role !== 'housekeeping') {
              setTempDate(activeDate);
              setShowDateModal(true);
              document.body.classList.remove('mobile-sidebar-open');
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
            cursor: currentUser.role === 'housekeeping' ? 'default' : 'pointer',
            transition: 'all var(--transition-fast)',
            fontWeight: 600,
            fontSize: '0.8rem',
            userSelect: 'none'
          }}
          className={currentUser.role === 'housekeeping' ? '' : 'date-picker-pill'}
        >
          <span style={{ fontSize: '0.85rem' }}>📅</span>
          <span>{activeDate}</span>
        </div>

        {/* Lock / Unlock Day Button */}
        {currentUser.role !== 'housekeeping' && (
          isLocked ? (
            <button
              onClick={handleToggleLockClick}
              title={language === 'vi' ? 'Mở khóa dữ liệu' : language === 'ja' ? 'ロック解除' : 'Unlock Data'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '20px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                marginLeft: '0.5rem',
                transition: 'all var(--transition-fast)'
              }}
            >
              <span>🔒</span>
              <span>{language === 'vi' ? 'Đã chốt' : language === 'ja' ? '締切済' : 'Locked'}</span>
            </button>
          ) : (
            <button
              onClick={handleToggleLockClick}
              title={language === 'vi' ? 'Chốt hoàn tất ngày' : language === 'ja' ? '本日の業務を締め切る' : 'Lock/Finalize Day'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--status-clean)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '20px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                marginLeft: '0.5rem',
                transition: 'all var(--transition-fast)'
              }}
            >
              <span>🔓</span>
              <span>{language === 'vi' ? 'Chốt ngày' : language === 'ja' ? '締め切る' : 'Lock Day'}</span>
            </button>
          )
        )}

        {isLocked && currentUser?.role === 'housekeeping' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '20px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              marginLeft: '0.5rem'
            }}
          >
            <span>🔒</span>
            <span>{language === 'vi' ? 'Đã chốt ngày' : language === 'ja' ? '業務締切済' : 'Day Locked'}</span>
          </div>
        )}

        {/* Language switcher */}
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

        {/* Dark Mode toggle */}
        <button 
          onClick={toggleDarkMode}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.4rem', borderRadius: '50%' }}
          title="Toggle Theme"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User Info & Logout */}
        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="user-info-desktop" style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <User size={14} /> {currentUser.name}
            </span>
            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
              {roleLabel}
            </span>
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
      </div>

      {showDateModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '360px' }}>
            <h3 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', textAlign: 'center' }}>
              📅 {language === 'vi' ? 'Chọn ngày làm việc' : language === 'ja' ? '対象日の選択' : 'Select Date'}
            </h3>
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <input
                type="date"
                className="form-input"
                style={{ 
                  fontSize: '1.1rem', 
                  padding: '0.75rem', 
                  textAlign: 'center', 
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: 'var(--radius-sm)'
                }}
                value={tempDate}
                onChange={e => setTempDate(e.target.value)}
              />
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowDateModal(false)}
              >
                {getTranslation(language, 'cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  changeActiveDate(tempDate);
                  setShowDateModal(false);
                }}
              >
                {getTranslation(language, 'confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
