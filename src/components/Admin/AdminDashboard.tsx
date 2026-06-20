import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../Common/AppContext';
import { getTranslation } from '../../i18n/translations';
import { db } from '../../db/firebaseDB';
import type { Room, User, CleaningLog, Hotel as HotelType } from '../../db/dbInterface';
import { getLocalDB } from '../../db/localDB';
import {
  LayoutDashboard,
  Users,
  Building,
  ClipboardList,
  RotateCcw,
  Sun,
  Moon,
  LogOut,
  User as UserIcon
} from 'lucide-react';

import { GlobalStats } from './components/GlobalStats';
import { HotelManagementTab } from './components/HotelManagementTab';
import { UserManagementTab } from './components/UserManagementTab';
import { CleaningLogsTab } from './components/CleaningLogsTab';
import { HotelDetailsView } from './components/HotelDetailsView';

const getRoomsForHotelAndDate = (hotelId: string, date: string): Room[] => {
  const dateKey = `${hotelId}_hotel_clean_rooms_${date}`;
  const roomsStr = localStorage.getItem(dateKey);
  if (roomsStr) {
    try { return JSON.parse(roomsStr); } catch (e) {}
  }
  const masterKey = `${hotelId}_hotel_clean_rooms`;
  const masterStr = localStorage.getItem(masterKey);
  if (masterStr) {
    try { return JSON.parse(masterStr); } catch (e) {}
  }
  return [];
};

const getLogsForHotelAndDate = (hotelId: string, date: string): CleaningLog[] => {
  const logsKey = `${hotelId}_hotel_clean_logs`;
  const logsStr = localStorage.getItem(logsKey);
  if (logsStr) {
    try {
      const allLogs: CleaningLog[] = JSON.parse(logsStr);
      return allLogs.filter(log => log.endedAt.startsWith(date));
    } catch (e) {}
  }
  return [];
};

const getActiveStaffForHotelAndDate = (hotelId: string, date: string): string[] => {
  const key = `${hotelId}_active_staff_${date}`;
  const staffStr = localStorage.getItem(key);
  if (staffStr) {
    try { return JSON.parse(staffStr); } catch (e) {}
  }
  return [];
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
    addToast 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'logs' | 'hotels'>(() => {
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    const validTabs = ['stats', 'users', 'logs', 'hotels'];
    return (queryTab && validTabs.includes(queryTab)) ? (queryTab as 'stats' | 'users' | 'logs' | 'hotels') : 'stats';
  });
  
  const [branchTab, setBranchTab] = useState<'stats' | 'grid' | 'staff' | 'rooms' | 'linkStaff' | 'users'>('stats');
  
  // Database States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [hotelUsers, setHotelUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const selectedHotelId = hotelId;
  const [cleaners, setCleaners] = useState<User[]>([]);
  const [activeStaffIds, setActiveStaffIds] = useState<string[]>([]);
  
  const [usersPage, setUsersPage] = useState(() => {
    const queryPage = new URLSearchParams(window.location.search).get('page');
    const parsedPage = queryPage ? parseInt(queryPage, 10) : 1;
    return isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  });

  const [hotelSearchTerm, setHotelSearchTerm] = useState('');
  const [hotelFilterStatus, setHotelFilterStatus] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [hotelPage, setHotelPage] = useState(1);
  const [hotelPerPage, setHotelPerPage] = useState(5);

  // Form States (Create/Edit Hotel)
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<HotelType | null>(null);
  const [hotelForm, setHotelForm] = useState({ id: '', name: '', description: '', roomsList: '' });
  const [simulatedRooms, setSimulatedRooms] = useState<{ roomNumber: string; type: string }[]>([]);

  // Detailed branch states
  const [managingHotel, setManagingHotel] = useState<HotelType | null>(null);
  const [managingHotelStaff, setManagingHotelStaff] = useState<User[]>([]);

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
          selectHotel(foundHotel.id);
          if (branchTabParam && ['stats', 'grid', 'staff', 'rooms', 'linkStaff', 'users'].includes(branchTabParam)) {
            setBranchTab(branchTabParam as any);
          }
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
        const targetDb = getLocalDB(selectedHotelId);
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

    const targetDb = getLocalDB(selectedHotelId);

    const unsubRooms = targetDb.subscribeRooms(setRooms);
    const unsubLogs = targetDb.subscribeLogs(setLogs);

    const fetchUsers = async () => {
      const allGlobal = await targetDb.getAllGlobalUsers();
      const localUsers = allGlobal.filter(u => u.hotelIds?.includes(selectedHotelId));
      setGlobalUsers(allGlobal);
      setHotelUsers(localUsers);
    };
    fetchUsers();

    return () => {
      unsubRooms();
      unsubLogs();
    };
  }, [selectedHotelId]);

  // 4. Aggregated stats and global data for global '/admin' dashboard
  useEffect(() => {
    if (selectedHotelId !== 'admin') return;

    const allRooms: Room[] = [];
    const allLogs: CleaningLog[] = [];
    
    hotels.forEach(h => {
      const hotelRooms = getRoomsForHotelAndDate(h.id, activeDate);
      const mappedRooms = hotelRooms.map(r => ({
        ...r,
        id: `${h.id}_${r.id}` // Ensure unique keys across multiple hotels
      }));
      allRooms.push(...mappedRooms);
      
      const logsKey = `${h.id}_hotel_clean_logs`;
      const logsStr = localStorage.getItem(logsKey);
      if (logsStr) {
        try {
          const hotelLogs = JSON.parse(logsStr) as CleaningLog[];
          const mappedLogs = hotelLogs.map(l => ({
            ...l,
            id: `${h.id}_${l.id}` // Ensure unique keys across multiple hotels
          }));
          allLogs.push(...mappedLogs);
        } catch (e) {}
      }
    });
    
    setRooms(allRooms);
    setLogs(allLogs);

    const fetchUsers = async () => {
      const targetDb = getLocalDB('ks1');
      const allGlobal = await targetDb.getAllGlobalUsers();
      setGlobalUsers(allGlobal);
      setHotelUsers(allGlobal);
    };
    fetchUsers();
  }, [selectedHotelId, hotels, activeDate]);

  // 5. Initial hotel list load and refresh on mount or active hotel change
  useEffect(() => {
    refreshHotels();
  }, [selectedHotelId]);

  const refreshUsers = async () => {
    if (!selectedHotelId) return;
    const targetDb = getLocalDB(selectedHotelId === 'admin' ? 'ks1' : selectedHotelId);
    const allGlobal = await targetDb.getAllGlobalUsers();
    const localUsers = selectedHotelId === 'admin' 
      ? allGlobal 
      : allGlobal.filter(u => u.hotelIds?.includes(selectedHotelId));
    setGlobalUsers(allGlobal);
    setHotelUsers(localUsers);
  };

  const loadManagingHotelData = async (hotelId: string) => {
    try {
      const targetDb = getLocalDB(hotelId);
      const allGlobal = await targetDb.getAllGlobalUsers();
      const localStaff = allGlobal.filter(u => u.hotelIds?.includes(hotelId));
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
            type: existing ? existing.type : '1 Bed'
          };
        });
      });
    }
  }, [hotelForm.roomsList, hotelModalOpen, editingHotel, activeTab]);

  // CRUD actions for hotels list
  const refreshHotels = async () => {
    try {
      const list = await db.getHotels();
      setHotels(list);
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
    setHotelForm({ id: nextHotelId, name: '', description: '', roomsList: '' });
    setSimulatedRooms([]);
    setHotelModalOpen(true);
  };

  const handleEditHotelClick = (hotel: HotelType) => {
    setEditingHotel(hotel);
    setHotelForm({
      id: hotel.id,
      name: hotel.name,
      description: hotel.description || '',
      roomsList: ''
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
          description: hotelForm.description || undefined
        });
        addToast('Hotel branch updated successfully', 'success');
      } else {
        const finalRoomsList = simulatedRooms.length > 0
          ? simulatedRooms.map(sr => `${sr.roomNumber}:${sr.type}`).join(', ')
          : hotelForm.roomsList;

        await db.createHotel({
          id: hotelForm.id,
          name: hotelForm.name,
          description: hotelForm.description || undefined,
          roomsList: finalRoomsList
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

  const handleResetDatabase = () => {
    const confirmed = window.confirm(getTranslation(language, 'resetDatabaseConfirm'));
    if (confirmed) {
      localStorage.clear();
      addToast(language === 'vi' ? 'Đã reset cơ sở dữ liệu!' : 'Database reset successfully!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
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
      const hotelRooms = getRoomsForHotelAndDate(hotel.id, activeDate);
      const hotelLogs = getLogsForHotelAndDate(hotel.id, activeDate);
      const activeIds = getActiveStaffForHotelAndDate(hotel.id, activeDate);

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
  }, [hotels, activeDate]);

  // Reset hotel page when search, filter or selected stats date changes
  useEffect(() => {
    setHotelPage(1);
  }, [hotelSearchTerm, hotelFilterStatus, activeDate]);

  // Filter and Paginate Hotel Breakdown list for stats view
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

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / hotelPerPage) || 1;
    const currentPage = Math.min(Math.max(1, hotelPage), totalPages);
    const startIndex = (currentPage - 1) * hotelPerPage;
    const paginated = filtered.slice(startIndex, startIndex + hotelPerPage);

    return {
      displayed: paginated,
      totalPages,
      currentPage,
      totalItems
    };
  }, [hotels, globalStats.hotelBreakdowns, hotelSearchTerm, hotelFilterStatus, hotelPage, hotelPerPage]);

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
              processedHotelsData={processedHotelsData}
              setManagingHotel={setManagingHotel}
              selectHotel={selectHotel}
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
              processedHotelsData={processedHotelsData}
              handleAddHotelClick={handleAddHotelClick}
              handleEditHotelClick={handleEditHotelClick}
              handleDeleteHotel={handleDeleteHotel}
              setManagingHotel={setManagingHotel}
              selectHotel={selectHotel}
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
                      setSimulatedRooms(roomsStr.map(r => ({ roomNumber: r, type: '1 Bed' })));
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
                            <option value="1 Bed">1 Bed</option>
                            <option value="2 Beds">2 Beds</option>
                            <option value="3 Beds">3 Beds</option>
                            <option value="4 Beds">4 Beds</option>
                            <option value="Minpaku">Minpaku</option>
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
