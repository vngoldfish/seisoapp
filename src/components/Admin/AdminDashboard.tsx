import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../Common/AppContext';
import { getTranslation } from '../../i18n/translations';
import { db, getDatabaseProvider } from '../../db/firebaseDB';
import type { Room, User, CleaningLog, Hotel as HotelType } from '../../db/dbInterface';
import { readStorageJson } from '../../utils/storage';
import {
  LayoutDashboard,
  Users,
  Building,
  ClipboardList,
  RotateCcw,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  CalendarCheck,
  Settings,
  Database,
  Download,
  Upload
} from 'lucide-react';

import { GlobalStats } from './components/GlobalStats';
import { HotelManagementTab } from './components/HotelManagementTab';
import { UserManagementTab } from './components/UserManagementTab';
import { CleaningLogsTab } from './components/CleaningLogsTab';
import { HotelDetailsView } from './components/HotelDetailsView';
import { FinalizedReportsTab } from './components/FinalizedReportsTab';

const getRoomsForHotelAndDate = (hotelId: string, date: string): Room[] => {
  const dateRooms = readStorageJson<Room[]>(`${hotelId}_hotel_clean_rooms_${date}`, []);
  if (dateRooms.length > 0) return dateRooms;
  return readStorageJson<Room[]>(`${hotelId}_hotel_clean_rooms`, []);
};

const getLogsForHotelAndDate = (hotelId: string, date: string): CleaningLog[] => {
  const allLogs = readStorageJson<CleaningLog[]>(`${hotelId}_hotel_clean_logs`, []);
  return allLogs.filter(log => log.endedAt.startsWith(date));
};

const getActiveStaffForHotelAndDate = (hotelId: string, date: string): string[] => {
  return readStorageJson<string[]>(`${hotelId}_active_staff_${date}`, []);
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

export const AdminDashboard: React.FC = () => {
  const { 
    currentUser, 
    logout, 
    language, 
    setLanguage, 
    darkMode, 
    toggleDarkMode, 
    activeDate, 
    hotelId, 
    selectHotel, 
    addToast,
    currency,
    setCurrency
  } = useApp();

  const [tempCurrency, setTempCurrency] = useState<string>(currency);
  
  useEffect(() => {
    setTempCurrency(currency);
  }, [currency]);

  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'logs' | 'hotels' | 'reports' | 'systemSettings'>(() => {
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    const validTabs = ['stats', 'users', 'logs', 'hotels', 'reports', 'systemSettings'];
    return (queryTab && validTabs.includes(queryTab)) ? (queryTab as 'stats' | 'users' | 'logs' | 'hotels' | 'reports' | 'systemSettings') : 'stats';
  });
  
  const [branchTab, setBranchTab] = useState<'stats' | 'grid' | 'staff' | 'rooms' | 'linkStaff' | 'users' | 'settings'>('stats');
  
  // Database States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [hotelUsers, setHotelUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [cleaners, setCleaners] = useState<User[]>([]);
  const [activeStaffIds, setActiveStaffIds] = useState<string[]>([]);
  const [allActiveStaff, setAllActiveStaff] = useState<Record<string, string[]>>({});
  
  const [usersPage, setUsersPage] = useState(() => {
    const queryPage = new URLSearchParams(window.location.search).get('page');
    const parsedPage = queryPage ? parseInt(queryPage, 10) : 1;
    return isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  });

  const [hotelSearchTerm, setHotelSearchTerm] = useState('');
  const [hotelFilterStatus, setHotelFilterStatus] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [hotelPage, setHotelPage] = useState(1);
  const [hotelPerPage, setHotelPerPage] = useState(5);
  const [hotelSortBy, setHotelSortBy] = useState<'id' | 'name'>('name');
  const [hotelSortOrder, setHotelSortOrder] = useState<'asc' | 'desc'>('asc');

  // Form States (Create/Edit Hotel)
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<HotelType | null>(null);
  const [hotelForm, setHotelForm] = useState({ id: '', name: '', description: '', roomsList: '', active: true });
  const [simulatedRooms, setSimulatedRooms] = useState<{ roomNumber: string; type: string }[]>([]);

  // Detailed branch states
  const [managingHotel, setManagingHotel] = useState<HotelType | null>(null);
  const [managingHotelStaff, setManagingHotelStaff] = useState<User[]>([]);
  const selectedHotelId = managingHotel ? managingHotel.id : hotelId;

  const hasInitializedRef = useRef(false);

  // 1. Synchronize URL query params
  useEffect(() => {
    if (hotels.length === 0) return; // Wait until hotels are loaded before we do any URL syncing

    const params = new URLSearchParams(window.location.search);
    let changed = false;

    // Sync activeTab
    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      changed = true;
    }

    // Sync from URL to state on mount / hotels loaded (ONLY ONCE)
    if (!hasInitializedRef.current) {
      const hotelIdParam = params.get('hotel');
      const branchTabParam = params.get('branchTab');

      if (activeTab === 'hotels' && hotelIdParam) {
        const foundHotel = hotels.find(h => h.id === hotelIdParam);
        if (foundHotel) {
          setManagingHotel(foundHotel);
          if (branchTabParam && ['stats', 'grid', 'staff', 'rooms', 'linkStaff', 'users', 'settings'].includes(branchTabParam)) {
            setBranchTab(branchTabParam as any);
          }
          hasInitializedRef.current = true;
          return;
        }
      }
      hasInitializedRef.current = true;
      // We don't return early here so that the initial load state updates the URL correctly if needed
    }

    // Sync from state to URL
    if (activeTab === 'hotels' && managingHotel) {
      if (params.get('hotel') !== managingHotel.id) {
        params.set('hotel', managingHotel.id);
        changed = true;
      }
      if (params.get('branchTab') !== branchTab) {
        params.set('branchTab', branchTab);
        changed = true;
      }
    } else {
      if (params.has('hotel')) {
        params.delete('hotel');
        changed = true;
      }
      if (params.has('branchTab')) {
        params.delete('branchTab');
        changed = true;
      }
      // If we are not managing a specific hotel branch, path should be '/admin'!
      if (hotelId !== 'admin') {
        selectHotel('admin');
      }
    }

    if (activeTab === 'users') {
      const pageStr = String(usersPage);
      if (params.get('page') !== pageStr) {
        params.set('page', pageStr);
        changed = true;
      }
    } else {
      if (params.has('page')) {
        params.delete('page');
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [activeTab, usersPage, managingHotel, branchTab, hotels, selectHotel, hotelId]);

  // 2. Fetch staff data for currently active hotel branch selection
  useEffect(() => {
    const fetchStaffData = async () => {
      if (!selectedHotelId) return;
      try {
        const targetDb = getDatabaseProvider(selectedHotelId);
        const allUsers = await targetDb.getUsers();
        const activeUsers = allUsers.filter(u => u.status !== 'quit');
        const housekeeperUsers = activeUsers.filter(u => u.role === 'housekeeping');
        setCleaners(housekeeperUsers);

        const activeIds = await targetDb.getActiveStaff(activeDate);
        const activeCleanersIds = activeIds.filter(id => activeUsers.some(u => u.id === id));
        setActiveStaffIds(activeCleanersIds);
      } catch (e) {
        console.error('Failed to fetch staff data:', e);
      }
    };
    fetchStaffData();
  }, [selectedHotelId, activeDate, globalUsers]);

  // 3. Realtime database subscriptions for specific hotel branches
  useEffect(() => {
    if (!selectedHotelId || selectedHotelId === 'admin') return;

    const targetDb = getDatabaseProvider(selectedHotelId);
    targetDb.setDate(activeDate);

    const unsubRooms = targetDb.subscribeRooms(setRooms);
    const unsubLogs = targetDb.subscribeLogs(setLogs);

    const fetchUsers = async () => {
      const allGlobal = await targetDb.getAllGlobalUsers();
      const localUsers = allGlobal.filter(u => u.hotelIds?.includes(selectedHotelId) && u.role !== 'admin');
      setGlobalUsers(allGlobal);
      setHotelUsers(localUsers);
    };
    fetchUsers();

    return () => {
      unsubRooms();
      unsubLogs();
    };
  }, [selectedHotelId, activeDate]);

  // 4. Aggregated stats and global data for global '/admin' dashboard
  useEffect(() => {
    if (selectedHotelId !== 'admin') return;

    let active = true;
    const loadStats = async () => {
      const allRooms: Room[] = [];
      const allLogs: CleaningLog[] = [];
      const activeStaffMap: Record<string, string[]> = {};

      for (const h of hotels) {
        try {
          const provider = getDatabaseProvider(h.id);
          provider.setDate(activeDate);

          const hotelRooms = await provider.getRooms();
          allRooms.push(...hotelRooms.map(r => ({
            ...r,
            id: `${h.id}_${r.id}`
          })));

          const hotelLogs = await provider.getLogs();
          const dateLogs = hotelLogs.filter(l => l.endedAt.startsWith(activeDate));
          allLogs.push(...dateLogs.map(l => ({
            ...l,
            id: `${h.id}_${l.id}`
          })));

          activeStaffMap[h.id] = await provider.getActiveStaff(activeDate);
        } catch (e) {
          console.error(`Failed to load stats for hotel ${h.id}:`, e);
        }
      }

      if (active) {
        setRooms(allRooms);
        setLogs(allLogs);
        setAllActiveStaff(activeStaffMap);
      }
    };

    loadStats();

    const fetchUsers = async () => {
      const provider = getDatabaseProvider('ks1');
      const allGlobal = await provider.getAllGlobalUsers();
      if (active) {
        setGlobalUsers(allGlobal);
        setHotelUsers(allGlobal);
      }
    };
    fetchUsers();

    return () => {
      active = false;
    };
  }, [selectedHotelId, hotels, activeDate]);

  // 5. Initial hotel list load and refresh on mount or active hotel change
  useEffect(() => {
    refreshHotels();
  }, [selectedHotelId]);

  const refreshUsers = async () => {
    if (!selectedHotelId) return;
    const targetDb = getDatabaseProvider(selectedHotelId === 'admin' ? 'ks1' : selectedHotelId);
    const allGlobal = await targetDb.getAllGlobalUsers();
    const localUsers = selectedHotelId === 'admin' 
      ? allGlobal 
      : allGlobal.filter(u => u.hotelIds?.includes(selectedHotelId) && u.role !== 'admin');
    setGlobalUsers(allGlobal);
    setHotelUsers(localUsers);
  };

  const loadManagingHotelData = async (hotelId: string) => {
    try {
      const targetDb = getDatabaseProvider(hotelId);
      const allGlobal = await targetDb.getAllGlobalUsers();
      const localStaff = allGlobal.filter(u => u.hotelIds?.includes(hotelId) && u.role !== 'admin');
      setManagingHotelStaff(localStaff);
    } catch (err) {
      console.error(err);
    }
  };

  // Keep managingHotelRooms and managingHotelStaff in sync
  useEffect(() => {
    if (managingHotel) {
      loadManagingHotelData(managingHotel.id);
    }
  }, [managingHotel, globalUsers]);

  // Reset managingHotel when switching to a non-hotels tab
  useEffect(() => {
    if (activeTab !== 'hotels') {
      setManagingHotel(null);
    }
  }, [activeTab]);

  // Update room simulation in create hotel modal
  useEffect(() => {
    if (activeTab === 'hotels' && hotelModalOpen && !editingHotel) {
      const nums = hotelForm.roomsList
        .split(',')
        .map(r => r.trim())
        .filter(r => r.length > 0);
      
      setSimulatedRooms(prev => {
        return nums.map(num => {
          const existing = prev.find(p => p.roomNumber === num);
          return {
            roomNumber: num,
            type: existing ? existing.type : 'Single'
          };
        });
      });
    }
  }, [hotelForm.roomsList, hotelModalOpen, editingHotel, activeTab]);

  const refreshHotels = async () => {
    try {
      const list = await db.getHotels();
      setHotels(list);
      window.dispatchEvent(new CustomEvent('hotels-updated'));
    } catch (e) {
      console.error(e);
    }
  };

  const getNextHotelCode = (existingHotels: HotelType[]) => {
    let num = 1;
    while (existingHotels.some(h => h.id.toLowerCase() === `ks${num}`)) {
      num++;
    }
    return `ks${num}`;
  };

  const handleAddHotelClick = () => {
    setEditingHotel(null);
    const nextHotelId = getNextHotelCode(hotels);
    setHotelForm({ id: nextHotelId, name: '', description: '', roomsList: '', active: true });
    setSimulatedRooms([]);
    setHotelModalOpen(true);
  };

  const handleEditHotelClick = (hotel: HotelType) => {
    setEditingHotel(hotel);
    setHotelForm({
      id: hotel.id,
      name: hotel.name,
      description: hotel.description || '',
      roomsList: '',
      active: hotel.active !== false
    });
    setHotelModalOpen(true);
  };

  const handleDeleteHotel = async (id: string) => {
    if (id === hotelId) {
      addToast('Cannot delete the active hotel branch you are logged in to', 'warning');
      return;
    }
    if (window.confirm(getTranslation(language, 'deleteConfirm'))) {
      try {
        await db.deleteHotel(id);
        await refreshHotels();
        addToast('Hotel branch deleted successfully', 'success');
      } catch (err) {
        console.error(err);
        addToast('Error deleting hotel branch', 'warning');
      }
    }
  };

  const handleHotelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const codeRegex = /^[a-z0-9]+$/;
      if (!codeRegex.test(hotelForm.id)) {
        addToast('Hotel Code must be lowercase alphanumeric (e.g. ks3)', 'warning');
        return;
      }

      if (editingHotel) {
        await db.updateHotel({
          id: hotelForm.id,
          name: hotelForm.name,
          description: hotelForm.description || undefined,
          active: hotelForm.active
        });
        addToast('Hotel branch updated successfully', 'success');
      } else {
        const finalRoomsList = simulatedRooms.length > 0
          ? simulatedRooms.map(sr => `${sr.roomNumber}:${sr.type}`).join(', ')
          : hotelForm.roomsList;

        const defaultRoomTypes = [
          { id: `${hotelForm.id}_rt1`, name: 'Twin', cleanMinutes: 35, price: currency === 'VND' ? 1200000 : currency === 'USD' ? 100 : 10000, defaultGuestCount: 2 },
          { id: `${hotelForm.id}_rt2`, name: 'Single', cleanMinutes: 25, price: currency === 'VND' ? 800000 : currency === 'USD' ? 50 : 5000, defaultGuestCount: 1 },
          { id: `${hotelForm.id}_rt3`, name: 'Double', cleanMinutes: 30, price: currency === 'VND' ? 1000000 : currency === 'USD' ? 80 : 8000, defaultGuestCount: 2 },
          { id: `${hotelForm.id}_rt4`, name: 'Suite', cleanMinutes: 60, price: currency === 'VND' ? 2500000 : currency === 'USD' ? 250 : 25000, defaultGuestCount: 4 }
        ];

        await db.createHotel({
          id: hotelForm.id,
          name: hotelForm.name,
          description: hotelForm.description || undefined,
          roomsList: finalRoomsList,
          roomTypes: defaultRoomTypes,
          active: hotelForm.active
        });
        addToast('Hotel branch registered successfully', 'success');
      }
      setHotelModalOpen(false);
      await refreshHotels();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Error saving hotel details', 'warning');
    }
  };

  const handleResetDatabase = async () => {
    const confirmed = window.confirm(getTranslation(language, 'resetDatabaseConfirm'));
    if (confirmed) {
      try {
        if (db.resetDatabase) {
          await db.resetDatabase();
        } else {
          localStorage.clear();
        }
        addToast(language === 'vi' ? 'Đã reset cơ sở dữ liệu!' : 'Database reset successfully!', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err: any) {
        console.error(err);
        addToast(language === 'vi' ? 'Lỗi khi reset cơ sở dữ liệu' : 'Error resetting database', 'warning');
      }
    }
  };

  const handleBackupDatabase = async () => {
    try {
      if (!db.backupDatabase) {
        throw new Error(language === 'vi' ? 'Phương thức backup không được hỗ trợ bởi DB provider hiện tại' : 'Backup not supported by active database provider');
      }
      const data = await db.backupDatabase();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const nowStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `hotel_clean_backup_${nowStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast(
        language === 'vi' ? 'Đã tải xuống bản sao lưu cơ sở dữ liệu!' : language === 'ja' ? 'データベースのバックアップをダウンロードしました！' : 'Database backup downloaded successfully!',
        'success'
      );
    } catch (err: any) {
      console.error(err);
      addToast(
        language === 'vi' ? `Lỗi khi sao lưu: ${err.message}` : `Error backing up: ${err.message}`,
        'warning'
      );
    }
  };

  const handleImportDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const inputElement = e.target;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonContent = event.target?.result;
        if (typeof jsonContent !== 'string') {
          throw new Error(language === 'vi' ? 'Không thể đọc nội dung file' : 'Unable to read file content');
        }
        const data = JSON.parse(jsonContent);

        if (!data || typeof data !== 'object') {
          throw new Error(language === 'vi' ? 'Định dạng file backup không hợp lệ' : 'Invalid backup file format');
        }

        const confirmMsg = language === 'vi'
          ? 'CẢNH BÁO: Thao tác này sẽ xoá toàn bộ dữ liệu hiện tại và khôi phục từ file backup. Bạn có chắc chắn muốn tiếp tục?'
          : language === 'ja'
            ? '警告：この操作は現在のデータをすべて削除し、バックアップファイルから復元します。続行しますか？'
            : 'WARNING: This will erase all current data and restore from the backup file. Are you sure you want to proceed?';

        if (window.confirm(confirmMsg)) {
          if (!db.restoreDatabase) {
            throw new Error(language === 'vi' ? 'Phương thức restore không được hỗ trợ bởi DB provider hiện tại' : 'Restore not supported by active database provider');
          }
          await db.restoreDatabase(data);
          addToast(
            language === 'vi' ? 'Khôi phục dữ liệu thành công! Đang tải lại trang...' : language === 'ja' ? 'データベースの復元に成功しました！ページを再読み込みします...' : 'Database restored successfully! Reloading page...',
            'success'
          );
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err: any) {
        console.error(err);
        addToast(
          language === 'vi' ? `Lỗi khi nhập dữ liệu: ${err.message}` : `Error restoring: ${err.message}`,
          'warning'
        );
      } finally {
        inputElement.value = '';
      }
    };
    reader.readAsText(file);
  };

  // AGGREGATE STATISTICS ACROSS ALL HOTELS FOR statsDate
  const globalStats = useMemo(() => {
    let totalRoomsCount = 0;
    let dirtyRoomsCount = 0;
    let cleaningRoomsCount = 0;
    let cleanRoomsCount = 0;
    let maintenanceRoomsCount = 0;
    let checkoutRoomsCount = 0;
    let totalWorkersCount = 0;
    let totalDuration = 0;
    let finishedLogsCount = 0;

    let ecoRoomsCount = 0;
    let dndRoomsCount = 0;
    let vacantRoomsCount = 0;
    let occupiedRoomsCount = 0;
    let stayRoomsCount = 0;
    
    const hotelBreakdowns: Record<string, { total: number; clean: number; dirty: number; cleaning: number; maintenance: number; checkout: number; progress: number }> = {};
    const allIssues: { hotelName: string; roomId: string; date: string; time?: string; type: string; note: string }[] = [];

    const housekeeperRoomsCount: Record<string, number> = {};
    const housekeeperTimes: Record<string, number[]> = {};
    const defectsByCleaner: Record<string, { roomNumber: string; note: string; date: string; time?: string }[]> = {};

    hotels.forEach(hotel => {
      const hotelRooms = selectedHotelId === 'admin'
        ? rooms.filter(r => r.id.startsWith(hotel.id + '_')).map(r => ({
            ...r,
            id: r.id.substring(hotel.id.length + 1)
          }))
        : getRoomsForHotelAndDate(hotel.id, activeDate);

      const hotelLogs = selectedHotelId === 'admin'
        ? logs.filter(l => l.id.startsWith(hotel.id + '_')).map(l => ({
            ...l,
            id: l.id.substring(hotel.id.length + 1)
          }))
        : getLogsForHotelAndDate(hotel.id, activeDate);

      const activeIds = selectedHotelId === 'admin'
        ? (allActiveStaff[hotel.id] || [])
        : getActiveStaffForHotelAndDate(hotel.id, activeDate);

      let hClean = 0;
      let hDirty = 0;
      let hCleaning = 0;
      let hMaintenance = 0;
      let hCheckout = 0;
      let hWorkers = activeIds.length;

      totalRoomsCount += hotelRooms.length;
      totalWorkersCount += hWorkers;

      hotelRooms.forEach(room => {
        if (room.status === 'clean') {
          cleanRoomsCount++;
          hClean++;
        } else if (room.status === 'dirty') {
          dirtyRoomsCount++;
          hDirty++;
        } else if (room.status === 'cleaning') {
          cleaningRoomsCount++;
          hCleaning++;
        } else if (room.status === 'maintenance') {
          maintenanceRoomsCount++;
          hMaintenance++;
        } else if (room.status === 'eco') {
          ecoRoomsCount++;
        } else if (room.status === 'dnd') {
          dndRoomsCount++;
        } else if (room.status === 'vacant') {
          vacantRoomsCount++;
        } else if (room.status === 'occupied') {
          occupiedRoomsCount++;
        }

        if (room.isStay) {
          stayRoomsCount++;
        } else {
          checkoutRoomsCount++;
          hCheckout++;
        }

        if (room.notes) {
          allIssues.push({
            hotelName: hotel.name,
            roomId: room.roomNumber,
            note: room.notes,
            type: 'maintenance',
            date: activeDate,
            time: ''
          });
        }
      });

      // Process today's finished logs
      const completedLogs = hotelLogs.filter(log => log.durationMinutes > 0);
      completedLogs.forEach(log => {
        totalDuration += log.durationMinutes;
        finishedLogsCount++;
        
        const key = log.cleanerName || log.cleanerId || 'Unknown';
        housekeeperRoomsCount[key] = (housekeeperRoomsCount[key] || 0) + 1;
        
        if (!housekeeperTimes[key]) {
          housekeeperTimes[key] = [];
        }
        housekeeperTimes[key].push(log.durationMinutes);

        if (log.errors && log.errors.length > 0) {
          if (!defectsByCleaner[key]) {
            defectsByCleaner[key] = [];
          }
          log.errors.forEach(err => {
            defectsByCleaner[key].push({
              roomNumber: log.roomNumber,
              note: err,
              date: log.endedAt.split('T')[0],
              time: new Date(log.endedAt).toLocaleTimeString()
            });
            allIssues.push({
              hotelName: hotel.name,
              roomId: log.roomNumber,
              note: err,
              type: 'log',
              date: log.endedAt.split('T')[0],
              time: new Date(log.endedAt).toLocaleTimeString()
            });
          });
        }
      });

      const percentClean = hotelRooms.length > 0 ? Math.round((hClean / hotelRooms.length) * 100) : 0;
      hotelBreakdowns[hotel.id] = {
        total: hotelRooms.length,
        clean: hClean,
        dirty: hDirty,
        cleaning: hCleaning,
        maintenance: hMaintenance,
        checkout: hCheckout,
        progress: percentClean
      };
    });

    const avgCleaningTime = finishedLogsCount > 0 ? Math.round(totalDuration / finishedLogsCount) : 0;

    return {
      totalRooms: totalRoomsCount,
      cleanRooms: cleanRoomsCount,
      dirtyRooms: dirtyRoomsCount,
      cleaningRooms: cleaningRoomsCount,
      maintenanceRooms: maintenanceRoomsCount,
      checkoutRooms: checkoutRoomsCount,
      totalWorkers: totalWorkersCount,
      avgCleaningTime,
      housekeeperRoomsCount,
      housekeeperTimes,
      defectsByCleaner,
      allIssues,
      hotelBreakdowns
    };
  }, [hotels, activeDate, selectedHotelId, rooms, logs, allActiveStaff]);

  // Reset hotel page when search, filter, sort or selected stats date changes
  useEffect(() => {
    setHotelPage(1);
  }, [hotelSearchTerm, hotelFilterStatus, hotelSortBy, hotelSortOrder, activeDate]);

  // Filter, Sort and Paginate Hotel Breakdown list for stats view
  const processedHotelsData = useMemo(() => {
    const filtered = hotels.filter(hotel => {
      const nameMatch = hotel.name.toLowerCase().includes(hotelSearchTerm.toLowerCase()) ||
                        hotel.id.toLowerCase().includes(hotelSearchTerm.toLowerCase());
      
      const breakdown = globalStats.hotelBreakdowns[hotel.id] || { total: 0, clean: 0 };
      const percentClean = breakdown.total > 0 ? Math.round((breakdown.clean / breakdown.total) * 100) : 0;
      let statusMatch = true;
      if (hotelFilterStatus === 'completed') {
        statusMatch = percentClean === 100;
      } else if (hotelFilterStatus === 'in_progress') {
        statusMatch = percentClean < 100;
      }
      
      return nameMatch && statusMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      let valA = hotelSortBy === 'id' ? a.id : a.name;
      let valB = hotelSortBy === 'id' ? b.id : b.name;
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
      
      if (valA < valB) return hotelSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return hotelSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / hotelPerPage) || 1;
    const currentPage = Math.min(Math.max(1, hotelPage), totalPages);
    const startIndex = (currentPage - 1) * hotelPerPage;
    const paginated = sorted.slice(startIndex, startIndex + hotelPerPage);

    return {
      displayed: paginated,
      totalPages,
      currentPage,
      totalItems
    };
  }, [hotels, globalStats.hotelBreakdowns, hotelSearchTerm, hotelFilterStatus, hotelPage, hotelPerPage, hotelSortBy, hotelSortOrder]);

  return (
    <div className="main-content">
      <div className="dashboard-layout">
        <aside className="sidebar-menu glass-panel">
          <button
            className={`sidebar-link ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <LayoutDashboard size={16} />
            <span>{getTranslation(language, 'adminDashboard')}</span>
          </button>
          <button
            className={`sidebar-link ${activeTab === 'hotels' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('hotels');
              setManagingHotel(null);
            }}
          >
            <Building size={16} />
            <span>{getTranslation(language, 'hotelManagement')}</span>
          </button>
          <button
            className={`sidebar-link ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            <span>{getTranslation(language, 'userManagement')}</span>
          </button>
          <button
            className={`sidebar-link ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <ClipboardList size={16} />
            <span>{getTranslation(language, 'cleaningSummary')}</span>
          </button>
          <button
            className={`sidebar-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <CalendarCheck size={16} />
            <span>{language === 'vi' ? 'Lịch sử chốt ngày' : language === 'ja' ? '締め切り履歴' : 'Day Lock History'}</span>
          </button>
          
          <button
            className={`sidebar-link ${activeTab === 'systemSettings' ? 'active' : ''}`}
            onClick={() => setActiveTab('systemSettings')}
          >
            <Settings size={16} />
            <span>{language === 'vi' ? 'Cài đặt hệ thống' : language === 'ja' ? 'システム設定' : 'System Settings'}</span>
          </button>

          <button
            className="sidebar-link"
            style={{ marginTop: 'auto', color: 'var(--status-maintenance)' }}
            onClick={handleResetDatabase}
          >
            <RotateCcw size={16} />
            <span>{getTranslation(language, 'resetDatabase')}</span>
          </button>

          <div className="sidebar-mobile-actions">
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
          {activeTab === 'stats' && (
            <GlobalStats
              language={language}
              globalStats={globalStats}
              hotels={hotels}
              hotelSearchTerm={hotelSearchTerm}
              setHotelSearchTerm={setHotelSearchTerm}
              hotelFilterStatus={hotelFilterStatus}
              setHotelFilterStatus={setHotelFilterStatus}
              hotelPage={hotelPage}
              setHotelPage={setHotelPage}
              hotelPerPage={hotelPerPage}
              setHotelPerPage={setHotelPerPage}
              hotelSortBy={hotelSortBy}
              setHotelSortBy={setHotelSortBy}
              hotelSortOrder={hotelSortOrder}
              setHotelSortOrder={setHotelSortOrder}
              processedHotelsData={processedHotelsData}
              setManagingHotel={setManagingHotel}
              setBranchTab={setBranchTab}
              getVisiblePages={getVisiblePages}
            />
          )}

          {activeTab === 'hotels' && !managingHotel && (
            <HotelManagementTab
              language={language}
              hotels={hotels}
              hotelSearchTerm={hotelSearchTerm}
              setHotelSearchTerm={setHotelSearchTerm}
              hotelFilterStatus={hotelFilterStatus}
              setHotelFilterStatus={setHotelFilterStatus}
              hotelPage={hotelPage}
              setHotelPage={setHotelPage}
              hotelPerPage={hotelPerPage}
              setHotelPerPage={setHotelPerPage}
              hotelSortBy={hotelSortBy}
              setHotelSortBy={setHotelSortBy}
              hotelSortOrder={hotelSortOrder}
              setHotelSortOrder={setHotelSortOrder}
              processedHotelsData={processedHotelsData}
              handleAddHotelClick={handleAddHotelClick}
              handleEditHotelClick={handleEditHotelClick}
              handleDeleteHotel={handleDeleteHotel}
              setManagingHotel={setManagingHotel}
              setBranchTab={setBranchTab}
              hotelId={selectedHotelId}
              getTranslation={getTranslation}
              getVisiblePages={getVisiblePages}
            />
          )}

          {activeTab === 'hotels' && managingHotel && (
            <HotelDetailsView
              language={language}
              managingHotel={managingHotel}
              setManagingHotel={setManagingHotel}
              branchTab={branchTab}
              setBranchTab={setBranchTab}
              activeDate={activeDate}
              rooms={rooms}
              cleaners={cleaners}
              activeStaffIds={activeStaffIds}
              setActiveStaffIds={setActiveStaffIds}
              logs={logs}
              globalUsers={globalUsers}
              hotels={hotels}
              managingHotelStaff={managingHotelStaff}
              hotelUsers={hotelUsers}
              usersPage={usersPage}
              setUsersPage={setUsersPage}
              refreshUsers={refreshUsers}
              loadManagingHotelData={loadManagingHotelData}
              refreshHotels={refreshHotels}
              addToast={addToast}
              getTranslation={getTranslation}
              getVisiblePages={getVisiblePages}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementTab
              language={language}
              globalUsers={globalUsers}
              hotels={hotels}
              selectedHotelId={selectedHotelId}
              managingHotel={null}
              branchTab=""
              activeTab={activeTab}
              managingHotelStaff={[]}
              hotelUsers={hotelUsers}
              usersPage={usersPage}
              setUsersPage={setUsersPage}
              refreshUsers={refreshUsers}
              addToast={addToast}
              getTranslation={getTranslation}
              getVisiblePages={getVisiblePages}
            />
          )}

          {activeTab === 'logs' && (
            <CleaningLogsTab
              language={language}
              logs={logs}
              activeDate={activeDate}
              selectedHotelId={selectedHotelId}
              addToast={addToast}
              getTranslation={getTranslation}
            />
          )}

          {activeTab === 'reports' && (
            <FinalizedReportsTab
              language={language as 'vi' | 'ja' | 'en'}
              selectedHotelId={selectedHotelId}
              addToast={addToast}
            />
          )}

          {activeTab === 'systemSettings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
              <div className="card glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-color)' }}>
                  <Settings size={22} />
                  <span>{language === 'vi' ? 'Cài đặt hệ thống' : language === 'ja' ? 'システム設定' : 'System Settings'}</span>
                </h2>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                    {language === 'vi' ? 'Đơn vị tiền tệ (Currency)' : language === 'ja' ? 'システム通貨' : 'System Currency'}
                  </label>
                  <select
                    className="form-input"
                    value={tempCurrency}
                    onChange={(e) => setTempCurrency(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.7)', color: 'var(--text-color)' }}
                  >
                    <option value="JPY">JPY (円 / ¥)</option>
                    <option value="VND">VND (đ)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-color)', opacity: 0.6, marginTop: '0.5rem' }}>
                    {language === 'vi' 
                      ? 'Lưu ý: Thay đổi đơn vị tiền tệ sẽ cập nhật ký hiệu hiển thị trên toàn hệ thống. Hãy điều chỉnh thủ công giá tiền của các loại phòng ở cài đặt chi nhánh cho phù hợp.' 
                      : language === 'ja'
                        ? '注意：通貨を変更すると、システム全体の表示記号が更新されます。必要に応じて各ホテルの部屋タイプの価格を手動で変更してください。'
                        : 'Note: Changing the currency updates the symbol displayed system-wide. Please manually adjust room type prices in each hotel settings tab as needed.'}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setCurrency(tempCurrency);
                      addToast(
                        language === 'vi' ? 'Đã cập nhật cấu hình hệ thống!' : language === 'ja' ? 'システム設定を更新しました！' : 'System settings updated successfully!',
                        'success'
                      );
                    }}
                    style={{ padding: '0.75rem 2rem', fontWeight: 600 }}
                  >
                    {language === 'vi' ? 'Lưu cấu hình' : language === 'ja' ? '設定を保存' : 'Save Settings'}
                  </button>
                </div>
              </div>

              <div className="card glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-color)' }}>
                  <Database size={22} />
                  <span>{language === 'vi' ? 'Quản lý Dữ liệu' : language === 'ja' ? 'データ管理' : 'Data Management'}</span>
                </h2>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-color)', opacity: 0.8, marginBottom: '1.5rem' }}>
                  {language === 'vi' 
                    ? 'Bạn có thể sao lưu toàn bộ dữ liệu hiện tại của hệ thống thành một file JSON hoặc khôi phục dữ liệu từ một bản sao lưu trước đó.' 
                    : language === 'ja'
                      ? '現在のシステムデータをJSONファイルとしてバックアップするか、以前のバックアップから復元することができます。'
                      : 'You can backup all current system data into a JSON file, or restore data from a previous backup.'}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleBackupDatabase}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      padding: '0.75rem 1.5rem', 
                      fontWeight: 600,
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--primary-color)',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}
                  >
                    <Download size={18} />
                    <span>{language === 'vi' ? 'Backup Database' : language === 'ja' ? 'データベースのバックアップ' : 'Backup Database'}</span>
                  </button>

                  <label
                    className="btn btn-secondary"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      padding: '0.75rem 1.5rem', 
                      fontWeight: 600,
                      cursor: 'pointer',
                      margin: 0,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--status-clean)',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    <Upload size={18} />
                    <span>{language === 'vi' ? 'Import Database' : language === 'ja' ? 'データベースの復元' : 'Import Database'}</span>
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleImportDatabase} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* HOTEL CREATE/EDIT DIALOG MODAL */}
      {hotelModalOpen && (
        <div className="modal-overlay">
          <form className="modal-content glass-panel" onSubmit={handleHotelSubmit}>
            <h3 className="modal-title">{editingHotel ? 'Edit Hotel Branch' : getTranslation(language, 'addHotel')}</h3>
            
            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'hotelCode')}</label>
              <input
                type="text"
                className="form-input"
                required
                value={hotelForm.id}
                disabled={editingHotel !== null}
                onChange={e => setHotelForm({ ...hotelForm, id: e.target.value })}
                placeholder="e.g. ks3"
              />

              <span style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem', display: 'block' }}>
                {language === 'ja' ? '小文字の英数字のみ (例: ks3)' : language === 'vi' ? 'Chỉ gồm chữ thường và số (ví dụ: ks3)' : 'Lowercase alphanumeric only (e.g. ks3)'}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'hotelName')}</label>
              <input
                type="text"
                className="form-input"
                required
                value={hotelForm.name}
                onChange={e => setHotelForm({ ...hotelForm, name: e.target.value })}
                placeholder="e.g. Kyoto Plaza Hotel"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'description')}</label>
              <input
                type="text"
                className="form-input"
                value={hotelForm.description}
                onChange={e => setHotelForm({ ...hotelForm, description: e.target.value })}
                placeholder="e.g. Kyoto branch"
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
              <input
                type="checkbox"
                id="hotel-active-checkbox"
                checked={hotelForm.active}
                onChange={e => setHotelForm({ ...hotelForm, active: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0 }}
              />
              <label htmlFor="hotel-active-checkbox" style={{ fontWeight: 600, cursor: 'pointer', margin: 0, userSelect: 'none', fontSize: '0.9rem' }}>
                {language === 'vi' ? 'Hoạt động (Active)' : language === 'ja' ? '有効 (アクティブ)' : 'Active Status'}
              </label>
            </div>

            {!editingHotel && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  {language === 'vi' ? 'Khởi tạo danh sách phòng' : 'Initialize Room List'}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={hotelForm.roomsList}
                    onChange={e => setHotelForm({ ...hotelForm, roomsList: e.target.value })}
                    placeholder="e.g. 101, 102, 201"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (!hotelForm.roomsList.trim()) {
                        addToast('Please enter room list first', 'warning');
                        return;
                      }
                      setSimulatedRooms([]);
                      const roomsStr = hotelForm.roomsList.split(',').map(r => r.trim()).filter(r => r.length > 0);
                      setSimulatedRooms(roomsStr.map(r => ({ roomNumber: r, type: 'Single' })));
                    }}
                  >
                    🔍 {language === 'vi' ? 'Cấu hình chi tiết' : 'Setup Details'}
                  </button>
                </div>

                {simulatedRooms.length > 0 && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(0,0,0,0.05)', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {simulatedRooms.map((sr, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ fontWeight: 600 }}>Room {sr.roomNumber}</span>
                          <select
                            value={sr.type}
                            onChange={e => {
                               const next = [...simulatedRooms];
                               next[idx].type = e.target.value;
                               setSimulatedRooms(next);
                            }}
                            className="form-input"
                            style={{ width: '120px', padding: '0.2rem', fontSize: '0.75rem', height: 'auto' }}
                          >
                            <option value="Single">Single</option>
                            <option value="Double">Double</option>
                            <option value="Twin">Twin</option>
                            <option value="Suite">Suite</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setHotelModalOpen(false)}>
                {getTranslation(language, 'cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                {getTranslation(language, 'save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
