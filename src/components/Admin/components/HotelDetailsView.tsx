import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Hotel,
  Users,
  Building,
  CheckCircle2,
  Clock,
  Plus,
  Edit2,
  Trash2,
  User as UserIcon,
  AlertTriangle
} from 'lucide-react';
import type { Room, User, CleaningLog, Hotel as HotelType } from '../../../db/dbInterface';
import { getLocalDB } from '../../../db/localDB';
import { UserManagementTab } from './UserManagementTab';

interface HotelDetailsViewProps {
  language: any;
  managingHotel: HotelType;
  setManagingHotel: (hotel: HotelType | null) => void;
  branchTab: 'stats' | 'grid' | 'staff' | 'rooms' | 'users' | 'linkStaff' | 'settings';
  setBranchTab: (tab: 'stats' | 'grid' | 'staff' | 'rooms' | 'users' | 'linkStaff' | 'settings') => void;
  activeDate: string;
  rooms: Room[];
  cleaners: User[];
  activeStaffIds: string[];
  setActiveStaffIds: React.Dispatch<React.SetStateAction<string[]>>;
  logs: CleaningLog[];
  globalUsers: User[];
  hotels: HotelType[];
  managingHotelStaff: User[];
  hotelUsers: User[];
  usersPage: number;
  setUsersPage: React.Dispatch<React.SetStateAction<number>>;
  refreshUsers: () => Promise<void>;
  loadManagingHotelData: (hotelId: string) => Promise<void>;
  refreshHotels?: () => Promise<void>;
  addToast: (msg: string, type: 'success' | 'warning' | 'info') => void;
  getTranslation: any;
  getVisiblePages: (curr: number, total: number) => (number | string)[];
}

const getNextEmployeeId = (role: User['role'], existingUsers: User[]) => {
  let prefix = 'cleaner';
  if (role === 'front_desk') prefix = 'front';
  else if (role === 'checka') prefix = 'check';
  else if (role === 'kacho') prefix = 'kacho';
  else if (role === 'admin') prefix = 'admin';
  else if (role === 'housekeeping') prefix = 'cleaner';

  let num = 1;
  while (existingUsers.some(u => u.username?.trim().toLowerCase() === `${prefix}${num}`)) {
    num++;
  }
  return `${prefix}${num}`;
};

export const HotelDetailsView: React.FC<HotelDetailsViewProps> = ({
  language,
  managingHotel,
  setManagingHotel,
  branchTab,
  setBranchTab,
  activeDate,
  rooms,
  cleaners,
  activeStaffIds,
  logs,
  globalUsers,
  hotels,
  managingHotelStaff,
  hotelUsers,
  usersPage,
  setUsersPage,
  refreshUsers,
  loadManagingHotelData,
  refreshHotels,
  addToast,
  getTranslation,
  getVisiblePages
}) => {
  // Local states for sub-management
  const [staffSearchTerm, setStaffSearchTerm] = useState<string>('');

  const [isDragOverBranch, setIsDragOverBranch] = useState<boolean>(false);
  const [isDragOverPool, setIsDragOverPool] = useState<boolean>(false);
  const [bulkRoomsText, setBulkRoomsText] = useState<string>('');

  
  // Quick staff creation
  const [subNewStaffOpen, setSubNewStaffOpen] = useState<boolean>(false);
  const [subNewStaffForm, setSubNewStaffForm] = useState({
    username: '',
    name: '',
    role: 'housekeeping' as User['role'],
    language: 'ja' as User['language']
  });

  // Quick room generation
  const [genFromFloor, setGenFromFloor] = useState<number>(1);
  const [genToFloor, setGenToFloor] = useState<number>(1);
  const [genRoomsPerFloor, setGenRoomsPerFloor] = useState<number>(1);

  // Main Room CRUD Modals
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [gridColumns, setGridColumns] = useState<string>(() => {
    return localStorage.getItem('hotel_clean_room_grid_columns') || 'auto';
  });

  const [defaultMinutesInput, setDefaultMinutesInput] = useState<number>(managingHotel.defaultCleanMinutes || 35);
  const [rtModalOpen, setRtModalOpen] = useState(false);
  const [editingRt, setEditingRt] = useState<{ id: string; name: string; cleanMinutes: number } | null>(null);
  const [rtForm, setRtForm] = useState({ name: '', cleanMinutes: 30 });

  useEffect(() => {
    setDefaultMinutesInput(managingHotel.defaultCleanMinutes || 35);
  }, [managingHotel]);
  const [roomForm, setRoomForm] = useState({ 
    roomNumber: '', 
    floor: 1, 
    type: 'Single', 
    status: 'vacant' as Room['status'],
    isStay: false,
    guestCount: 0,
    notes: '',
    priority: 'normal' as Room['priority']
  });

  // State variables for rooms tab search, filter, sort, pagination
  const [roomsSearchTerm, setRoomsSearchTerm] = useState('');
  const [roomsFloorFilter, setRoomsFloorFilter] = useState('all');
  const [roomsTypeFilter, setRoomsTypeFilter] = useState('all');
  const [roomsSortField, setRoomsSortField] = useState<'roomNumber' | 'floor'>('roomNumber');
  const [roomsSortOrder, setRoomsSortOrder] = useState<'asc' | 'desc'>('asc');
  const [roomsPage, setRoomsPage] = useState(1);
  const [roomsPerPage, setRoomsPerPage] = useState(10);

  // State variables for linkStaff tab search, pagination, and sorting
  const [linkedStaffSearchTerm, setLinkedStaffSearchTerm] = useState('');
  const [linkedStaffPage, setLinkedStaffPage] = useState(1);
  const [linkedStaffSortOrder, setLinkedStaffSortOrder] = useState<'asc' | 'desc'>('asc');
  const [unlinkedStaffPage, setUnlinkedStaffPage] = useState(1);
  const [unlinkedStaffSortOrder, setUnlinkedStaffSortOrder] = useState<'asc' | 'desc'>('asc');

  // State variables for stats tab leaderboard and defects search, pagination, and sorting
  const [leaderboardSearchTerm, setLeaderboardSearchTerm] = useState('');
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardPerPage, setLeaderboardPerPage] = useState(5);
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'count' | 'avgTime'>('count');
  const [leaderboardSortOrder, setLeaderboardSortOrder] = useState<'asc' | 'desc'>('desc');
  const [defectsPage, setDefectsPage] = useState(1);
  const [defectsPerPage, setDefectsPerPage] = useState(5);
   const [defectsSortField, setDefectsSortField] = useState<'name' | 'count'>('count');
  const [defectsSortOrder, setDefectsSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statsTimeRange, setStatsTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('today');

  // Load rooms and populate bulk text on init / update
  useEffect(() => {
    if (rooms.length > 0) {
      const roomEntries = [...rooms]
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
        .map(r => `${r.roomNumber}:${r.type}`);
      setBulkRoomsText(roomEntries.join(', '));
    } else {
      setBulkRoomsText('');
    }
  }, [rooms]);

  // Compute stats for current hotel branch
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

    // Filter logs based on statsTimeRange
    const activeDateObj = new Date(activeDate);
    const rangeLogs = logs.filter(log => {
      if (!log.endedAt || log.durationMinutes <= 0) return false;
      const logDateStr = log.endedAt.split('T')[0];
      
      if (statsTimeRange === 'today') {
        return logDateStr === activeDate;
      }
      
      const logDateObj = new Date(logDateStr);
      if (isNaN(logDateObj.getTime())) return false;
      
      const diffTime = activeDateObj.getTime() - logDateObj.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (statsTimeRange === 'week') {
        return diffDays >= 0 && diffDays < 7;
      } else if (statsTimeRange === 'month') {
        return diffDays >= 0 && diffDays < 30;
      } else { // statsTimeRange === 'year'
        return diffDays >= 0 && diffDays < 365;
      }
    });

    const activeWorkers = statsTimeRange === 'today'
      ? activeStaffIds.length
      : new Set(rangeLogs.map(l => l.cleanerId)).size;

    const totalDuration = rangeLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
    const finishedCount = rangeLogs.length;
    const avgCleaningTime = finishedCount > 0 ? Math.round(totalDuration / finishedCount) : 0;

    // Cleaner productivity leaderboard
    const cleanerMap: Record<string, { name: string; count: number; totalDuration: number }> = {};
    rangeLogs.forEach(log => {
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

    rangeLogs.forEach(log => {
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
      ? Math.round((rangeLogs.filter(l => l.errors && l.errors.length > 0).length / finishedCount) * 100)
      : 0;

    const errorBreakdown = Object.entries(errorTypeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const cleanerErrorLeaderboard = Object.values(cleanerErrorMap)
      .sort((a, b) => b.count - a.count);

    // Grouping trend data based on statsTimeRange
    let hourlyTrend: { label: string; out: number; stay: number; dnd: number; total: number }[] = [];

    if (statsTimeRange === 'today') {
      const hourlyBins: Record<number, { out: number; stay: number; dnd: number }> = {};
      for (let h = 8; h <= 18; h++) {
        hourlyBins[h] = { out: 0, stay: 0, dnd: 0 };
      }
      rangeLogs.forEach(log => {
        try {
          const dateObj = new Date(log.endedAt);
          if (!isNaN(dateObj.getTime())) {
            let hour = dateObj.getHours();
            if (hour < 8) hour = 8;
            if (hour > 18) hour = 18;
            
            const room = rooms.find(r => r.id === log.roomId);
            let category: 'out' | 'stay' | 'dnd' = 'out';
            if (room) {
              if (room.status === 'dnd') category = 'dnd';
              else if (room.isStay) category = 'stay';
            }
            hourlyBins[hour][category]++;
          }
        } catch (e) {}
      });

      hourlyTrend = Object.keys(hourlyBins).map(hStr => {
        const h = Number(hStr);
        const label = h === 18 ? '18:00+' : `${h.toString().padStart(2, '0')}:00`;
        const bin = hourlyBins[h];
        return {
          label,
          out: bin.out,
          stay: bin.stay,
          dnd: bin.dnd,
          total: bin.out + bin.stay + bin.dnd
        };
      });

    } else if (statsTimeRange === 'week' || statsTimeRange === 'month') {
      const daysCount = statsTimeRange === 'week' ? 7 : 30;
      const dailyBins: Record<string, { out: number; stay: number; dnd: number }> = {};
      
      const daysList: string[] = [];
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(activeDateObj);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        daysList.push(dStr);
        dailyBins[dStr] = { out: 0, stay: 0, dnd: 0 };
      }

      rangeLogs.forEach(log => {
        const logDateStr = log.endedAt.split('T')[0];
        if (dailyBins[logDateStr]) {
          const room = rooms.find(r => r.id === log.roomId);
          let category: 'out' | 'stay' | 'dnd' = 'out';
          if (room) {
            if (room.status === 'dnd') category = 'dnd';
            else if (room.isStay) category = 'stay';
          }
          dailyBins[logDateStr][category]++;
        }
      });

      hourlyTrend = daysList.map(dStr => {
        const bin = dailyBins[dStr];
        const dateParts = dStr.split('-');
        const label = `${dateParts[2]}/${dateParts[1]}`; // DD/MM
        return {
          label,
          out: bin.out,
          stay: bin.stay,
          dnd: bin.dnd,
          total: bin.out + bin.stay + bin.dnd
        };
      });

    } else { // statsTimeRange === 'year'
      const monthlyBins: Record<string, { out: number; stay: number; dnd: number }> = {};
      const monthsList: string[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const d = new Date(activeDateObj.getFullYear(), activeDateObj.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${yyyy}-${mm}`;
        monthsList.push(key);
        monthlyBins[key] = { out: 0, stay: 0, dnd: 0 };
      }

      rangeLogs.forEach(log => {
        try {
          const logDateStr = log.endedAt.split('T')[0];
          const key = logDateStr.substring(0, 7);
          if (monthlyBins[key]) {
            const room = rooms.find(r => r.id === log.roomId);
            let category: 'out' | 'stay' | 'dnd' = 'out';
            if (room) {
              if (room.status === 'dnd') category = 'dnd';
              else if (room.isStay) category = 'stay';
            }
            monthlyBins[key][category]++;
          }
        } catch (e) {}
      });

      hourlyTrend = monthsList.map(key => {
        const bin = monthlyBins[key];
        const parts = key.split('-');
        const label = `${parts[1]}/${parts[0].substring(2)}`; // MM/YY
        return {
          label,
          out: bin.out,
          stay: bin.stay,
          dnd: bin.dnd,
          total: bin.out + bin.stay + bin.dnd
        };
      });
    }

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
      cleanerErrorLeaderboard,
      finishedCount
    };
  }, [rooms, logs, activeStaffIds, activeDate, statsTimeRange]);

  // Computed helper memos for rooms, staff, and rankings list components
  const roomsUniqueFloors = useMemo(() => {
    const floors = rooms.map(r => r.floor);
    return Array.from(new Set(floors)).sort((a, b) => a - b);
  }, [rooms]);

  const roomsUniqueTypes = useMemo(() => {
    const types = rooms.map(r => r.type);
    return Array.from(new Set(types)).sort();
  }, [rooms]);

  const filteredRoomsList = useMemo(() => {
    return rooms.filter(room => {
      const term = roomsSearchTerm.trim().toLowerCase();
      const matchesSearch = !term || room.roomNumber.toLowerCase().includes(term);
      const matchesFloor = roomsFloorFilter === 'all' || room.floor.toString() === roomsFloorFilter;
      const matchesType = roomsTypeFilter === 'all' || room.type === roomsTypeFilter;
      return matchesSearch && matchesFloor && matchesType;
    });
  }, [rooms, roomsSearchTerm, roomsFloorFilter, roomsTypeFilter]);

  const sortedRoomsList = useMemo(() => {
    return [...filteredRoomsList].sort((a, b) => {
      let valA = a[roomsSortField];
      let valB = b[roomsSortField];

      if (roomsSortField === 'roomNumber') {
        const strA = String(valA);
        const strB = String(valB);
        return roomsSortOrder === 'asc'
          ? strA.localeCompare(strB, undefined, { numeric: true })
          : strB.localeCompare(strA, undefined, { numeric: true });
      }

      if (valA < valB) return roomsSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return roomsSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRoomsList, roomsSortField, roomsSortOrder]);

  const paginatedRoomsList = useMemo(() => {
    if (roomsPerPage === 0) return sortedRoomsList;
    const startIdx = (roomsPage - 1) * roomsPerPage;
    return sortedRoomsList.slice(startIdx, startIdx + roomsPerPage);
  }, [sortedRoomsList, roomsPage, roomsPerPage]);

  const totalRoomsPages = useMemo(() => {
    if (roomsPerPage === 0) return 1;
    return Math.ceil(sortedRoomsList.length / roomsPerPage) || 1;
  }, [sortedRoomsList, roomsPerPage]);

  useEffect(() => {
    setRoomsPage(1);
  }, [roomsSearchTerm, roomsFloorFilter, roomsTypeFilter, roomsSortField, roomsSortOrder, roomsPerPage]);

  const filteredLinkedStaff = useMemo(() => {
    return managingHotelStaff.filter(u => {
      const term = linkedStaffSearchTerm.toLowerCase().trim();
      return !term || u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term);
    });
  }, [managingHotelStaff, linkedStaffSearchTerm]);

  const sortedLinkedStaff = useMemo(() => {
    return [...filteredLinkedStaff].sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return linkedStaffSortOrder === 'asc'
        ? nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
        : nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
    });
  }, [filteredLinkedStaff, linkedStaffSortOrder]);

  const paginatedLinkedStaff = useMemo(() => {
    const limit = 10;
    const startIdx = (linkedStaffPage - 1) * limit;
    return sortedLinkedStaff.slice(startIdx, startIdx + limit);
  }, [sortedLinkedStaff, linkedStaffPage]);

  const totalLinkedStaffPages = useMemo(() => {
    return Math.ceil(sortedLinkedStaff.length / 10) || 1;
  }, [sortedLinkedStaff]);

  useEffect(() => {
    setLinkedStaffPage(1);
  }, [linkedStaffSearchTerm, linkedStaffSortOrder]);

  const filteredUnlinkedUsers = useMemo(() => {
    return globalUsers.filter(u => 
      !u.hotelIds?.includes(managingHotel.id) &&
      u.status !== 'quit' &&
      (u.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) || 
       u.username.toLowerCase().includes(staffSearchTerm.toLowerCase()))
    );
  }, [globalUsers, managingHotel.id, staffSearchTerm]);

  const sortedUnlinkedUsers = useMemo(() => {
    return [...filteredUnlinkedUsers].sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return unlinkedStaffSortOrder === 'asc'
        ? nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
        : nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
    });
  }, [filteredUnlinkedUsers, unlinkedStaffSortOrder]);

  const paginatedUnlinkedUsers = useMemo(() => {
    const limit = 10;
    const startIdx = (unlinkedStaffPage - 1) * limit;
    return sortedUnlinkedUsers.slice(startIdx, startIdx + limit);
  }, [sortedUnlinkedUsers, unlinkedStaffPage]);

  const totalUnlinkedStaffPages = useMemo(() => {
    return Math.ceil(sortedUnlinkedUsers.length / 10) || 1;
  }, [sortedUnlinkedUsers]);

  useEffect(() => {
    setUnlinkedStaffPage(1);
  }, [staffSearchTerm, unlinkedStaffSortOrder]);

  const filteredLeaderboard = useMemo(() => {
    const list = branchStats ? (branchStats.leaderboard || []) : [];
    return list.filter(cleaner => {
      const term = leaderboardSearchTerm.toLowerCase().trim();
      return !term || cleaner.name.toLowerCase().includes(term);
    });
  }, [branchStats, leaderboardSearchTerm]);

  const sortedLeaderboard = useMemo(() => {
    return [...filteredLeaderboard].sort((a, b) => {
      let comparison = 0;
      if (leaderboardSortBy === 'count') {
        comparison = b.count - a.count || a.avgTime - b.avgTime;
      } else {
        comparison = a.avgTime - b.avgTime || b.count - a.count;
      }
      return leaderboardSortOrder === 'desc' ? comparison : -comparison;
    });
  }, [filteredLeaderboard, leaderboardSortBy, leaderboardSortOrder]);

  const paginatedLeaderboard = useMemo(() => {
    if (leaderboardPerPage === 0) return sortedLeaderboard;
    const startIdx = (leaderboardPage - 1) * leaderboardPerPage;
    return sortedLeaderboard.slice(startIdx, startIdx + leaderboardPerPage);
  }, [sortedLeaderboard, leaderboardPage, leaderboardPerPage]);

  const totalLeaderboardPages = useMemo(() => {
    if (leaderboardPerPage === 0) return 1;
    return Math.ceil(sortedLeaderboard.length / leaderboardPerPage) || 1;
  }, [sortedLeaderboard, leaderboardPerPage]);

  useEffect(() => {
    setLeaderboardPage(1);
  }, [leaderboardSearchTerm, leaderboardPerPage, leaderboardSortBy, leaderboardSortOrder]);

  const sortedDefectsLeaderboard = useMemo(() => {
    const list = branchStats ? (branchStats.cleanerErrorLeaderboard || []) : [];
    return [...list].sort((a, b) => {
      if (defectsSortField === 'name') {
        return defectsSortOrder === 'asc'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      } else {
        return defectsSortOrder === 'asc'
          ? a.count - b.count
          : b.count - a.count;
      }
    });
  }, [branchStats, defectsSortField, defectsSortOrder]);

  const paginatedDefectsLeaderboard = useMemo(() => {
    if (defectsPerPage === 0) return sortedDefectsLeaderboard;
    const startIdx = (defectsPage - 1) * defectsPerPage;
    return sortedDefectsLeaderboard.slice(startIdx, startIdx + defectsPerPage);
  }, [sortedDefectsLeaderboard, defectsPage, defectsPerPage]);

  const totalDefectsPages = useMemo(() => {
    if (defectsPerPage === 0) return 1;
    return Math.ceil(sortedDefectsLeaderboard.length / defectsPerPage) || 1;
  }, [sortedDefectsLeaderboard, defectsPerPage]);

  useEffect(() => {
    setDefectsPage(1);
  }, [defectsPerPage, defectsSortField, defectsSortOrder]);



  // LINK EXISTING SYSTEM STAFF MEMBER
  const handleLinkStaffById = async (userId: string) => {
    if (!managingHotel || !userId) return;
    try {
      const targetDb = getLocalDB(managingHotel.id);
      const user = globalUsers.find(u => u.id === userId);
      if (!user) return;

      const nextHotelIds = [...(user.hotelIds || [])];
      if (!nextHotelIds.includes(managingHotel.id)) {
        nextHotelIds.push(managingHotel.id);
      }

      await targetDb.updateUser({
        ...user,
        hotelIds: nextHotelIds
      });

      addToast(
        language === 'vi' ? `Đã liên kết nhân sự ${user.name}` : `Linked staff ${user.name}`,
        'success'
      );
      await refreshUsers();
      await loadManagingHotelData(managingHotel.id);
    } catch (err: any) {
      addToast(err.message || 'Error linking staff', 'warning');
    }
  };

  // UNLINK STAFF MEMBER FROM THIS BRANCH
  const handleUnlinkStaff = async (userId: string) => {
    if (!managingHotel) return;
    try {
      const targetDb = getLocalDB(managingHotel.id);
      const user = globalUsers.find(u => u.id === userId);
      if (!user) return;

      if (user.username?.trim().toLowerCase() === 'admin') {
        addToast(
          language === 'vi' ? 'Không thể hủy liên kết tài khoản admin hệ thống' : 'Cannot unlink the main admin account',
          'warning'
        );
        return;
      }

      const nextHotelIds = (user.hotelIds || []).filter(id => id !== managingHotel.id);

      if (nextHotelIds.length === 0) {
        await targetDb.deleteUserCompletely(userId);
      } else {
        await targetDb.updateUser({
          ...user,
          hotelIds: nextHotelIds
        });
      }

      addToast(
        language === 'vi' ? 'Đã hủy liên kết nhân sự' : 'Unlinked staff from hotel',
        'success'
      );
      await refreshUsers();
      await loadManagingHotelData(managingHotel.id);
    } catch (err: any) {
      addToast(err.message || 'Error unlinking staff', 'warning');
    }
  };

  // QUICK CREATE NEW STAFF MEMBER FROM DRAG & DROP POOL
  const handleSubCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingHotel) return;
    try {
      const targetDb = getLocalDB(managingHotel.id);
      
      const exists = globalUsers.some(u => u.username.trim().toLowerCase() === subNewStaffForm.username.trim().toLowerCase());
      if (exists) {
        addToast(
          language === 'vi' ? 'Tên đăng nhập đã tồn tại trên hệ thống' : 'Username already exists',
          'warning'
        );
        return;
      }

      await targetDb.createUser({
        username: subNewStaffForm.username,
        name: subNewStaffForm.name,
        role: subNewStaffForm.role,
        language: 'ja',
        hotelIds: [managingHotel.id],
        status: 'working'
      });

      addToast(
        language === 'vi' ? 'Tạo mới nhân sự và liên kết thành công' : 'Successfully created and linked staff',
        'success'
      );
      
      setSubNewStaffOpen(false);
      setSubNewStaffForm({
        username: '',
        name: '',
        role: 'housekeeping',
        language: 'ja'
      });

      await refreshUsers();
      await loadManagingHotelData(managingHotel.id);
    } catch (err: any) {
      addToast(err.message || 'Error creating staff', 'warning');
    }
  };
  // BULK ROOMS LIST TEXTAREA SUBMIT
  const handleBulkRoomsUpdate = async () => {
    if (!managingHotel) return;
    try {
      const targetDb = getLocalDB(managingHotel.id);
      
      const parsedRooms = bulkRoomsText
        .split(',')
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => {
          const parts = r.split(':');
          const roomNumber = parts[0].trim();
          const type = parts[1] ? parts[1].trim() : '1 Bed';
          return { roomNumber, type };
        });

      const newRoomNumbers = parsedRooms.map(pr => pr.roomNumber);
      const currentRoomNumbers = rooms.map(r => r.roomNumber);

      const toDelete = currentRoomNumbers.filter(num => !newRoomNumbers.includes(num));
      const toCreate = parsedRooms.filter(pr => !currentRoomNumbers.includes(pr.roomNumber));
      const toUpdate = parsedRooms.filter(pr => currentRoomNumbers.includes(pr.roomNumber));

      for (const num of toDelete) {
        await targetDb.deleteRoom(num);
      }

      const getFloorFromRoomNumber = (num: string): number => {
        const match = num.match(/^(\d+)/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (parsed >= 100) {
            return Math.floor(parsed / 100);
          }
          return parsed;
        }
        return 1;
      };

      for (const pr of toCreate) {
        await targetDb.createRoom({
          id: pr.roomNumber,
          roomNumber: pr.roomNumber,
          floor: getFloorFromRoomNumber(pr.roomNumber),
          type: pr.type,
          status: 'vacant',
          isStay: false,
          guestCount: 0
        });
      }

      for (const pr of toUpdate) {
        const existingRoom = rooms.find(r => r.roomNumber === pr.roomNumber);
        if (existingRoom && existingRoom.type !== pr.type) {
          await targetDb.updateRoom({
            ...existingRoom,
            type: pr.type,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Admin'
          });
        }
      }

      addToast(
        language === 'vi' 
          ? `Cập nhật phòng thành công: Thêm ${toCreate.length} phòng, Xóa ${toDelete.length} phòng.`
          : `Rooms updated successfully: Added ${toCreate.length}, Deleted ${toDelete.length}.`,
        'success'
      );

      await loadManagingHotelData(managingHotel.id);
    } catch (err: any) {
      addToast(err.message || 'Error updating rooms list', 'warning');
    }
  };

  // ROOM CRUD BUTTON TRIGGERS
  const handleAddRoomClick = () => {
    setEditingRoom(null);
    setRoomForm({ roomNumber: '', floor: 1, type: '1 Bed', status: 'vacant', isStay: false, guestCount: 0, notes: '', priority: 'normal' });
    setRoomModalOpen(true);
  };

  const handleEditRoomClick = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({ 
      roomNumber: room.roomNumber, 
      floor: room.floor, 
      type: room.type, 
      status: room.status,
      isStay: room.isStay,
      guestCount: room.guestCount,
      notes: room.notes || '',
      priority: room.priority || 'normal'
    });
    setRoomModalOpen(true);
  };

  const handleDeleteRoom = async (id: string, roomNumber?: string) => {
    const label = roomNumber ? ` phòng ${roomNumber}` : '';
    const confirmMsg = language === 'vi' 
      ? `Bạn có chắc chắn muốn xóa${label}?` 
      : language === 'ja' 
        ? `本当に客室${roomNumber || id}を削除しますか？` 
        : `Are you sure you want to delete room ${roomNumber || id}?`;
        
    if (window.confirm(confirmMsg)) {
      await getLocalDB(managingHotel.id).deleteRoom(id);
      addToast(
        language === 'vi' 
          ? `Đã xóa phòng ${roomNumber || id}` 
          : language === 'ja' 
            ? `客室 ${roomNumber || id} を削除しました` 
            : `Room ${roomNumber || id} deleted successfully`, 
        'success'
      );
      await loadManagingHotelData(managingHotel.id);
    }
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetDb = getLocalDB(managingHotel.id);
      if (editingRoom) {
        await targetDb.updateRoom({
          ...editingRoom,
          roomNumber: roomForm.roomNumber,
          floor: Number(roomForm.floor),
          type: roomForm.type,
          guestCount: Number(roomForm.guestCount),
          notes: roomForm.notes || undefined,
          priority: roomForm.priority
        });
        addToast('Room updated successfully', 'success');
      } else {
        await targetDb.createRoom({
          id: roomForm.roomNumber,
          roomNumber: roomForm.roomNumber,
          floor: Number(roomForm.floor),
          type: roomForm.type,
          status: 'vacant',
          isStay: false,
          guestCount: Number(roomForm.guestCount),
          notes: roomForm.notes || undefined,
          priority: roomForm.priority
        });
        addToast('Room added successfully', 'success');
      }
      setRoomModalOpen(false);
      await loadManagingHotelData(managingHotel.id);
    } catch (err) {
      console.error(err);
      addToast('Error saving room details', 'warning');
    }
  };

  const getFormattedRoomType = (type: string) => {
    if (!type) return '';
    const t = type.toLowerCase().trim();
    if (t === '1 bed') return language === 'vi' ? '1 Giường' : language === 'ja' ? '1ベッド' : '1 Bed';
    if (t === '2 beds') return language === 'vi' ? '2 Giường' : language === 'ja' ? '2ベッド' : '2 Beds';
    if (t === '3 beds') return language === 'vi' ? '3 Giường' : language === 'ja' ? '3ベッド' : '3 Beds';
    if (t === '4 beds') return language === 'vi' ? '4 Giường' : language === 'ja' ? '4ベッド' : '4 Beds';
    if (t === 'minpaku') return 'Minpaku / Homestay';
    return type;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setManagingHotel(null);
                setBranchTab('stats');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              &larr; {language === 'vi' ? 'Quay lại' : language === 'ja' ? '戻る' : 'Back'}
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              🏨 {language === 'vi' ? `Quản lý chi nhánh: ${managingHotel.name}` : `Manage Branch: ${managingHotel.name}`}
            </h3>
          </div>
          <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>
            {managingHotel.description || '-'} (Code: <code>{managingHotel.id}</code>)
          </p>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="branch-subtabs branch-subtabs-desktop glass-panel">
        <button
          className={`btn btn-sm ${branchTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setBranchTab('stats')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
        >
          <LayoutDashboard size={14} />
          <span>{language === 'vi' ? 'Thống kê' : language === 'ja' ? '分析統計' : 'Analytics'}</span>
        </button>
        <button
          className={`btn btn-sm ${branchTab === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setBranchTab('grid')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
        >
          <Hotel size={14} />
          <span>{language === 'vi' ? 'Sơ đồ phòng' : language === 'ja' ? '客室状況 (Grid)' : 'Room Grid'}</span>
        </button>

        <button
          className={`btn btn-sm ${branchTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setBranchTab('rooms')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
        >
          <Building size={14} />
          <span>{language === 'vi' ? 'Quản lý phòng' : language === 'ja' ? '客室管理' : 'Room Management'}</span>
        </button>
        <button
          className={`btn btn-sm ${branchTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setBranchTab('users');
            setUsersPage(1);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
        >
          <UserIcon size={14} />
          <span>{language === 'vi' ? 'Quản lý nhân sự' : language === 'ja' ? 'スタッフ管理' : 'Staff Management'}</span>
        </button>
        <button
          className={`btn btn-sm ${branchTab === 'linkStaff' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setBranchTab('linkStaff')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
        >
          <Users size={14} />
          <span>{language === 'vi' ? 'Liên kết nhân sự' : language === 'ja' ? 'スタッフ連携' : 'Link Staff'}</span>
        </button>
        <button
          className={`btn btn-sm ${branchTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setBranchTab('settings')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
        >
          <Clock size={14} />
          <span>{language === 'vi' ? 'Loại phòng & Cài đặt' : language === 'ja' ? '部屋タイプ・設定' : 'Room Types & Settings'}</span>
        </button>
      </div>

      {/* Mobile sub-tab select dropdown */}
      <div className="branch-subtabs-mobile glass-panel" style={{ padding: '0.75rem', marginBottom: '1.25rem' }}>
        <label className="form-label" style={{ marginBottom: '0.4rem', fontSize: '0.8rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
          {language === 'vi' ? 'Chọn tính năng quản lý' : language === 'ja' ? '管理機能を選択' : 'Select Management Feature'}
        </label>
        <select
          className="form-input"
          value={branchTab}
          onChange={(e) => {
            const val = e.target.value as any;
            setBranchTab(val);
            if (val === 'users') {
              setUsersPage(1);
            }
          }}
          style={{
            width: '100%',
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: '0.6rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.1)',
            outline: 'none',
            cursor: 'pointer',
            backgroundColor: 'rgba(0,0,0,0.02)',
            color: 'inherit',
            height: 'auto'
          }}
        >
          <option value="stats">📊 {language === 'vi' ? 'Thống kê' : language === 'ja' ? '分析統計' : 'Analytics'}</option>
          <option value="grid">🏨 {language === 'vi' ? 'Sơ đồ phòng' : language === 'ja' ? '客室状況 (Grid)' : 'Room Grid'}</option>

          <option value="rooms">🚪 {language === 'vi' ? 'Quản lý phòng' : language === 'ja' ? '客室管理' : 'Room Management'}</option>
          <option value="users">👥 {language === 'vi' ? 'Quản lý nhân sự' : language === 'ja' ? 'スタッフ管理' : 'Staff Management'}</option>
          <option value="linkStaff">🔗 {language === 'vi' ? 'Liên kết nhân sự' : language === 'ja' ? 'スタッフ連携' : 'Link Staff'}</option>
          <option value="settings">⚙️ {language === 'vi' ? 'Loại phòng & Cài đặt' : language === 'ja' ? '部屋タイプ・設定' : 'Room Types & Settings'}</option>
        </select>
      </div>

      {/* Sub-tab Contents */}
      {branchTab === 'stats' && branchStats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Stats Time Range Switcher */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.5rem' }}>
            <div className="capsule-switcher" style={{ display: 'inline-flex' }}>
              <button 
                type="button"
                onClick={() => setStatsTimeRange('today')}
                className={`capsule-button ${statsTimeRange === 'today' ? 'active' : ''}`}
              >
                <span>📅</span>
                <span>{language === 'vi' ? 'Hôm nay' : language === 'ja' ? '本日' : 'Today'}</span>
              </button>
              <button 
                type="button"
                onClick={() => setStatsTimeRange('week')}
                className={`capsule-button ${statsTimeRange === 'week' ? 'active' : ''}`}
              >
                <span>📊</span>
                <span>{language === 'vi' ? 'Tuần này' : language === 'ja' ? '今週' : 'This Week'}</span>
              </button>
              <button 
                type="button"
                onClick={() => setStatsTimeRange('month')}
                className={`capsule-button ${statsTimeRange === 'month' ? 'active' : ''}`}
              >
                <span>📈</span>
                <span>{language === 'vi' ? 'Tháng này' : language === 'ja' ? '今月' : 'This Month'}</span>
              </button>
              <button 
                type="button"
                onClick={() => setStatsTimeRange('year')}
                className={`capsule-button ${statsTimeRange === 'year' ? 'active' : ''}`}
              >
                <span>📅</span>
                <span>{language === 'vi' ? 'Năm nay' : language === 'ja' ? '今年' : 'This Year'}</span>
              </button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="metrics-grid">
            {/* Progress Card / Total Cleaned Card */}
            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-clean)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)' }}>
                <CheckCircle2 size={20} />
              </div>
              <div style={{ flex: 1 }}>
                {statsTimeRange === 'today' ? (
                  <>
                    <div className="metric-value">{branchStats.percentClean}%</div>
                    <div className="metric-label">{language === 'vi' ? 'Tiến độ dọn phòng' : language === 'ja' ? '清縮進捗率' : 'Cleaning Progress'}</div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden', marginTop: '0.4rem' }}>
                      <div style={{ width: `${branchStats.percentClean}%`, height: '100%', backgroundColor: 'var(--status-clean)' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="metric-value">{branchStats.finishedCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{language === 'vi' ? 'phòng' : language === 'ja' ? '室' : 'rooms'}</span></div>
                    <div className="metric-label">
                      {statsTimeRange === 'week' 
                        ? (language === 'vi' ? 'Tổng phòng dọn tuần qua' : language === 'ja' ? '週間清掃完了合計' : 'Weekly Total Cleaned')
                        : (language === 'vi' ? 'Tổng phòng dọn tháng qua' : language === 'ja' ? '月間清掃完了合計' : 'Monthly Total Cleaned')}
                    </div>
                  </>
                )}
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
                  {language === 'vi' ? `Tính từ ${branchStats.finishedCount} lượt hoàn thành` : language === 'ja' ? `完了${branchStats.finishedCount}件に基づく` : `Based on ${branchStats.finishedCount} completions`}
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
                <div className="metric-label">
                  {statsTimeRange === 'today'
                    ? (language === 'vi' ? 'Nhân sự làm việc hôm nay' : language === 'ja' ? '本日の出勤スタッフ数' : 'Active Staff Today')
                    : (language === 'vi' ? 'Nhân sự hoạt động trong kì' : language === 'ja' ? '出動スタッフ数' : 'Active Staff in Period')}
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                  {statsTimeRange === 'today' ? (
                    language === 'vi' ? `Trên tổng số ${cleaners.length} nhân viên` : language === 'ja' ? `登録スタッフ数: ${cleaners.length}名` : `Out of ${cleaners.length} cleaners`
                  ) : (
                    language === 'vi' ? `Tổng số nhân viên đã thực hiện dọn dẹp` : language === 'ja' ? `実際に稼働した清掃スタッフの合計` : `Total active housekeepers`
                  )}
                </div>
              </div>
            </div>

            {/* Setup / Defects Card */}
            <div className="metric-card glass-panel" style={{ borderLeft: statsTimeRange === 'today' ? '4px solid var(--status-dirty)' : '4px solid var(--status-maintenance)' }}>
              <div className="metric-icon" style={{ 
                backgroundColor: statsTimeRange === 'today' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                color: statsTimeRange === 'today' ? 'var(--status-dirty)' : 'var(--status-maintenance)' 
              }}>
                {statsTimeRange === 'today' ? <Building size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div>
                {statsTimeRange === 'today' ? (
                  <>
                    <div className="metric-value">{branchStats.total} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{language === 'vi' ? 'phòng' : language === 'ja' ? '室' : 'rooms'}</span></div>
                    <div className="metric-label">{language === 'vi' ? 'Tỉ lệ Stay / Checkout' : language === 'ja' ? '滞在 / アウト比率' : 'Stay / Checkout Ratio'}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                      🏠 {branchStats.stayRooms} {language === 'vi' ? 'Stay' : language === 'ja' ? '滞在' : 'Stay'} | 🚪 {branchStats.checkoutRooms} Checkout
                    </div>
                  </>
                ) : (
                  <>
                    <div className="metric-value" style={{ color: 'var(--status-maintenance)' }}>
                      {branchStats.totalErrors} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-color)' }}>{language === 'vi' ? 'lỗi' : language === 'ja' ? '不備' : 'defects'}</span>
                    </div>
                    <div className="metric-label">{language === 'vi' ? 'Thống kê lỗi trong kì' : language === 'ja' ? '期間中の不備指摘数' : 'Defects in Period'}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                      ⚠️ {language === 'vi' ? `Tỉ lệ lỗi phòng: ${branchStats.defectRate}%` : language === 'ja' ? `部屋指摘率: ${branchStats.defectRate}%` : `Defect rate: ${branchStats.defectRate}%`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1.5rem' }}>
            {/* Status Distribution */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                {language === 'vi' ? 'Phân Bổ Trạng Thái Phòng' : language === 'ja' ? '客室ステータス内訳' : 'Room Status Distribution'}
              </h4>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
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
                          return <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="rgba(0,0,0,0.1)" strokeWidth="20" />;
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
                    <text x="100" y="95" textAnchor="middle" dominantBaseline="middle" fill="currentColor" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                      {branchStats.total}
                    </text>
                    <text x="100" y="118" textAnchor="middle" dominantBaseline="middle" fill="currentColor" style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 600 }}>
                      {language === 'vi' ? 'TỔNG PHÒNG' : language === 'ja' ? '部屋合計' : 'ROOMS'}
                    </text>
                  </svg>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '130px' }}>
                  {[
                    { label: language === 'vi' ? 'Sạch (Clean)' : language === 'ja' ? '清掃済' : 'Clean', value: branchStats.clean, color: 'var(--status-clean)' },
                    { label: language === 'vi' ? 'Bần (Dirty)' : language === 'ja' ? '未清掃' : 'Dirty', value: branchStats.dirty, color: 'var(--status-dirty)' },
                    { label: language === 'vi' ? 'Đang dọn (Cleaning)' : language === 'ja' ? '清掃中' : 'Cleaning', value: branchStats.cleaning, color: 'var(--status-cleaning)' },
                    { label: language === 'vi' ? 'Bảo trì (Maint)' : language === 'ja' ? '故障中' : 'Maintenance', value: branchStats.maintenance, color: 'var(--status-maintenance)' },
                    { label: 'Eco Clean', value: branchStats.eco, color: '#6366f1' },
                    { label: 'DND', value: branchStats.dnd, color: '#a855f7' },
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

            {/* Hourly Completion Trend */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                {statsTimeRange === 'today'
                  ? (language === 'vi' ? 'Lượng Hoàn Thành Theo Giờ' : language === 'ja' ? '時間帯別清掃完了数' : 'Hourly Completion Trend')
                  : statsTimeRange === 'week' || statsTimeRange === 'month'
                    ? (language === 'vi' ? 'Lượng Hoàn Thành Theo Ngày' : language === 'ja' ? '日別清掃完了数' : 'Daily Completion Trend')
                    : (language === 'vi' ? 'Lượng Hoàn Thành Theo Tháng' : language === 'ja' ? '月別清掃完了数' : 'Monthly Completion Trend')
                }
              </h4>
              
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(() => {
                  const maxCount = Math.max(...branchStats.hourlyTrend.map(t => t.total), 4);
                  const width = 380;
                  const height = 180;
                  const paddingLeft = 25;
                  const paddingBottom = 25;
                  const paddingTop = 20;
                  const paddingRight = 10;
                  
                  const usableWidth = width - paddingLeft - paddingRight;
                  const usableHeight = height - paddingTop - paddingBottom;
                  
                  const colWidth = usableWidth / branchStats.hourlyTrend.length;
                  const barWidth = Math.max(4, colWidth - 6);

                  return (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
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
                          const outHeight = (t.out / maxCount) * usableHeight;
                          const stayHeight = (t.stay / maxCount) * usableHeight;
                          const dndHeight = (t.dnd / maxCount) * usableHeight;
                          
                          const x = paddingLeft + i * colWidth + (colWidth - barWidth) / 2;
                          
                          const outY = height - paddingBottom - outHeight;
                          const stayY = outY - stayHeight;
                          const dndY = stayY - dndHeight;

                          const showLabelText = branchStats.hourlyTrend.length <= 12 || i % 5 === 0 || i === branchStats.hourlyTrend.length - 1;

                          return (
                            <g key={i}>
                              {/* Out bar (Red) */}
                              {t.out > 0 && (
                                <rect
                                  x={x}
                                  y={outY}
                                  width={barWidth}
                                  height={outHeight}
                                  rx="1"
                                  fill="#ef4444"
                                  opacity={0.85}
                                  style={{ transition: 'all 0.5s ease' }}
                                />
                              )}
                              
                              {/* Stay bar (Purple) */}
                              {t.stay > 0 && (
                                <rect
                                  x={x}
                                  y={stayY}
                                  width={barWidth}
                                  height={stayHeight}
                                  rx="1"
                                  fill="#8b5cf6"
                                  opacity={0.85}
                                  style={{ transition: 'all 0.5s ease' }}
                                />
                              )}
                              
                              {/* DND bar (Slate/DND) */}
                              {t.dnd > 0 && (
                                <rect
                                  x={x}
                                  y={dndY}
                                  width={barWidth}
                                  height={dndHeight}
                                  rx="1"
                                  fill="#475569"
                                  opacity={0.85}
                                  style={{ transition: 'all 0.5s ease' }}
                                />
                              )}
                              
                              {/* Label text */}
                              {showLabelText && (
                                <text
                                  x={x + barWidth / 2}
                                  y={height - 8}
                                  textAnchor="middle"
                                  fill="currentColor"
                                  style={{ fontSize: '0.55rem', opacity: 0.7, fontWeight: 600 }}
                                >
                                  {statsTimeRange === 'today' ? t.label.split(':')[0] : t.label}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                      
                      {/* Legend */}
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.7rem', fontWeight: 700, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                          <span>{language === 'vi' ? 'Phòng Out' : language === 'ja' ? 'チェックアウト' : 'Out Rooms'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block' }} />
                          <span>{language === 'vi' ? 'Phòng Stay' : language === 'ja' ? '滞在清掃' : 'Stay Rooms'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#475569', display: 'inline-block' }} />
                          <span>{language === 'vi' ? 'Phòng DND' : language === 'ja' ? '起こさないで' : 'DND Rooms'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Productivity Leaderboard */}
            <div className="glass-panel grid-span-2" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                {statsTimeRange === 'today' 
                  ? (language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Hôm nay)' : language === 'ja' ? 'スタッフ清掃実績ランキング (本日)' : 'Housekeeper Leaderboard (Today)')
                  : statsTimeRange === 'week'
                    ? (language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Tuần này)' : language === 'ja' ? 'スタッフ清掃実績ランキング (今週)' : 'Housekeeper Leaderboard (This Week)')
                    : statsTimeRange === 'month'
                      ? (language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Tháng này)' : language === 'ja' ? 'スタッフ清掃実績ランキング (今月)' : 'Housekeeper Leaderboard (This Month)')
                      : (language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp (Năm nay)' : language === 'ja' ? 'スタッフ清掃実績ランキング (今年)' : 'Housekeeper Leaderboard (This Year)')}
              </h4>
              
              {branchStats.leaderboard.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                  🧹 {statsTimeRange === 'today'
                    ? (language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong ngày hôm nay' : language === 'ja' ? '本日のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch today')
                    : statsTimeRange === 'week'
                      ? (language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong tuần này' : language === 'ja' ? '今週のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch this week')
                      : statsTimeRange === 'month'
                        ? (language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong tháng này' : language === 'ja' ? '今月のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch this month')
                        : (language === 'vi' ? 'Chưa có dữ liệu dọn dẹp cho chi nhánh này trong năm nay' : language === 'ja' ? '今年のこの店舗の清掃実績はまだありません' : 'No cleaning logs recorded for this branch this year')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Leaderboard Toolbar */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1, padding: '0.35rem 0.75rem', fontSize: '0.8rem', minWidth: '180px' }}
                      placeholder={language === 'vi' ? 'Tìm nhanh nhân viên...' : 'Search housekeeper...'}
                      value={leaderboardSearchTerm}
                      onChange={e => setLeaderboardSearchTerm(e.target.value)}
                    />
                    
                    <div className="capsule-switcher no-print" style={{ display: 'inline-flex' }}>
                      <button
                        type="button"
                        onClick={() => setLeaderboardSortBy('count')}
                        className={`capsule-button ${leaderboardSortBy === 'count' ? 'active' : ''}`}
                      >
                        <span>🧹 {language === 'vi' ? 'Số phòng' : 'Rooms'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardSortBy('avgTime')}
                        className={`capsule-button ${leaderboardSortBy === 'avgTime' ? 'active' : ''}`}
                      >
                        <span>⏱️ {language === 'vi' ? 'T.gian TB' : 'Avg Time'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30px' }}
                      onClick={() => setLeaderboardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      title={language === 'vi' ? 'Đảo chiều sắp xếp' : 'Toggle Sort Order'}
                    >
                      {leaderboardSortOrder === 'asc' ? '▲' : '▼'}
                    </button>

                    <select
                      value={leaderboardPerPage}
                      onChange={e => setLeaderboardPerPage(Number(e.target.value))}
                      className="form-input"
                      style={{ width: '100px', padding: '0.35rem 0.5rem', fontSize: '0.8rem', height: 'auto' }}
                    >
                      <option value={5}>5 / page</option>
                      <option value={10}>10 / page</option>
                      <option value={0}>All</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {paginatedLeaderboard.map((cleaner, index) => {
                      const overallIndex = leaderboardPerPage === 0 ? index : (leaderboardPage - 1) * leaderboardPerPage + index;
                      const maxRooms = Math.max(...branchStats.leaderboard.map(c => c.count), 1);
                      const percent = (cleaner.count / maxRooms) * 100;
                      const rankMedal = overallIndex === 0 ? '🥇' : overallIndex === 1 ? '🥈' : overallIndex === 2 ? '🥉' : `${overallIndex + 1}`;
                      
                      return (
                        <div 
                          key={index} 
                          className="glass-panel" 
                          style={{ 
                            padding: '1rem', 
                            backgroundColor: 'var(--panel-bg-medium)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '1rem',
                            borderLeft: overallIndex < 3 ? `4px solid ${overallIndex === 0 ? '#fbbf24' : overallIndex === 1 ? '#94a3b8' : '#b45309'}` : '1px solid rgba(0,0,0,0.05)'
                          }}
                        >
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--panel-bg-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800 }}>
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

                  {/* Leaderboard Pagination Controls */}
                  {totalLeaderboardPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '0.5rem 0.5rem 0 0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                        {language === 'vi' 
                          ? `Hiển thị ${((leaderboardPage - 1) * leaderboardPerPage) + 1}-${Math.min(leaderboardPage * leaderboardPerPage, filteredLeaderboard.length)} trên tổng số ${filteredLeaderboard.length} nhân viên` 
                          : `Showing ${((leaderboardPage - 1) * leaderboardPerPage) + 1}-${Math.min(leaderboardPage * leaderboardPerPage, filteredLeaderboard.length)} of ${filteredLeaderboard.length} housekeepers`}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setLeaderboardPage(prev => Math.max(prev - 1, 1))}
                          disabled={leaderboardPage === 1}
                          style={{ minWidth: '32px' }}
                        >
                          &laquo;
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setLeaderboardPage(prev => Math.min(prev + 1, totalLeaderboardPages))}
                          disabled={leaderboardPage === totalLeaderboardPages}
                          style={{ minWidth: '32px' }}
                        >
                          &raquo;
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1.5rem' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-color)' }}>
                      📊 {language === 'vi' ? 'Biểu Đồ So Sánh Tốc Độ Dọn Dẹp (Thời gian trung bình)' : language === 'ja' ? 'スタッフ清掃速度比較グラフ (平均時間)' : 'Housekeeper Speed Comparison Chart (Avg Duration)'}
                    </h5>
                    
                    <div style={{ backgroundColor: 'var(--panel-bg-medium)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                      {(() => {
                        const maxAvgTime = Math.max(...filteredLeaderboard.map(c => c.avgTime), 50);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {paginatedLeaderboard.map((cleaner, i) => {
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

            {/* Defects Panel */}
            <div className="glass-panel grid-span-2" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                ⚠️ {language === 'vi' ? 'Thống Kê Lỗi Dọn Dẹp (Hôm nay)' : language === 'ja' ? '清掃不備インスペクション統計 (本日)' : 'Cleaning Defects Inspection Stats (Today)'}
              </h4>

              {branchStats.totalErrors === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                  ✨ {language === 'vi' ? 'Không phát hiện lỗi dọn dẹp nào trong ngày hôm nay!' : language === 'ja' ? '本日は清掃不備の指摘はありません！' : 'No cleaning defects reported today!'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
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

                    <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'var(--panel-bg-medium)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
                          👤 {language === 'vi' ? 'Chi tiết lỗi theo nhân viên:' : language === 'ja' ? 'スタッフ別指摘詳細:' : 'Defects by Housekeeper:'}
                        </h5>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <select
                            value={defectsSortField}
                            onChange={e => setDefectsSortField(e.target.value as any)}
                            className="form-input"
                            style={{ width: '90px', padding: '0.15rem 0.35rem', fontSize: '0.7rem', height: 'auto' }}
                          >
                            <option value="count">{language === 'vi' ? 'Số lỗi' : 'Defects'}</option>
                            <option value="name">{language === 'vi' ? 'Tên NV' : 'Name'}</option>
                          </select>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => setDefectsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {defectsSortOrder === 'asc' ? '▲' : '▼'}
                          </button>
                          <select
                            value={defectsPerPage}
                            onChange={e => setDefectsPerPage(Number(e.target.value))}
                            className="form-input"
                            style={{ width: '75px', padding: '0.15rem 0.35rem', fontSize: '0.7rem', height: 'auto' }}
                          >
                            <option value={3}>3 / pg</option>
                            <option value={5}>5 / pg</option>
                            <option value={10}>10 / pg</option>
                            <option value={0}>All</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {paginatedDefectsLeaderboard.map((cleaner, i) => (
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

                      {/* Defects Leaderboard Pagination */}
                      {totalDefectsPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '0.5rem 0.25rem 0 0.25rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                            Page {defectsPage} of {totalDefectsPages}
                          </span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => setDefectsPage(prev => Math.max(prev - 1, 1))}
                              disabled={defectsPage === 1}
                              style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }}
                            >
                              &laquo;
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => setDefectsPage(prev => Math.min(prev + 1, totalDefectsPages))}
                              disabled={defectsPage === totalDefectsPages}
                              style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }}
                            >
                              &raquo;
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'var(--panel-bg-medium)' }}>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                      📊 {language === 'vi' ? 'Tần suất các loại lỗi:' : language === 'ja' ? '指摘項目別頻度:' : 'Defect Frequencies:'}
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {branchStats.errorBreakdown.map((item, i) => {
                        const maxErrorCount = Math.max(...branchStats.errorBreakdown.map(e => e.count), 1);
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
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {branchTab === 'grid' && (
        <div>
          {/* Grid Layout Filter Bar */}
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.75rem 1.25rem', marginBottom: '1.25rem', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {language === 'vi' ? 'Số cột hiển thị:' : language === 'ja' ? '表示列数:' : 'Grid Columns:'}
            </label>
            <select 
              className="form-input" 
              style={{ width: '120px', padding: '0.4rem 0.75rem' }}
              value={gridColumns}
              onChange={e => {
                const val = e.target.value;
                setGridColumns(val);
                localStorage.setItem('hotel_clean_room_grid_columns', val);
              }}
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

          {rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }} className="glass-panel">
              {getTranslation(language, 'noData')}
            </div>
          ) : (
            (() => {
              const roomsByFloor = rooms.reduce((acc, room) => {
                if (!acc[room.floor]) {
                  acc[room.floor] = [];
                }
                acc[room.floor].push(room);
                return acc;
              }, {} as Record<number, Room[]>);

              return Object.keys(roomsByFloor)
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
                          ['--delete-btn-size' as any]: Number(gridColumns) >= 12 ? '10px' : Number(gridColumns) >= 8 ? '14px' : '18px',
                          ['--delete-btn-font-size' as any]: Number(gridColumns) >= 12 ? '8px' : Number(gridColumns) >= 8 ? '9px' : '11px',
                          
                          // Mobile responsive scaling variables
                          ['--room-card-min-height-mobile' as any]: Number(gridColumns) >= 16 ? '40px' : Number(gridColumns) >= 12 ? '50px' : Number(gridColumns) >= 10 ? '60px' : Number(gridColumns) >= 8 ? '70px' : Number(gridColumns) >= 6 ? '80px' : '90px',
                          ['--room-card-padding-mobile' as any]: Number(gridColumns) >= 12 ? '0.15rem 0.1rem' : Number(gridColumns) >= 8 ? '0.25rem 0.15rem' : Number(gridColumns) >= 6 ? '0.35rem 0.25rem' : '0.5rem 0.35rem',
                          ['--room-number-font-size-mobile' as any]: Number(gridColumns) >= 16 ? '0.5rem' : Number(gridColumns) >= 12 ? '0.6rem' : Number(gridColumns) >= 10 ? '0.7rem' : Number(gridColumns) >= 8 ? '0.8rem' : Number(gridColumns) >= 6 ? '0.95rem' : '1.1rem',
                          ['--room-type-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.35rem' : Number(gridColumns) >= 8 ? '0.45rem' : Number(gridColumns) >= 6 ? '0.5rem' : '0.55rem',
                          ['--room-guest-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.3rem' : Number(gridColumns) >= 8 ? '0.4rem' : Number(gridColumns) >= 6 ? '0.45rem' : '0.5rem',
                          ['--room-assignee-font-size-mobile' as any]: Number(gridColumns) >= 12 ? '0.35rem' : Number(gridColumns) >= 8 ? '0.45rem' : Number(gridColumns) >= 6 ? '0.5rem' : '0.55rem',
                          ['--room-assignee-max-width-mobile' as any]: Number(gridColumns) >= 12 ? '20px' : Number(gridColumns) >= 8 ? '35px' : Number(gridColumns) >= 6 ? '45px' : '55px',
                          ['--delete-btn-size-mobile' as any]: Number(gridColumns) >= 16 ? '8px' : Number(gridColumns) >= 12 ? '10px' : Number(gridColumns) >= 8 ? '12px' : '14px',
                          ['--delete-btn-font-size-mobile' as any]: Number(gridColumns) >= 16 ? '6px' : Number(gridColumns) >= 12 ? '8px' : Number(gridColumns) >= 8 ? '9px' : '10px',
                          ['--delete-btn-top-mobile' as any]: Number(gridColumns) >= 8 ? '2px' : '4px',
                          ['--delete-btn-right-mobile' as any]: Number(gridColumns) >= 8 ? '2px' : '4px',
                        } : undefined}
                      >
                        {floorRooms
                          .sort((a: Room, b: Room) => a.roomNumber.localeCompare(b.roomNumber))
                          .map((room: Room) => {
                            const isCompact = gridColumns !== 'auto';

                            return (
                              <div 
                                key={room.id} 
                                className={`room-card vacant ${isCompact ? 'compact' : ''}`}
                                onClick={() => handleEditRoomClick(room)}
                                style={{ cursor: 'pointer', position: 'relative' }}
                                title={language === 'vi' ? 'Nhấp để sửa thông tin phòng' : language === 'ja' ? 'クリックして部屋設定を編集' : 'Click to edit room details'}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRoom(room.id, room.roomNumber);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: 'var(--delete-btn-top-mobile, 4px)',
                                    right: 'var(--delete-btn-right-mobile, 4px)',
                                    width: 'var(--delete-btn-size-mobile, var(--delete-btn-size, 18px))',
                                    height: 'var(--delete-btn-size-mobile, var(--delete-btn-size, 18px))',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 'var(--delete-btn-font-size-mobile, var(--delete-btn-font-size, 11px))',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s',
                                    zIndex: 10
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                  title={language === 'vi' ? 'Xóa phòng' : language === 'ja' ? '客室削除' : 'Delete Room'}
                                >
                                  ×
                                </button>
                                
                                {isCompact ? (
                                  <div className="room-card-compact-wrapper" style={{ justifyContent: 'center' }}>
                                    <div className="room-card-compact-row">
                                      <span className="room-card-compact-number">{room.roomNumber}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="room-type-text">{getFormattedRoomType(room.type)}</div>
                                    <div className="room-number">
                                      {room.roomNumber}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                });
            })()
          )}
        </div>
      )}



       {branchTab === 'rooms' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {/* Left Column: Rooms Table */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                🚪 {language === 'vi' ? 'Danh sách phòng' : 'Room List'} ({rooms.length})
              </h4>
              <button className="btn btn-primary btn-sm" onClick={handleAddRoomClick}>
                <Plus size={16} />
                <span className="desktop-only-inline">
                  {getTranslation(language, 'addRoom')}
                </span>
                <span className="mobile-only-inline">
                  {language === 'vi' ? 'Thêm' : language === 'ja' ? '追加' : 'Add'}
                </span>
              </button>
            </div>

            {/* Search, Filter, Sort, Page Size Controls for Rooms */}
            <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--panel-bg-subtle)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={language === 'vi' ? 'Tìm số phòng...' : 'Search room...'}
                  value={roomsSearchTerm}
                  onChange={e => setRoomsSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ flex: '2 1 120px', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                />
                <select
                  value={roomsFloorFilter}
                  onChange={e => setRoomsFloorFilter(e.target.value)}
                  className="form-input"
                  style={{ flex: '1 1 90px', padding: '0.35rem 0.5rem', fontSize: '0.8rem', height: 'auto' }}
                >
                  <option value="all">{language === 'vi' ? 'Tất cả tầng' : 'All Floors'}</option>
                  {roomsUniqueFloors.map(f => (
                    <option key={f} value={f.toString()}>{f}F</option>
                  ))}
                </select>
                <select
                  value={roomsTypeFilter}
                  onChange={e => setRoomsTypeFilter(e.target.value)}
                  className="form-input"
                  style={{ flex: '1 1 100px', padding: '0.35rem 0.5rem', fontSize: '0.8rem', height: 'auto' }}
                >
                  <option value="all">{language === 'vi' ? 'Tất cả loại' : 'All Types'}</option>
                  {roomsUniqueTypes.map(t => (
                    <option key={t} value={t}>{getFormattedRoomType(t)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <select
                    value={roomsSortField}
                    onChange={e => setRoomsSortField(e.target.value as any)}
                    className="form-input"
                    style={{ width: '120px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', height: 'auto' }}
                  >
                    <option value="roomNumber">{language === 'vi' ? 'Số phòng' : 'Room Number'}</option>
                    <option value="floor">{language === 'vi' ? 'Tầng' : 'Floor'}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setRoomsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                  >
                    {roomsSortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>{language === 'vi' ? 'Hiển thị:' : 'Show:'}</span>
                  <select
                    value={roomsPerPage}
                    onChange={e => setRoomsPerPage(Number(e.target.value))}
                    className="form-input"
                    style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', height: 'auto' }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={0}>{language === 'vi' ? 'Tất cả' : 'All'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Desktop View Table */}
            <div className="desktop-only-block" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', maxHeight: '450px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                    <th 
                      style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        setRoomsSortField('roomNumber');
                        setRoomsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      }}
                      title="Sort by Room Number"
                    >
                      {getTranslation(language, 'roomNumber')} {roomsSortField === 'roomNumber' ? (roomsSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        setRoomsSortField('floor');
                        setRoomsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      }}
                      title="Sort by Floor"
                    >
                      {getTranslation(language, 'floor')} {roomsSortField === 'floor' ? (roomsSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'roomType')}</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRoomsList.map(room => (
                    <tr key={room.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{room.roomNumber}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{room.floor}F</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{getFormattedRoomType(room.type)}</td>
                      <td style={{ padding: '0.75rem 0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleEditRoomClick(room)}>
                          <Edit2 size={12} />
                        </button>
                        <button className="btn btn-danger btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDeleteRoom(room.id, room.roomNumber)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View Cards */}
            <div className="mobile-only-block" style={{ width: '100%', maxHeight: '450px', overflowY: 'auto' }}>
              {paginatedRoomsList.map(room => (
                <div key={room.id} className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '0.6rem', borderLeft: '4px solid var(--primary-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Room {room.roomNumber}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.15rem' }}>
                      {room.floor}F • {getFormattedRoomType(room.type)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.5rem' }} onClick={() => handleEditRoomClick(room)}>
                      <Edit2 size={12} />
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ padding: '0.35rem 0.5rem' }} onClick={() => handleDeleteRoom(room.id, room.roomNumber)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Rooms Pagination Controls */}
            {totalRoomsPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.75rem 0.25rem 0 0.25rem', borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                  {language === 'vi'
                    ? `Hiển thị ${((roomsPage - 1) * (roomsPerPage || sortedRoomsList.length)) + 1}-${Math.min(roomsPage * (roomsPerPage || sortedRoomsList.length), sortedRoomsList.length)} trên ${sortedRoomsList.length}`
                    : `Showing ${((roomsPage - 1) * (roomsPerPage || sortedRoomsList.length)) + 1}-${Math.min(roomsPage * (roomsPerPage || sortedRoomsList.length), sortedRoomsList.length)} of ${sortedRoomsList.length}`}
                </div>
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setRoomsPage(prev => Math.max(prev - 1, 1))}
                    disabled={roomsPage === 1}
                  >
                    &laquo;
                  </button>
                  {getVisiblePages(roomsPage, totalRoomsPages).map((p, idx) => {
                    if (p === '...') return <span key={idx} style={{ fontSize: '0.75rem', opacity: 0.5 }}>...</span>;
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`btn btn-xs ${roomsPage === p ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setRoomsPage(p as number)}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setRoomsPage(prev => Math.min(prev + 1, totalRoomsPages))}
                    disabled={roomsPage === totalRoomsPages}
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Bulk Rooms Updater & Generator */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                🛠️ {language === 'vi' ? 'Sửa hàng loạt' : 'Bulk Edit Rooms'}
              </h4>
              <textarea
                className="form-input"
                style={{ minHeight: '120px', fontSize: '0.85rem', fontFamily: 'monospace', marginBottom: '0.75rem' }}
                value={bulkRoomsText}
                onChange={e => setBulkRoomsText(e.target.value)}
                placeholder="e.g. 101:1 Bed, 102:2 Beds, 201:Single"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.6, maxWidth: '60%' }}>
                  {language === 'vi' ? '* Cú pháp: số_phòng:loại_phòng, cách nhau bằng dấu phẩy' : '* Format: roomNumber:type, comma-separated'}
                </span>
                <button className="btn btn-primary btn-sm" onClick={handleBulkRoomsUpdate}>
                  💾 {language === 'vi' ? 'Cập nhật' : 'Update'}
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                ⚡ {language === 'vi' ? 'Tạo nhanh dãy phòng' : 'Quick Room Generator'}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '0.25rem', opacity: 0.8 }}>{language === 'vi' ? 'Tầng từ' : 'From Floor'}</label>
                  <input 
                    type="number" 
                    min={1} 
                    className="form-input" 
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    value={genFromFloor}
                    onChange={e => setGenFromFloor(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '0.25rem', opacity: 0.8 }}>{language === 'vi' ? 'Tầng đến' : 'To Floor'}</label>
                  <input 
                    type="number" 
                    min={1} 
                    className="form-input" 
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    value={genToFloor}
                    onChange={e => setGenToFloor(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '0.25rem', opacity: 0.8 }}>{language === 'vi' ? 'Số phòng/tầng' : 'Rooms/Floor'}</label>
                  <input 
                    type="number" 
                    min={1} 
                    className="form-input" 
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    value={genRoomsPerFloor}
                    onChange={e => setGenRoomsPerFloor(Number(e.target.value))}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', padding: '0.4rem' }}
                onClick={() => {
                  if (genFromFloor <= 0 || genToFloor <= 0 || genRoomsPerFloor <= 0) {
                    addToast('Please enter valid positive numbers', 'warning');
                    return;
                  }
                  if (genFromFloor > genToFloor) {
                    addToast('Start floor must be less than or equal to End floor', 'warning');
                    return;
                  }
                  const generated: string[] = [];
                  for (let floor = genFromFloor; floor <= genToFloor; floor++) {
                    for (let r = 1; r <= genRoomsPerFloor; r++) {
                      const roomNum = `${floor}${r.toString().padStart(2, '0')}`;
                      generated.push(`${roomNum}:1 Bed`);
                    }
                  }
                  setBulkRoomsText(prev => {
                    const existing = prev.trim();
                    if (!existing) return generated.join(', ');
                    return `${existing}, ${generated.join(', ')}`;
                  });
                  addToast(language === 'vi' ? 'Đã thêm danh sách phòng vào khung soạn thảo phía trên!' : 'Appended generated rooms to the bulk editor list!', 'success');
                }}
              >
                {language === 'vi' ? 'Tạo & Ghép vào khung soạn thảo' : 'Generate & Append to Editor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {branchTab === 'linkStaff' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          
          {/* COLUMN 1: BRANCH STAFF (DROPZONE LEFT) */}
          <div 
            className="glass-panel" 
            style={{ 
              padding: '1.5rem',
              border: isDragOverBranch ? '2px dashed var(--primary-color)' : '2px solid transparent',
              backgroundColor: isDragOverBranch ? 'rgba(37, 99, 235, 0.05)' : '',
              transition: 'all var(--transition-fast)',
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setIsDragOverBranch(true)}
            onDragLeave={() => setIsDragOverBranch(false)}
            onDrop={(e) => {
              setIsDragOverBranch(false);
              const userId = e.dataTransfer.getData('text/plain');
              if (userId) {
                handleLinkStaffById(userId);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                👥 {language === 'vi' ? 'Nhân sự chi nhánh' : 'Branch Staff'} ({managingHotelStaff.length})
              </h4>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text"
                className="form-input"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', flex: 1 }}
                placeholder={language === 'vi' ? 'Tìm nhanh nhân sự đã liên kết...' : 'Search linked staff...'}
                value={linkedStaffSearchTerm}
                onChange={e => setLinkedStaffSearchTerm(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setLinkedStaffSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
                title={language === 'vi' ? 'Sắp xếp theo tên' : 'Sort by name'}
              >
                <span>🔤</span>
                <span>{linkedStaffSortOrder === 'asc' ? '▲ A-Z' : '▼ Z-A'}</span>
              </button>
            </div>

            {filteredLinkedStaff.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', opacity: 0.5, border: '1px dashed rgba(0,0,0,0.08)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '1.5rem' }}>📥</span>
                <p style={{ fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', margin: '0.5rem 0 0 0' }}>
                  {language === 'vi' ? 'Không tìm thấy nhân sự phù hợp.' : 'No matching staff found.'}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', maxHeight: '350px', paddingRight: '0.25rem' }}>
                  {paginatedLinkedStaff.map(u => {
                    let roleColor = '#10b981';
                    if (u.role === 'admin') roleColor = '#ef4444';
                    else if (u.role === 'front_desk') roleColor = '#3b82f6';
                    else if (u.role === 'checka') roleColor = '#8b5cf6';
                    else if (u.role === 'kacho') roleColor = '#f59e0b';

                    return (
                      <div 
                        key={u.id}
                        draggable={u.username !== 'admin'}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', u.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem',
                          backgroundColor: 'rgba(0,0,0,0.02)',
                          border: '1px solid rgba(0,0,0,0.04)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: u.username === 'admin' ? 'default' : 'grab'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ opacity: 0.4 }}>☰</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{u.name}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>ID: {u.username}</span>
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.3)' }}></span>
                              <span style={{ color: roleColor, fontWeight: 700 }}>{u.role.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                          onClick={() => handleUnlinkStaff(u.id)}
                          title={language === 'vi' ? 'Hủy liên kết khỏi khách sạn này' : 'Unlink from this hotel'}
                          disabled={u.username === 'admin'}
                        >
                          X
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Left Cột Pagination Controls */}
                {totalLinkedStaffPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', padding: '0.5rem 0.25rem 0 0.25rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      Page {linkedStaffPage} / {totalLinkedStaffPages}
                    </span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => setLinkedStaffPage(prev => Math.max(prev - 1, 1))}
                        disabled={linkedStaffPage === 1}
                        style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                      >
                        &laquo;
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => setLinkedStaffPage(prev => Math.min(prev + 1, totalLinkedStaffPages))}
                        disabled={linkedStaffPage === totalLinkedStaffPages}
                        style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                      >
                        &raquo;
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* COLUMN 2: SYSTEM STAFF POOL (DRAGZONE RIGHT) */}
          <div 
            className="glass-panel" 
            style={{ 
              padding: '1.5rem',
              border: isDragOverPool ? '2px dashed var(--primary-color)' : '2px solid transparent',
              backgroundColor: isDragOverPool ? 'rgba(37, 99, 235, 0.05)' : '',
              transition: 'all var(--transition-fast)',
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setIsDragOverPool(true)}
            onDragLeave={() => setIsDragOverPool(false)}
            onDrop={(e) => {
              setIsDragOverPool(false);
              const userId = e.dataTransfer.getData('text/plain');
              if (userId) {
                handleUnlinkStaff(userId);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                🌐 {language === 'vi' ? 'Nhân sự hệ thống' : 'System Staff Pool'}
              </h4>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const nextUsername = getNextEmployeeId('housekeeping', globalUsers);
                  setSubNewStaffForm({
                    username: nextUsername,
                    name: '',
                    role: 'housekeeping',
                    language: 'ja'
                  });
                  setSubNewStaffOpen(true);
                }}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                <Plus size={14} />
                {language === 'vi' ? 'Tạo mới' : 'New Staff'}
              </button>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text"
                className="form-input"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', flex: 1 }}
                placeholder={language === 'vi' ? 'Tìm nhanh nhân sự...' : 'Search system staff...'}
                value={staffSearchTerm}
                onChange={e => setStaffSearchTerm(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setUnlinkedStaffSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
                title={language === 'vi' ? 'Sắp xếp theo tên' : 'Sort by name'}
              >
                <span>🔤</span>
                <span>{unlinkedStaffSortOrder === 'asc' ? '▲ A-Z' : '▼ Z-A'}</span>
              </button>
            </div>

            {filteredUnlinkedUsers.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, border: '1px dashed rgba(0,0,0,0.08)', borderRadius: 'var(--radius-sm)', padding: '2rem 1rem' }}>
                <p style={{ fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
                  {language === 'vi' ? 'Không có nhân sự mới thích hợp.' : 'No other active staff found.'}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', maxHeight: '350px', paddingRight: '0.25rem' }}>
                  {paginatedUnlinkedUsers.map(u => {
                    let roleColor = '#10b981';
                    if (u.role === 'admin') roleColor = '#ef4444';
                    else if (u.role === 'front_desk') roleColor = '#3b82f6';
                    else if (u.role === 'checka') roleColor = '#8b5cf6';
                    else if (u.role === 'kacho') roleColor = '#f59e0b';

                    return (
                      <div 
                        key={u.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', u.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem',
                          backgroundColor: 'rgba(0,0,0,0.02)',
                          border: '1px solid rgba(0,0,0,0.04)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'grab'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ opacity: 0.4 }}>☰</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{u.name}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>ID: {u.username}</span>
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.3)' }}></span>
                              <span style={{ color: roleColor, fontWeight: 700 }}>{u.role.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold' }}
                          onClick={() => handleLinkStaffById(u.id)}
                          title={language === 'vi' ? 'Liên kết vào chi nhánh này' : 'Link to this hotel'}
                        >
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Right Cột Pagination Controls */}
                {totalUnlinkedStaffPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', padding: '0.5rem 0.25rem 0 0.25rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      Page {unlinkedStaffPage} / {totalUnlinkedStaffPages}
                    </span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => setUnlinkedStaffPage(prev => Math.max(prev - 1, 1))}
                        disabled={unlinkedStaffPage === 1}
                        style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                      >
                        &laquo;
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => setUnlinkedStaffPage(prev => Math.min(prev + 1, totalUnlinkedStaffPages))}
                        disabled={unlinkedStaffPage === totalUnlinkedStaffPages}
                        style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                      >
                        &raquo;
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {branchTab === 'users' && (
        <UserManagementTab
          language={language}
          globalUsers={globalUsers}
          hotels={hotels}
          selectedHotelId={managingHotel.id}
          managingHotel={managingHotel}
          branchTab={branchTab}
          activeTab="hotels"
          managingHotelStaff={managingHotelStaff}
          hotelUsers={hotelUsers}
          usersPage={usersPage}
          setUsersPage={setUsersPage}
          refreshUsers={refreshUsers}
          addToast={addToast}
          getTranslation={getTranslation}
          getVisiblePages={getVisiblePages}
        />
      )}

      {branchTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* General Hotel settings */}
          <div className="card glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
              <Clock size={18} />
              <span>{language === 'vi' ? 'Thời gian dọn dẹp mặc định' : language === 'ja' ? 'デフォルト清掃時間' : 'Default Cleaning Duration'}</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                  {language === 'vi' ? 'Số phút trung bình cho một phòng (mặc định)' : language === 'ja' ? '1室あたりの平均時間 (デフォルト - 分)' : 'Average minutes per room (default)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="form-input"
                  value={defaultMinutesInput}
                  onChange={(e) => setDefaultMinutesInput(Number(e.target.value))}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const targetDb = getLocalDB(managingHotel.id);
                    const updated: HotelType = {
                      ...managingHotel,
                      defaultCleanMinutes: defaultMinutesInput
                    };
                    await targetDb.updateHotel(updated);
                    setManagingHotel(updated);
                    if (refreshHotels) await refreshHotels();
                    addToast(
                      language === 'vi' ? 'Đã lưu cấu hình thời gian mặc định!' : language === 'ja' ? 'デフォルト清掃時間を保存しました！' : 'Saved default clean duration!',
                      'success'
                    );
                  } catch (err) {
                    console.error(err);
                    addToast('Failed to save settings', 'warning');
                  }
                }}
                style={{ height: '38px', whiteSpace: 'nowrap' }}
              >
                {language === 'vi' ? 'Lưu cấu hình' : language === 'ja' ? '設定を保存' : 'Save Default'}
              </button>
            </div>
          </div>

          {/* Room types settings */}
          <div className="card glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                <Hotel size={18} />
                <span>{language === 'vi' ? 'Quản lý thời gian theo Loại Phòng' : language === 'ja' ? '部屋タイプ別の目標時間' : 'Target Time by Room Type'}</span>
              </h3>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingRt(null);
                  setRtForm({ name: '', cleanMinutes: 30 });
                  setRtModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={14} />
                <span>{language === 'vi' ? 'Thêm loại phòng' : language === 'ja' ? '部屋タイプを追加' : 'Add Room Type'}</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Tên Loại Phòng' : language === 'ja' ? '部屋タイプ名' : 'Room Type Name'}</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Thời gian dọn dẹp (phút)' : language === 'ja' ? '目標清掃時間 (分)' : 'Clean Duration (minutes)'}</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{language === 'vi' ? 'Thao tác' : language === 'ja' ? 'アクション' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {!managingHotel.roomTypes || managingHotel.roomTypes.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                        {language === 'vi' ? 'Chưa cấu hình loại phòng tự chọn.' : language === 'ja' ? 'カスタム部屋タイプが設定されていません。' : 'No custom room types configured.'}
                      </td>
                    </tr>
                  ) : (
                    managingHotel.roomTypes.map((rt) => (
                      <tr key={rt.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{rt.name}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span className="badge badge-secondary" style={{ fontSize: '0.9rem', padding: '0.25rem 0.5rem' }}>
                            {rt.cleanMinutes} {language === 'vi' ? 'phút' : language === 'ja' ? '分' : 'mins'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingRt(rt);
                                setRtForm({ name: rt.name, cleanMinutes: rt.cleanMinutes });
                                setRtModalOpen(true);
                              }}
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={async () => {
                                if (window.confirm(language === 'vi' ? `Bạn có chắc chắn muốn xóa loại phòng "${rt.name}"?` : language === 'ja' ? `部屋タイプ "${rt.name}" を削除しますか？` : `Are you sure you want to delete room type "${rt.name}"?`)) {
                                  try {
                                    const targetDb = getLocalDB(managingHotel.id);
                                    const updatedTypes = (managingHotel.roomTypes || []).filter(item => item.id !== rt.id);
                                    const updated: HotelType = {
                                      ...managingHotel,
                                      roomTypes: updatedTypes
                                    };
                                    await targetDb.updateHotel(updated);
                                    setManagingHotel(updated);
                                    if (refreshHotels) await refreshHotels();
                                    addToast(
                                      language === 'vi' ? 'Đã xóa loại phòng!' : language === 'ja' ? '部屋タイプを削除しました！' : 'Deleted room type!',
                                      'success'
                                    );
                                  } catch (err) {
                                    console.error(err);
                                    addToast('Failed to delete room type', 'warning');
                                  }
                                }
                              }}
                              style={{ padding: '0.25rem 0.5rem', color: 'var(--accent-red)' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Room Type Edit/Create Modal */}
          {rtModalOpen && (
            <div className="modal-overlay">
              <form
                className="modal-content glass-panel"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const targetDb = getLocalDB(managingHotel.id);
                    const existingTypes = managingHotel.roomTypes || [];
                    let updatedTypes = [...existingTypes];
                    
                    if (editingRt) {
                      // Update existing
                      updatedTypes = updatedTypes.map(item =>
                        item.id === editingRt.id
                          ? { ...item, name: rtForm.name, cleanMinutes: rtForm.cleanMinutes }
                          : item
                      );
                    } else {
                      // Add new
                      const newId = `${managingHotel.id}_rt_${Date.now()}`;
                      updatedTypes.push({
                        id: newId,
                        name: rtForm.name,
                        cleanMinutes: rtForm.cleanMinutes
                      });
                    }

                    const updated: HotelType = {
                      ...managingHotel,
                      roomTypes: updatedTypes
                    };
                    await targetDb.updateHotel(updated);
                    setManagingHotel(updated);
                    if (refreshHotels) await refreshHotels();
                    setRtModalOpen(false);
                    addToast(
                      language === 'vi' ? 'Đã lưu cấu hình loại phòng!' : language === 'ja' ? '部屋タイプ設定を保存しました！' : 'Saved room type configuration!',
                      'success'
                    );
                  } catch (err) {
                    console.error(err);
                    addToast('Failed to save room type', 'warning');
                  }
                }}
                style={{ maxWidth: '400px' }}
              >
                <h3 className="modal-title">
                  {editingRt
                    ? (language === 'vi' ? 'Sửa loại phòng' : language === 'ja' ? '部屋タイプを編集' : 'Edit Room Type')
                    : (language === 'vi' ? 'Thêm loại phòng' : language === 'ja' ? '部屋タイプを追加' : 'Add Room Type')}
                </h3>

                <div className="form-group">
                  <label className="form-label">{language === 'vi' ? 'Tên Loại Phòng' : language === 'ja' ? '部屋タイプ名' : 'Room Type Name'}</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={rtForm.name}
                    onChange={(e) => setRtForm({ ...rtForm, name: e.target.value })}
                    placeholder="e.g. Twin, Single, Deluxe..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {language === 'vi' ? 'Thời gian dọn trung bình (phút)' : language === 'ja' ? '目標清掃時間 (分)' : 'Target Duration (minutes)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className="form-input"
                    required
                    value={rtForm.cleanMinutes}
                    onChange={(e) => setRtForm({ ...rtForm, cleanMinutes: Number(e.target.value) })}
                  />
                </div>

                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setRtModalOpen(false)}>
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
      )}

      {/* SUB NEW STAFF DIALOG MODAL */}
      {subNewStaffOpen && (
        <div className="modal-overlay">
          <form className="modal-content glass-panel" onSubmit={handleSubCreateStaff} style={{ maxWidth: '400px' }}>
            <h3 className="modal-title">
              {language === 'vi' ? `Thêm nhân sự cho ${managingHotel.name}` : `Create staff for ${managingHotel.name}`}
            </h3>
            
            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'cleanerName')}</label>
              <input
                type="text"
                className="form-input"
                required
                value={subNewStaffForm.name}
                onChange={e => setSubNewStaffForm({ ...subNewStaffForm, name: e.target.value })}
                placeholder="Yamada Tarou"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-input"
                value={subNewStaffForm.role}
                onChange={e => {
                  const newRole = e.target.value as User['role'];
                  const nextUsername = getNextEmployeeId(newRole, globalUsers);
                  setSubNewStaffForm({ ...subNewStaffForm, role: newRole, username: nextUsername });
                }}
              >
                <option value="housekeeping">Housekeeping (Cleaner)</option>
                <option value="front_desk">Front Desk (Receptionist)</option>
                <option value="checka">Room Checker (Checker)</option>
                <option value="kacho">{language === 'vi' ? 'Trưởng bộ phận (Kacho)' : language === 'ja' ? '課長 (Kacho)' : 'Section Manager (Kacho)'}</option>
                <option value="admin">Administrator (Admin)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'username')}</label>
              <input
                type="text"
                className="form-input"
                required
                value={subNewStaffForm.username}
                disabled={true}
                placeholder="e.g. clean99"
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSubNewStaffOpen(false)}>
                {getTranslation(language, 'cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                {getTranslation(language, 'save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ROOM CREATE/EDIT DIALOG MODAL */}
      {roomModalOpen && (
        <div className="modal-overlay">
          <form className="modal-content glass-panel" onSubmit={handleRoomSubmit}>
            <h3 className="modal-title">{editingRoom ? 'Edit Room' : 'Add Room'}</h3>
            
            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'roomNumber')}</label>
              <input
                type="text"
                className="form-input"
                required
                value={roomForm.roomNumber}
                onChange={e => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                disabled={editingRoom !== null}
                placeholder="e.g. 101"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'floor')}</label>
              <input
                type="number"
                min={1}
                max={50}
                className="form-input"
                required
                value={roomForm.floor}
                onChange={e => setRoomForm({ ...roomForm, floor: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'roomType')}</label>
              <select
                className="form-input"
                value={roomForm.type}
                onChange={e => setRoomForm({ ...roomForm, type: e.target.value })}
              >
                {managingHotel.roomTypes && managingHotel.roomTypes.length > 0 ? (
                  managingHotel.roomTypes.map(rt => (
                    <option key={rt.id} value={rt.name}>
                      {rt.name} ({rt.cleanMinutes} {language === 'vi' ? 'phút' : language === 'ja' ? '分' : 'mins'})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="1 Bed">{language === 'vi' ? '1 Giường' : language === 'ja' ? '1ベッド' : '1 Bed'}</option>
                    <option value="2 Beds">{language === 'vi' ? '2 Giường' : language === 'ja' ? '2ベッド' : '2 Beds'}</option>
                    <option value="3 Beds">{language === 'vi' ? '3 Giường' : language === 'ja' ? '3ベッド' : '3 Beds'}</option>
                    <option value="4 Beds">{language === 'vi' ? '4 Giường' : language === 'ja' ? '4ベッド' : '4 Beds'}</option>
                    <option value="Minpaku">{language === 'vi' ? 'Minpaku / Homestay' : language === 'ja' ? '民泊 / Homestay' : 'Minpaku / Homestay'}</option>
                    <option value="Single">Single</option>
                    <option value="Double">Double</option>
                    <option value="Twin">Twin</option>
                    <option value="Suite">Suite</option>
                  </>
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Guest Count / セット人数 (Số khách dọn)</label>
              <input
                type="number"
                min={0}
                max={10}
                className="form-input"
                required
                value={roomForm.guestCount}
                onChange={e => setRoomForm({ ...roomForm, guestCount: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes / 指示・メモ (Ghi chú)</label>
              <input
                type="text"
                className="form-input"
                value={roomForm.notes}
                onChange={e => setRoomForm({ ...roomForm, notes: e.target.value })}
                placeholder="잊어버린 물건, 시설 고장 등..."
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={roomForm.priority === 'rush'}
                  onChange={e => setRoomForm({ ...roomForm, priority: e.target.checked ? 'rush' : 'normal' })}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>🔥 {language === 'vi' ? 'Phòng dọn gấp / RUSH' : language === 'ja' ? '優先清掃 / RUSH' : 'Priority Clean / RUSH'}</span>
              </label>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRoomModalOpen(false)}>
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
