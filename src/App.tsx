import { useEffect, useState, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './components/Common/AppContext';
import ErrorBoundary from './components/Common/ErrorBoundary';
import Header from './components/Common/Header';
import ToastList from './components/Common/ToastList';
import Login from './components/Common/Login';
import { ArrowRight, Sun, Moon, Building, Loader2, LogOut } from 'lucide-react';
import { db, getDatabaseProvider } from './db/firebaseDB';
import { getTodayDateString } from './db/localDB';
import type { Hotel as HotelType } from './db/dbInterface';

// Lazy load dashboards for code splitting - only the needed dashboard is loaded per role
const FrontDeskDashboard = lazy(() => import('./components/FrontDesk/FrontDeskDashboard'));
const HousekeepingDashboard = lazy(() => import('./components/Housekeeping/HousekeepingDashboard'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const CheckerDashboard = lazy(() => import('./components/Checker/CheckerDashboard'));

// Hotel Selection Portal View
const HotelSelectionPortal: React.FC = () => {
  const { selectHotel, language, setLanguage, darkMode, toggleDarkMode, currentUser, logout, addToast } = useApp();
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [cols, setCols] = useState<number | 'list'>(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [scheduledHotelIds, setScheduledHotelIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const list = await db.getHotels();
        if (currentUser) {
          let userHotels = list;
          if (currentUser.role !== 'admin') {
            userHotels = list.filter(h => currentUser.hotelIds?.includes(h.id));
          }
          setHotels(userHotels);
          setSelectedHotelIds(userHotels.map(h => h.id));

          if (currentUser.role === 'housekeeping') {
            const today = getTodayDateString();
            const scheduled: string[] = [];
            await Promise.all(
              userHotels.map(async (h) => {
                try {
                  const targetDb = getDatabaseProvider(h.id);
                  const activeStaff = await targetDb.getActiveStaff(today);
                  if (activeStaff.includes(currentUser.id)) {
                    scheduled.push(h.id);
                  }
                } catch (err) {
                  console.error(`Failed to check schedule for hotel ${h.id}:`, err);
                }
              })
            );
            setScheduledHotelIds(scheduled);
          }
        } else {
          setHotels([]);
        }
      } catch (e) {
        console.error('Failed to fetch hotels for portal:', e);
      }
    };
    fetchHotels();
  }, [currentUser]);

  const toggleHotelSelection = (id: string) => {
    setSelectedHotelIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedHotelIds(hotels.map(h => h.id));
  };

  const handleDeselectAll = () => {
    setSelectedHotelIds([]);
  };

  const filteredHotels = hotels.filter(hotel => {
    const matchesSearch = hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          hotel.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSelection = selectedHotelIds.includes(hotel.id);
    return matchesSearch && matchesSelection;
  });

  const portalMaxWidth = cols === 'list' ? '780px' : cols === 3 ? '1000px' : cols === 4 ? '1200px' : '1400px';

  return (
    <div className="auth-layout flex flex-col gap-8 py-8 px-4">
      
      {/* Header controls for Portal */}
      <div 
        className="flex justify-between items-center w-full px-4 box-border transition-all duration-300 ease-in-out"
        style={{ maxWidth: portalMaxWidth }}
      >
        <div className="flex gap-2">
          <button className={`lang-btn ${language === 'ja' ? 'active' : ''}`} onClick={() => setLanguage('ja')}>JP</button>
          <button className={`lang-btn ${language === 'vi' ? 'active' : ''}`} onClick={() => setLanguage('vi')}>VN</button>
          <button className={`lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>EN</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleDarkMode} className="btn btn-secondary btn-sm rounded-full p-1.5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={logout} className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem' }}>
            <LogOut size={14} />
            <span>{language === 'vi' ? 'Đăng xuất' : language === 'ja' ? 'ログアウト' : 'Logout'}</span>
          </button>
        </div>
      </div>

      <div className="text-center max-w-[600px] px-4">
        <h1 className="text-4xl font-extrabold tracking-tight flex items-center justify-center gap-3">
          <Building size={40} className="text-[var(--primary-color)]" />
          {language === 'ja' ? '客室清掃ポータル' : language === 'vi' ? 'Cổng Chọn Khách Sạn' : 'Hotel Housekeeping Portal'}
        </h1>
        <p className="mt-2 opacity-70 text-[0.95rem]">
          {language === 'ja' 
            ? '管理するホテルを選択して清掃管理システムにアクセスしてください。' 
            : language === 'vi' 
              ? 'Vui lòng chọn khách sạn bạn muốn quản lý để truy cập hệ thống dọn phòng.' 
              : 'Please select a hotel to access the housekeeping management system.'}
        </p>
      </div>

      {/* Search & Layout Control Panel */}
      <div className="glass-panel" style={{ 
        width: '100%', 
        maxWidth: portalMaxWidth,
        padding: '1.25rem',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        margin: '0 auto',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={language === 'vi' ? 'Tìm khách sạn...' : language === 'ja' ? 'ホテル検索...' : 'Search hotels...'}
            />
            <span style={{ position: 'absolute', left: '12px', top: '9px', opacity: 0.5 }}>🔍</span>
          </div>

          {/* Layout & Filter controls */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Show/Hide Filter Button */}
            <button 
              className={`btn btn-secondary btn-sm`} 
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>⚙️</span>
              {language === 'vi' ? 'Chọn hiển thị' : language === 'ja' ? '表示選択' : 'Display Options'}
            </button>

            {/* Column Switcher */}
            <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.2rem', borderRadius: '8px' }}>
              {([5, 4, 3, 'list'] as const).map(option => (
                <button
                  key={option}
                  className={`btn-sm`}
                  onClick={() => setCols(option)}
                  style={{
                    border: 'none',
                    background: cols === option ? 'var(--primary-color)' : 'transparent',
                    color: cols === option ? 'white' : 'inherit',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {option === 'list' 
                    ? (language === 'vi' ? 'D.Sách' : language === 'ja' ? 'リスト' : 'List')
                    : `${option} ${language === 'vi' ? 'Cột' : language === 'ja' ? '列' : 'Cols'}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Expandable Filter Panel */}
        {filterPanelOpen && (
          <div style={{ 
            borderTop: '1px solid rgba(0,0,0,0.05)', 
            paddingTop: '1rem',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.8 }}>
                {language === 'vi' ? 'Lựa chọn các khách sạn hiển thị:' : language === 'ja' ? '表示するホテルを選択してください：' : 'Select hotels to display:'}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={handleSelectAll}>
                  {language === 'vi' ? 'Chọn tất cả' : language === 'ja' ? 'すべて選択' : 'Select All'}
                </button>
                <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={handleDeselectAll}>
                  {language === 'vi' ? 'Bỏ chọn tất cả' : language === 'ja' ? 'すべて解除' : 'Deselect All'}
                </button>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '1rem',
              maxHeight: '120px',
              overflowY: 'auto',
              padding: '0.25rem'
            }}>
              {hotels.map(h => (
                <label 
                  key={h.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    backgroundColor: selectedHotelIds.includes(h.id) ? 'rgba(37, 99, 235, 0.1)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${selectedHotelIds.includes(h.id) ? 'rgba(37, 99, 235, 0.2)' : 'rgba(0,0,0,0.05)'}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedHotelIds.includes(h.id)}
                    onChange={() => toggleHotelSelection(h.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{h.name} ({h.id})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid of hotels */}
      <div className={`portal-grid cols-${cols}`}>
        {currentUser?.role === 'admin' && (
          <div 
            className="glass-panel portal-hotel-card admin-pane-card" 
            onClick={() => selectHotel('admin')}
            style={{ 
              padding: '1.5rem', 
              cursor: 'pointer',
              minHeight: cols === 'list' ? '140px' : '220px',
              border: '2px solid rgba(239, 68, 68, 0.25)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'stretch',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)',
              position: 'relative'
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', backgroundColor: '#ef4444' }} />
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🛠️</span>
                <span className="badge badge-clean" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                  {language === 'vi' ? 'Hệ thống' : language === 'ja' ? 'システム' : 'System'}
                </span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {language === 'vi' ? 'Bảng Điều Khiển Admin' : language === 'ja' ? '管理画面 (Admin Pane)' : 'Admin Dashboard'}
              </h2>
              <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>system_admin</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.8, lineBreak: 'anywhere' }}>
                {language === 'vi' 
                  ? 'Quản lý nhân viên, cấu hình khách sạn, xem báo cáo doanh thu và cài đặt hệ thống.' 
                  : language === 'ja'
                    ? 'ユーザー・ホテルの管理、出勤設定、完了レポート của chi nhánh, và cài đặt hệ thống.'
                    : 'Manage users, branch hotels, view finalized reports, and configure system databases.'}
              </p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontWeight: 600, color: '#ef4444', fontSize: '0.85rem' }}>
              <span>
                {language === 'ja' ? '管理画面を開く' : language === 'vi' ? 'Truy cập quản trị' : 'Open Admin Panel'}
              </span>
              <ArrowRight size={16} />
            </div>
          </div>
        )}

        {filteredHotels.map(hotel => {
          const isSakura = hotel.id === 'ks1';
          const isFuji = hotel.id === 'ks2';
          const emoji = isSakura ? '🌸' : isFuji ? '🗻' : '🏨';
          const color = isSakura ? '#ec4899' : isFuji ? '#0ea5e9' : 'var(--primary-color)';
          const badgeText = isSakura ? 'Sakura Branch' : isFuji ? 'Fuji Branch' : `${hotel.name} Branch`;

          const isHotelActive = hotel.active !== false;
          const isHousekeeper = currentUser?.role === 'housekeeping';
          const isScheduled = !isHousekeeper || scheduledHotelIds.includes(hotel.id);
          const isAccessAllowed = currentUser?.role === 'admin' || (isHotelActive && isScheduled);

          const handleCardClick = () => {
            if (currentUser?.role === 'admin') {
              selectHotel(hotel.id);
              return;
            }
            if (!isHotelActive) {
              addToast(
                language === 'vi' 
                  ? 'Khách sạn này tạm thời không hoạt động.' 
                  : language === 'ja'
                    ? 'このホテルは現在非アクティブです。'
                    : 'This hotel is currently inactive.',
                'warning'
              );
              return;
            }
            if (!isScheduled) {
              addToast(
                language === 'vi'
                  ? 'Hôm nay bạn chưa có lịch phân công dọn phòng ở khách sạn này.'
                  : language === 'ja'
                    ? '本日、このホテルでの清掃シフトがまだ割り当てられていません。'
                    : 'You do not have a cleaning assignment here today.',
                'warning'
              );
              return;
            }
            selectHotel(hotel.id);
          };

          return (
            <div 
              key={hotel.id}
              className="glass-panel portal-hotel-card" 
              onClick={handleCardClick}
              style={{ 
                padding: '1.5rem', 
                cursor: isAccessAllowed ? 'pointer' : 'not-allowed',
                minHeight: cols === 'list' ? '140px' : '220px',
                border: `2px solid ${isAccessAllowed ? color : '#e5e7eb'}26`, 
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'stretch',
                opacity: isAccessAllowed ? 1 : 0.55,
                filter: isAccessAllowed ? 'none' : 'grayscale(0.65)',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', backgroundColor: isAccessAllowed ? color : '#9ca3af' }} />
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <span style={{ fontSize: '1.75rem' }}>{emoji}</span>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-clean" style={{ fontSize: '0.65rem', backgroundColor: `${color}1a`, color: color, borderColor: `${color}33` }}>
                      {badgeText}
                    </span>
                    {!isHotelActive && (
                      <span className="badge badge-clean" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                        {language === 'vi' ? 'Không hoạt động' : language === 'ja' ? '非アクティブ' : 'No Active'}
                      </span>
                    )}
                    {isHotelActive && isHousekeeper && !isScheduled && (
                      <span className="badge badge-clean" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.2)' }}>
                        {language === 'vi' ? 'Chưa phân lịch' : language === 'ja' ? 'シフト未割当' : 'No Schedule'}
                      </span>
                    )}
                  </div>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{hotel.name}</h2>
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{hotel.id}</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.8, lineBreak: 'anywhere' }}>
                  {hotel.description || (language === 'ja' ? '客室清掃管理システム' : language === 'vi' ? 'Hệ thống dọn phòng' : 'Housekeeping system')}
                </p>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontWeight: 600, color: isAccessAllowed ? color : '#6b7280', fontSize: '0.85rem' }}>
                <span>
                  {!isHotelActive 
                    ? (language === 'vi' ? 'Không hoạt động' : language === 'ja' ? '非アクティブ' : 'Inactive') 
                    : (isHousekeeper && !isScheduled) 
                      ? (language === 'vi' ? 'Chưa có lịch' : language === 'ja' ? 'シフトなし' : 'No Schedule') 
                      : (language === 'ja' ? '選択する' : language === 'vi' ? 'Truy cập' : 'Access')}
                </span>
                {isAccessAllowed && <ArrowRight size={16} />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ opacity: 0.5, fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
        © 2026 Room Cleaning Management System. All rights reserved.
      </div>
    </div>
  );
};

// Main Router orchestrator
const MainApp: React.FC = () => {
  const { currentUser, hotelId, selectHotel, language, addToast } = useApp();

  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const list = await db.getHotels();
        setHotels(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHotels();

    const handleHotelsUpdate = () => {
      fetchHotels();
    };
    window.addEventListener('hotels-updated', handleHotelsUpdate);
    return () => {
      window.removeEventListener('hotels-updated', handleHotelsUpdate);
    };
  }, []);

  // Helper to check if current URL path points to the selector portal
  const isValidHotel = hotels.some(h => h.id === hotelId);
  const isPortal = !isValidHotel && hotelId !== 'admin';

  // Auto-redirect user to assigned hotel dashboard if they are on the portal
  useEffect(() => {
    if (loading || !currentUser) return;
    
    const isUserAdmin = currentUser.role === 'admin';
    const isCurrentPathAdmin = hotelId === 'admin';

    if (isUserAdmin) {
      // Admins are not auto-redirected; they stay on the portal or their chosen path
      return;
    } else {
      if (hotels.length === 0) return;
      if (isPortal || isCurrentPathAdmin) {
        if (currentUser.hotelIds && currentUser.hotelIds.length === 1) {
          const targetHotelId = currentUser.hotelIds[0];
          const matchedH = hotels.find(h => h.id === targetHotelId);
          if (matchedH && matchedH.active !== false) {
            selectHotel(targetHotelId);
          } else {
            selectHotel('portal');
          }
        } else if (!currentUser.hotelIds || currentUser.hotelIds.length === 0) {
          selectHotel('portal');
        }
      }
    }
  }, [loading, currentUser, isPortal, hotelId, hotels, selectHotel]);

  // Synchronize browser history and path on first boot
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    const matchedHotel = hotels.find(h => h.id === path);
    if (matchedHotel) {
      if (currentUser && currentUser.role !== 'admin' && matchedHotel.active === false) {
        addToast(
          language === 'vi' 
            ? 'Khách sạn này tạm thời không hoạt động.' 
            : language === 'ja'
              ? 'このホテルは現在非アクティブです。'
              : 'This hotel is currently inactive.',
          'warning'
        );
        window.history.replaceState({}, '', '/');
        selectHotel('portal');
      }
    } else if (path !== '' && path !== 'portal' && path !== 'admin') {
      // Clean invalid paths back to portal
      window.history.replaceState({}, '', '/');
      selectHotel('portal');
    }
  }, [loading, hotels, selectHotel, currentUser, language]);

  if (loading) {
    return (
      <div className="auth-layout" style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading Portal...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <Login />
        <ToastList />
      </>
    );
  }

  if (isPortal) {
    return (
      <>
        <HotelSelectionPortal />
        <ToastList />
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Shared Header (branding, language selector, theme toggle, profile, logout, hotel switch) */}
      <Header />
      
      {/* Route according to current logged-in role (lazy loaded with Suspense) */}
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', opacity: 0.6 }}>
          <Loader2 size={24} className="animate-spin" style={{ marginRight: '0.5rem' }} />
          Loading...
        </div>
      }>
        {currentUser.role === 'admin' && (hotelId === 'admin' ? <AdminDashboard /> : <FrontDeskDashboard />)}
        {currentUser.role === 'checka' && <CheckerDashboard />}
        {(currentUser.role === 'front_desk' || currentUser.role === 'kacho') && <FrontDeskDashboard />}
        {currentUser.role === 'housekeeping' && <HousekeepingDashboard />}
      </Suspense>

      {/* Floating notification banners & chime alerts */}
      <ToastList />

      {/* NKTN Style Footer */}
      <div className="nktn-footer">
        Designed & Developed by Kamui (NKTN IT Dept.)
      </div>
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainApp />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
