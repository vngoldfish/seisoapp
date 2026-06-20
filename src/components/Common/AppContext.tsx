import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { db, getActiveHotelId } from '../../db/firebaseDB';
import type { User, Hotel as HotelType } from '../../db/dbInterface';
import type { Language } from '../../i18n/translations';
import { getTodayDateString, getLocalDB } from '../../db/localDB';

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
  login: (credentials: { username?: string; password?: string }) => Promise<boolean>;
  logout: () => void;
  setLanguage: (lang: Language) => void;
  toggleDarkMode: () => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  triggerSoundAlert: () => void;
  selectHotel: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [language, setLanguageState] = useState<Language>('ja');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [hotelId, setHotelId] = useState<string>(getActiveHotelId());
  const [activeHotel, setActiveHotel] = useState<HotelType | null>(null);
  const [activeDate, setActiveDate] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDate = params.get('date');
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      db.setDate(urlDate);
      return urlDate;
    }
    return db.getDate();
  });

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
      
      const savedUser = localStorage.getItem('hotel_clean_curr_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const hasAccess = parsed.role === 'admin' || (parsed.hotelIds && parsed.hotelIds.includes(activeId)) || activeId === 'portal' || activeId === 'admin';
        if (hasAccess) {
          setCurrentUser(parsed);
        } else {
          setCurrentUser(null);
          localStorage.removeItem('hotel_clean_curr_user');
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
    const savedUserStr = localStorage.getItem('hotel_clean_curr_user');
    let userObj: User | null = null;
    if (savedUserStr) {
      userObj = JSON.parse(savedUserStr) as User;
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
        localStorage.removeItem('hotel_clean_curr_user');
        userObj = null;
      }
    } else {
      setCurrentUser(null);
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

    const savedLang = localStorage.getItem('hotel_clean_lang');
    const savedTheme = localStorage.getItem('hotel_clean_theme');
    
    if (savedLang) {
      setLanguageState(savedLang as Language);
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
    localStorage.setItem('hotel_clean_lang', lang);
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newVal = !prev;
      if (newVal) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('hotel_clean_theme', 'dark');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('hotel_clean_theme', 'light');
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
      localStorage.removeItem('hotel_clean_curr_user');
    } else {
      localStorage.setItem('hotel_clean_curr_user', JSON.stringify(activeUser));
    }
  };

  const login = async (
    credentials: { username?: string; password?: string }
  ): Promise<boolean> => {
    try {
      // Query users globally to support logging in from anywhere
      const users = await db.getAllGlobalUsers();
      
      const searchUsername = credentials.username?.trim().toLowerCase();
      if (!searchUsername) {
        console.warn('[AUTH DEBUG] Empty username submitted');
        return false;
      }

      // Find user by username (trimmed, case-insensitive)
      const foundUser = users.find(u => u.username?.trim().toLowerCase() === searchUsername);
      console.log('[AUTH DEBUG] User lookup:', {
        submitted: credentials.username,
        searched: searchUsername,
        found: foundUser ? { id: foundUser.id, username: foundUser.username, role: foundUser.role } : 'Not Found'
      });

      if (!foundUser || foundUser.status === 'quit') {
        return false;
      }

      // Support custom passwords per user (front1 -> front123 or front1123, front2 -> front2123, admin -> admin123, otherwise username + '123')
      let isPasswordMatch = false;
      const inputPassword = credentials.password;
      
      if (foundUser.username?.trim().toLowerCase() === 'front1') {
        isPasswordMatch = (inputPassword === 'front123' || inputPassword === 'front1123');
      } else if (foundUser.username?.trim().toLowerCase() === 'front2') {
        isPasswordMatch = (inputPassword === 'front2123');
      } else {
        isPasswordMatch = (inputPassword === foundUser.username + '123');
      }

      console.log('[AUTH DEBUG] Password check:', {
        entered: inputPassword,
        matches: isPasswordMatch
      });

      if (!isPasswordMatch) {
        return false;
      }

      // Housekeeper date restriction checks (validating correct hotel branch context dynamically)
      if (foundUser.role === 'housekeeping') {
        const today = getTodayDateString();
        const userHotels = foundUser.hotelIds || [];
        const activeBranchId = userHotels.includes(hotelId) ? hotelId : (userHotels[0] || '');
        
        if (activeBranchId) {
          const targetDb = getLocalDB(activeBranchId);
          const activeStaff = await targetDb.getActiveStaff(today);
          if (!activeStaff.includes(foundUser.id)) {
            addToast(
              language === 'vi'
                ? 'Hôm nay bạn không có lịch dọn phòng. Vui lòng liên hệ Lễ tân/Admin.'
                : language === 'ja'
                  ? '本日、清掃の割り当てがありません。フロントまたは管理者に連絡してください。'
                  : 'You are not assigned to clean today. Please contact Front Desk/Admin.',
              'warning'
            );
            return false;
          }
        }
        db.setDate(today);
        setActiveDate(today);
      }

      setCurrentUser(foundUser);
      localStorage.setItem('hotel_clean_curr_user', JSON.stringify(foundUser));

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
          localStorage.removeItem('hotel_clean_curr_user');
          return false;
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
      const savedLang = localStorage.getItem('hotel_clean_lang') as Language;
      if (savedLang) {
        setLanguageState(savedLang);
      } else {
        setLanguageState('ja');
      }
      
      addToast(`Logged in as ${foundUser.name}`, 'success');
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
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
    localStorage.removeItem('hotel_clean_curr_user');
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
      selectHotel
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
