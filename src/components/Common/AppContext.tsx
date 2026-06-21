import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { db, getActiveHotelId, getDatabaseProvider } from '../../db/firebaseDB';
import type { User, Hotel as HotelType } from '../../db/dbInterface';
import type { Language } from '../../i18n/translations';
import { getTodayDateString } from '../../db/localDB';
import { readStorageJson, readStorageString, removeStorageKey, writeStorageJson, writeStorageString } from '../../utils/storage';
import { hashPassword } from '../../utils/crypto';

export interface ToastMessage {
  id: string;
  type: 'info' | 'warning' | 'success';
  message: string;
}

interface AppContextType {
  currentUser: User | null;
  language: Language;
  toasts: ToastMessage[];
  darkMode: boolean;
  hotelId: string;
  activeHotel: HotelType | null;
  activeDate: string;
  changeActiveDate: (date: string) => void;
  login: (credentials: { username?: string; password?: string }) => Promise<{ success: boolean; errorType?: 'credentials' | 'schedule' | 'no_hotel' }>;
  logout: () => void;
  setLanguage: (lang: Language) => void;
  toggleDarkMode: () => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  triggerSoundAlert: () => void;
  selectHotel: (id: string) => void;
  isLocked: boolean;
  toggleDayLock: () => Promise<void>;
  currency: string;
  setCurrency: (c: string) => void;
  getCurrencySymbol: () => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [language, setLanguageState] = useState<Language>('ja');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [hotelId, setHotelId] = useState<string>(getActiveHotelId());
  const [activeHotel, setActiveHotel] = useState<HotelType | null>(null);
  
  const [currency, setCurrencyState] = useState<string>(() => {
    return localStorage.getItem('system_currency') || 'JPY';
  });

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    localStorage.setItem('system_currency', c);
  };

  const getCurrencySymbol = () => {
    if (currency === 'VND') return 'đ';
    if (currency === 'USD') return '$';
    return '円';
  };
  const [activeDate, setActiveDate] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDate = params.get('date');
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      db.setDate(urlDate);
      return urlDate;
    }
    return db.getDate();
  });

  const [isLocked, setIsLocked] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const fetchLock = async () => {
      if (!hotelId || hotelId === 'portal' || hotelId === 'admin') {
        if (active) setIsLocked(false);
        return;
      }
      try {
        const val = await db.isDateLocked(activeDate);
        if (active) setIsLocked(val);
      } catch (e) {
        console.error(e);
      }
    };
    fetchLock();
    
    const unsubscribe = db.subscribeRooms(async () => {
      try {
        const val = await db.isDateLocked(activeDate);
        if (active) setIsLocked(val);
      } catch (e) {}
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeDate, hotelId]);

  const toggleDayLock = async () => {
    if (!hotelId || hotelId === 'portal' || hotelId === 'admin') return;
    try {
      const nextVal = !isLocked;
      await db.setDateLocked(activeDate, nextVal);
      setIsLocked(nextVal);
      addToast(
        nextVal
          ? (language === 'vi' ? `Đã chốt hoàn tất ngày ${activeDate}` : language === 'ja' ? `日付 ${activeDate} を締め切りました` : `Locked/Closed date ${activeDate}`)
          : (language === 'vi' ? `Đã mở khóa ngày ${activeDate}` : language === 'ja' ? `日付 ${activeDate} のロックを解除しました` : `Unlocked date ${activeDate}`),
        nextVal ? 'warning' : 'success'
      );
    } catch (e) {
      console.error(e);
      addToast('Error changing day lock state', 'warning');
    }
  };

  // Listen to browser navigation changes (Back/Forward buttons)
  useEffect(() => {
    const handleLocationChange = () => {
      const activeId = getActiveHotelId();
      setHotelId(activeId);
      
      const params = new URLSearchParams(window.location.search);
      const urlDate = params.get('date');
      if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
        db.setDate(urlDate);
        setActiveDate(urlDate);
      }
      
      const parsed = readStorageJson<User | null>('hotel_clean_curr_user', null);
      if (parsed) {
        const hasAccess = parsed.role === 'admin' || (parsed.hotelIds && parsed.hotelIds.includes(activeId)) || activeId === 'portal' || activeId === 'admin';
        if (hasAccess) {
          setCurrentUser(parsed);
        } else {
          setCurrentUser(null);
          removeStorageKey('hotel_clean_curr_user');
        }
      } else {
        setCurrentUser(null);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Synchronize activeDate to URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('date') !== activeDate) {
      params.set('date', activeDate);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [activeDate]);

  // Load user session and language preferences from localStorage on boot
  useEffect(() => {
    const activeId = getActiveHotelId();
    let userObj = readStorageJson<User | null>('hotel_clean_curr_user', null);
    if (userObj) {
      const hasAccess = userObj.role === 'admin' || (userObj.hotelIds && userObj.hotelIds.includes(activeId)) || activeId === 'portal' || activeId === 'admin';
      const finalUser = userObj;
      if (hasAccess && finalUser) {
        setCurrentUser(prev => {
          if (prev && prev.id === finalUser.id && prev.username === finalUser.username && prev.role === finalUser.role) {
            return prev;
          }
          return finalUser;
        });
      } else {
        setCurrentUser(null);
        removeStorageKey('hotel_clean_curr_user');
        userObj = null;
      }
    } else {
      setCurrentUser(null);
      removeStorageKey('hotel_clean_curr_user');
    }

    const params = new URLSearchParams(window.location.search);
    const urlDate = params.get('date');
    let resolvedDate = activeDate;
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      resolvedDate = urlDate;
    }

    const today = getTodayDateString();
    if (userObj && userObj.role === 'housekeeping') {
      db.setDate(today);
      setActiveDate(today);
    } else {
      db.setDate(resolvedDate);
      setActiveDate(resolvedDate);
    }

    const fetchActiveHotel = async () => {
      try {
        const list = await db.getHotels();
        const current = list.find(h => h.id === activeId);
        setActiveHotel(current || null);
      } catch (e) {
        console.error('Failed to fetch active hotel:', e);
      }
    };
    fetchActiveHotel();

    const savedLang = readStorageString('hotel_clean_lang') as Language | '';
    const savedTheme = readStorageString('hotel_clean_theme');

    if (savedLang && ['ja', 'vi', 'en'].includes(savedLang)) {
      setLanguageState(savedLang);
    } else {
      setLanguageState('ja');
    }
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.body.classList.add('dark-mode');
    }
  }, [hotelId]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    writeStorageString('hotel_clean_lang', lang);
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newVal = !prev;
      if (newVal) {
        document.body.classList.add('dark-mode');
        writeStorageString('hotel_clean_theme', 'dark');
      } else {
        document.body.classList.remove('dark-mode');
        writeStorageString('hotel_clean_theme', 'light');
      }
      return newVal;
    });
  };

  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts(prev => [...prev, { id, type, message }]);
    
    // Auto remove after 5 seconds (uses functional update to avoid stale closure)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Play alarm sound using Web Audio API to avoid external asset dependency errors
  const triggerSoundAlert = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // Short dual-tone pleasant hotel chime
      const now = ctx.currentTime;
      
      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Tone 2 (delayed slightly)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.15); // A5
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.15, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn('Audio context play failed (user interaction might be required first):', e);
    }
  };

  const selectHotel = (id: string, userOverride?: User | null) => {
    // Navigate URL path
    const targetPath = id === 'portal' ? '/' : `/${id}`;
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date') || activeDate;
    window.history.pushState({}, '', `${targetPath}?date=${dateParam}`);
    setHotelId(id);
    
    const activeUser = userOverride !== undefined ? userOverride : currentUser;
    if (!activeUser) return;
    
    const hasAccess = activeUser.role === 'admin' || (activeUser.hotelIds && activeUser.hotelIds.includes(id)) || id === 'portal';
    if (!hasAccess) {
      setCurrentUser(null);
      removeStorageKey('hotel_clean_curr_user');
    } else {
      writeStorageJson('hotel_clean_curr_user', activeUser);
    }
  };

  const login = async (
    credentials: { username?: string; password?: string }
  ): Promise<{ success: boolean; errorType?: 'credentials' | 'schedule' | 'no_hotel' }> => {
    try {
      // Query users globally to support logging in from anywhere
      const users = await db.getAllGlobalUsers();
      
      const searchUsername = credentials.username?.trim().toLowerCase();
      if (!searchUsername) {
        return { success: false, errorType: 'credentials' };
      }

      // Find user by username (trimmed, case-insensitive)
      const foundUser = users.find(u => u.username?.trim().toLowerCase() === searchUsername);

      if (!foundUser || foundUser.status === 'quit') {
        return { success: false, errorType: 'credentials' };
      }

      // Support custom passwords per user (front1 -> front123 or front1123, front2 -> front2123, admin -> admin123, otherwise username + '123')
      let isPasswordMatch = false;
      const inputPassword = credentials.password || '';
      
      if (foundUser.passwordHash) {
        const hashedInput = await hashPassword(inputPassword);
        isPasswordMatch = (hashedInput === foundUser.passwordHash);
      } else {
        if (foundUser.username?.trim().toLowerCase() === 'front1') {
          isPasswordMatch = (inputPassword === 'front123' || inputPassword === 'front1123');
        } else if (foundUser.username?.trim().toLowerCase() === 'front2') {
          isPasswordMatch = (inputPassword === 'front2123');
        } else {
          isPasswordMatch = (inputPassword === foundUser.username + '123');
        }

        // Auto-upgrade security: save passwordHash
        if (isPasswordMatch) {
          try {
            const hashed = await hashPassword(inputPassword);
            foundUser.passwordHash = hashed;
            const targetDb = getDatabaseProvider(foundUser.hotelIds?.[0] || 'ks1');
            await targetDb.updateUser(foundUser);
          } catch (e) {
            console.error('Failed to auto-upgrade password hash:', e);
          }
        }
      }

      if (!isPasswordMatch) {
        return { success: false, errorType: 'credentials' };
      }

      // Housekeeper date restriction checks (validating correct hotel branch context dynamically)
      if (foundUser.role === 'housekeeping') {
        const today = getTodayDateString();
        const userHotels = foundUser.hotelIds || [];
        
        let hasActiveSchedule = false;
        for (const hId of userHotels) {
          if (hId === 'portal' || hId === 'admin') continue;
          try {
            const targetDb = getDatabaseProvider(hId);
            const activeStaff = await targetDb.getActiveStaff(today);
            if (activeStaff.includes(foundUser.id)) {
              hasActiveSchedule = true;
              break;
            }
          } catch (e) {
            console.error(`Failed to check active staff for hotel ${hId}:`, e);
          }
        }
        
        if (!hasActiveSchedule) {
          addToast(
            language === 'vi'
              ? 'Lưu ý: Hôm nay bạn chưa có lịch phân công dọn phòng.'
              : language === 'ja'
                ? '注意：本日の清掃割り当てはまだありません。'
                : 'Notice: You do not have a cleaning assignment for today yet.',
            'info'
          );
        }
        db.setDate(today);
        setActiveDate(today);
      }

      setCurrentUser(foundUser);
      writeStorageJson('hotel_clean_curr_user', foundUser);

      // Determine correct hotel to route to upon login
      if (foundUser.role !== 'admin') {
        const userHotels = foundUser.hotelIds || [];
        if (userHotels.length === 0) {
          addToast(
            language === 'vi'
              ? 'Tài khoản của bạn chưa được liên kết với bất kỳ khách sạn nào.'
              : 'Your account is not associated with any hotels.',
            'warning'
          );
          setCurrentUser(null);
          removeStorageKey('hotel_clean_curr_user');
          return { success: false, errorType: 'no_hotel' };
        }

        // Always route non-admin users to the portal so they can select a hotel
        selectHotel('portal', foundUser);
      } else {
        // Admin goes directly to dashboard, bypassing hotel selection
        // Route to the first hotel if they are at 'portal' or have no valid hotel selected
        const list = await db.getHotels();
        const defaultHotel = list[0]?.id || 'ks1';
        if (hotelId === 'portal') {
          selectHotel(defaultHotel, foundUser);
        }
      }
      
      // Simply load the language from localStorage (or defaults to 'ja' if not found)
      const savedLang = readStorageString('hotel_clean_lang') as Language | '';
      if (savedLang && ['ja', 'vi', 'en'].includes(savedLang)) {
        setLanguageState(savedLang);
      } else {
        setLanguageState('ja');
      }
      
      addToast(`Logged in as ${foundUser.name}`, 'success');
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, errorType: 'credentials' };
    }
  };

  const changeActiveDate = (date: string) => {
    db.setDate(date);
    setActiveDate(date);
    addToast(
      language === 'vi' 
        ? `Đã chuyển sang ngày ${date}` 
        : language === 'ja'
          ? `日付を ${date} に変更しました`
          : `Switched to date ${date}`,
      'info'
    );
  };

  const logout = () => {
    removeStorageKey('hotel_clean_curr_user');
    setCurrentUser(null);
    selectHotel('portal', null);
    addToast('Logged out', 'info');
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      language,
      toasts,
      darkMode,
      hotelId,
      activeHotel,
      activeDate,
      changeActiveDate,
      login,
      logout,
      setLanguage,
      toggleDarkMode,
      addToast,
      removeToast,
      triggerSoundAlert,
      selectHotel,
      isLocked,
      toggleDayLock,
      currency,
      setCurrency,
      getCurrencySymbol
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
