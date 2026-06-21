import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { getTranslation } from '../../i18n/translations';
import { LogOut, Sun, Moon, Hotel, User, Menu } from 'lucide-react';
import { db } from '../../db/firebaseDB';
import type { Hotel as HotelType } from '../../db/dbInterface';

export const Header: React.FC = () => {
  const { currentUser, language, setLanguage, logout, darkMode, toggleDarkMode, hotelId, selectHotel, activeHotel, activeDate, changeActiveDate } = useApp();
  const [hotelsList, setHotelsList] = useState<HotelType[]>([]);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDate, setTempDate] = useState(activeDate);

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

  if (!currentUser) return null;

  const roleLabel = useMemo(() => {
    switch (currentUser.role) {
      case 'admin': return getTranslation(language, 'roleAdmin');
      case 'front_desk': return getTranslation(language, 'roleFrontDesk');
      case 'housekeeping': return getTranslation(language, 'roleHousekeeping');
      case 'checka': return getTranslation(language, 'roleChecker');
      case 'kacho': return getTranslation(language, 'roleKacho');
      default: return currentUser.role;
    }
  }, [currentUser.role, language]);

  const hotelName = useMemo(() => {
    if (activeHotel) return activeHotel.name;
    return hotelId === 'ks2' ? 'Fuji Hotel (富士ホテル)' : 'Sakura Hotel (さくらホテル)';
  }, [activeHotel, hotelId]);

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
        <div className="header-logo" style={{ color: hotelId === 'ks2' ? '#0ea5e9' : '#ec4899' }}>
          <Hotel size={28} />
        </div>
        <div className="header-title">
          <h1>{getTranslation(language, 'loginTitle')}</h1>
          {currentUser.role === 'admin' ? null : currentUser.hotelIds && currentUser.hotelIds.length > 1 ? (
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
                .filter(h => currentUser.hotelIds?.includes(h.id))
                .map(h => (
                  <option key={h.id} value={h.id} style={{ color: 'var(--text-color)' }}>
                    {h.id === 'ks2' ? '🗻 ' : h.id === 'ks1' ? '🌸 ' : '🏨 '}{h.name}
                  </option>
                ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: hotelId === 'ks2' ? '#0ea5e9' : '#ec4899', display: 'block', marginTop: '0.1rem' }}>
              {hotelId === 'ks2' ? '🗻 ' : hotelId === 'ks1' ? '🌸 ' : '🏨 '}{hotelName}
            </span>
          )}
        </div>
      </div>

      <div className="header-actions">



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
