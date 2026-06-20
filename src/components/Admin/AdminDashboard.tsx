import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../Common/AppContext';
import { getTranslation } from '../../i18n/translations';
import { db } from '../../db/firebaseDB';
import type { Room, User, CleaningLog, Hotel as HotelType } from '../../db/dbInterface';
import { getLocalDB } from '../../db/localDB';
import { LayoutDashboard, Users, Hotel, ClipboardList, Plus, Trash2, Edit2, CheckCircle2, Clock, Building, Play, CheckCircle, AlertTriangle, Eye, EyeOff, RotateCcw, Download, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';

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

export const AdminDashboard: React.FC = () => {
  const { language, addToast, hotelId, activeDate, selectHotel, currentUser, logout, darkMode, toggleDarkMode, setLanguage } = useApp();
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'logs' | 'hotels'>(() => {
    const validTabs = ['stats', 'users', 'logs', 'hotels'];
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    return (queryTab && validTabs.includes(queryTab)) ? (queryTab as 'stats' | 'users' | 'logs' | 'hotels') : 'stats';
  });
  const [branchTab, setBranchTab] = useState<'stats' | 'grid' | 'staff' | 'rooms' | 'linkStaff'>('stats');
  
  // Database States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [hotelUsers, setHotelUsers] = useState<User[]>([]);
  const [userViewMode, setUserViewMode] = useState<'global' | 'local'>('global');
  const [addMode, setAddMode] = useState<'create' | 'link'>('link');
  const [selectedLinkUserId, setSelectedLinkUserId] = useState<string>('');
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
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [hotelSearchTerm, setHotelSearchTerm] = useState('');
  const [hotelFilterStatus, setHotelFilterStatus] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [hotelPage, setHotelPage] = useState(1);
  const [hotelPerPage, setHotelPerPage] = useState(5);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      changed = true;
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
  }, [activeTab, usersPage]);

  // (Daily configuration states removed as clicks open full Edit Modal directly)

  // Form States (Create/Edit Room)
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState({ 
    roomNumber: '', 
    floor: 1, 
    type: 'Single', 
    status: 'vacant' as Room['status'],
    isStay: false,
    guestCount: 0,
    notes: ''
  });

  // Form States (Create/Edit User)
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: '', name: '', role: 'housekeeping' as User['role'], pin: '', language: 'ja' as User['language'], hotelIds: [] as string[], status: 'working' as User['status'] });

  // Form States (Create/Edit Hotel)
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<HotelType | null>(null);
  const [hotelForm, setHotelForm] = useState({ id: '', name: '', description: '', roomsList: '' });

  // Hotel Details Sub-management panel states
  const [managingHotel, setManagingHotel] = useState<HotelType | null>(null);
  const [managingHotelRooms, setManagingHotelRooms] = useState<Room[]>([]);
  const [managingHotelStaff, setManagingHotelStaff] = useState<User[]>([]);
  const [staffSearchTerm, setStaffSearchTerm] = useState<string>('');
  const [isDragOverBranch, setIsDragOverBranch] = useState<boolean>(false);
  const [isDragOverPool, setIsDragOverPool] = useState<boolean>(false);
  const [bulkRoomsText, setBulkRoomsText] = useState<string>('');
  const [subNewStaffOpen, setSubNewStaffOpen] = useState<boolean>(false);
  const [subNewStaffForm, setSubNewStaffForm] = useState({
    username: '',
    name: '',
    role: 'housekeeping' as User['role'],
    language: 'ja' as User['language']
  });
  const [subAddRoomOpen, setSubAddRoomOpen] = useState<boolean>(false);
  const [subAddRoomForm, setSubAddRoomForm] = useState({
    roomNumber: '',
    floor: 1,
    type: '1 Bed'
  });
  const [simulatedRooms, setSimulatedRooms] = useState<{ roomNumber: string; type: string }[]>([]);
  const getNextHotelCode = (existingHotels: HotelType[]) => {

    let num = 1;
    while (existingHotels.some(h => h.id.toLowerCase() === `ks${num}`)) {
      num++;
    }
    return `ks${num}`;
  };

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

  // Quick Room Generator States
  const [showGenerator, setShowGenerator] = useState(false);
  const [genFromFloor, setGenFromFloor] = useState(1);
  const [genToFloor, setGenToFloor] = useState(3);
  const [genRoomsPerFloor, setGenRoomsPerFloor] = useState(10);

  const handleGenerateRoomsClick = () => {
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
        generated.push(roomNum);
      }
    }
    
    setHotelForm(prev => ({
      ...prev,
      roomsList: generated.join(', ')
    }));
    addToast('Rooms list generated! You can now edit the list below.', 'success');
    setShowGenerator(false);
  };

  const refreshHotels = async () => {
    const allHotels = await db.getHotels();
    setHotels(allHotels);
  };

  

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const targetDb = getLocalDB(selectedHotelId);
        const allUsers = await targetDb.getUsers();
        const activeUsers = allUsers.filter(u => u.status !== 'quit');
        const housekeeperUsers = activeUsers.filter(u => u.role === 'housekeeping');
        setCleaners(housekeeperUsers);

        const activeIds = await targetDb.getActiveStaff(activeDate);
        // Ensure only active staff are assigned
        const activeCleanersIds = activeIds.filter(id => activeUsers.some(u => u.id === id));
        setActiveStaffIds(activeCleanersIds);
      } catch (e) {
        console.error('Failed to fetch staff data:', e);
      }
    };
    fetchStaffData();
  }, [selectedHotelId, activeDate, globalUsers]);

  const handleStaffToggle = async (userId: string) => {
    try {
      const targetDb = getLocalDB(selectedHotelId);
      let nextIds;
      if (activeStaffIds.includes(userId)) {
        nextIds = activeStaffIds.filter(id => id !== userId);
      } else {
        nextIds = [...activeStaffIds, userId];
      }
      setActiveStaffIds(nextIds);
      await targetDb.setActiveStaff(activeDate, nextIds);
      addToast(
        language === 'vi' 
          ? 'Đã cập nhật danh sách nhân sự làm việc' 
          : language === 'ja'
            ? '本日の出勤スタッフを更新しました'
            : 'Updated today\'s staff assignment',
        'success'
      );
    } catch (e) {
      console.error(e);
      addToast('Error updating staff assignment', 'warning');
    }
  };

  useEffect(() => {
    const targetDb = getLocalDB(selectedHotelId);

    // Subscriptions
    const unsubRooms = targetDb.subscribeRooms(setRooms);
    const unsubLogs = targetDb.subscribeLogs(setLogs);

    // Fetch users (non-subscription in interface but async)
    const fetchUsers = async () => {
      const allGlobal = await targetDb.getAllGlobalUsers();
      const localUsers = allGlobal.filter(u => u.hotelIds?.includes(selectedHotelId));
      setGlobalUsers(allGlobal);
      setHotelUsers(localUsers);
    };
    fetchUsers();

    refreshHotels();

    return () => {
      unsubRooms();
      unsubLogs();
    };
  }, [selectedHotelId]);

  const displayedUsers = useMemo(() => {
    return userViewMode === 'global' ? globalUsers : hotelUsers;
  }, [userViewMode, globalUsers, hotelUsers]);

  useEffect(() => {
    const totalPagesCount = Math.ceil(displayedUsers.length / 10);
    if (totalPagesCount > 0 && usersPage > totalPagesCount) {
      setUsersPage(totalPagesCount);
    }
  }, [displayedUsers, usersPage]);

  const refreshUsers = async () => {
    const targetDb = getLocalDB(selectedHotelId);
    const allGlobal = await targetDb.getAllGlobalUsers();
    const localUsers = allGlobal.filter(u => u.hotelIds?.includes(selectedHotelId));
    setGlobalUsers(allGlobal);
    setHotelUsers(localUsers);
  };

  // HOTEL SUB-MANAGEMENT PANEL LOGIC
  const loadManagingHotelData = async (hotelId: string) => {
    try {
      const targetDb = getLocalDB(hotelId);
      const fetchedRooms = await targetDb.getRooms();
      setManagingHotelRooms(fetchedRooms);
      
      const allGlobal = await targetDb.getAllGlobalUsers();
      const localStaff = allGlobal.filter(u => u.hotelIds?.includes(hotelId));
      setManagingHotelStaff(localStaff);

      const roomEntries = fetchedRooms
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
        .map(r => `${r.roomNumber}:${r.type}`);
      setBulkRoomsText(roomEntries.join(', '));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (managingHotel) {
      loadManagingHotelData(managingHotel.id);
    }
  }, [managingHotel, globalUsers]);

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

  const handleSubAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingHotel) return;
    try {
      const targetDb = getLocalDB(managingHotel.id);
      
      const exists = managingHotelRooms.some(r => r.roomNumber.trim() === subAddRoomForm.roomNumber.trim());
      if (exists) {
        addToast(
          language === 'vi' ? 'Số phòng đã tồn tại' : 'Room number already exists',
          'warning'
        );
        return;
      }

      await targetDb.createRoom({
        id: subAddRoomForm.roomNumber.trim(),
        roomNumber: subAddRoomForm.roomNumber.trim(),
        floor: subAddRoomForm.floor,
        type: subAddRoomForm.type,
        status: 'vacant',
        isStay: false,
        guestCount: 0
      });

      addToast(
        language === 'vi' ? 'Thêm phòng thành công' : 'Successfully added room',
        'success'
      );

      setSubAddRoomOpen(false);
      setSubAddRoomForm({
        roomNumber: '',
        floor: 1,
        type: 'Single'
      });

      await loadManagingHotelData(managingHotel.id);
    } catch (err: any) {
      addToast(err.message || 'Error creating room', 'warning');
    }
  };

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
      const currentRoomNumbers = managingHotelRooms.map(r => r.roomNumber);

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
        const existingRoom = managingHotelRooms.find(r => r.roomNumber === pr.roomNumber);
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

  // ROOM CRUD ACTIONS
  const handleAddRoomClick = () => {
    setEditingRoom(null);
    setRoomForm({ roomNumber: '', floor: 1, type: 'Single', status: 'vacant', isStay: false, guestCount: 1, notes: '' });
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
      notes: room.notes || ''
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
      await getLocalDB(selectedHotelId).deleteRoom(id);
      addToast(
        language === 'vi' 
          ? `Đã xóa phòng ${roomNumber || id}` 
          : language === 'ja' 
            ? `客室 ${roomNumber || id} を削除しました` 
            : `Room ${roomNumber || id} deleted successfully`, 
        'success'
      );
    }
  };

  const handleExportCSV = () => {
    const headers = language === 'vi' 
      ? ["Số phòng", "Tầng", "Nhân viên dọn", "Bắt đầu", "Kết thúc", "Thời gian dọn (phút)", "Ghi chú", "Lỗi phát hiện", "Hình ảnh"]
      : language === 'ja'
        ? ["部屋番号", "階", "清掃スタッフ", "開始時間", "完了時間", "清掃時間 (分)", "メモ", "検出された欠陥", "写真"]
        : ["Room Number", "Floor", "Cleaner Name", "Start Time", "End Time", "Duration (mins)", "Notes", "Defects Detected", "Photo"];

    const dailyLogs = logs.filter(log => log.endedAt.startsWith(activeDate));

    const rows = dailyLogs
      .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
      .map(log => {
        const errorsStr = log.errors && log.errors.length > 0 ? log.errors.join('; ') : '';
        const noteStr = log.notes || '';
        const photoStr = log.photoAfter ? (log.photoAfter.startsWith('data:') ? 'Image uploaded' : log.photoAfter) : '';
        
        const formatTime = (isoStr: string) => {
          try {
            return new Date(isoStr).toLocaleTimeString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US');
          } catch {
            return isoStr;
          }
        };

        return [
          log.roomNumber,
          `${log.floor}F`,
          log.cleanerName,
          formatTime(log.startedAt),
          formatTime(log.endedAt),
          log.durationMinutes.toString(),
          noteStr,
          errorsStr,
          photoStr
        ];
      });

    const escapeCSV = (val: string) => {
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const filename = `CleaningLogs_${activeDate}_${selectedHotelId || 'Global'}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast(
      language === 'vi' ? 'Xuất CSV thành công!' : language === 'ja' ? 'CSVをエクスポートしました！' : 'CSV exported successfully!',
      'success'
    );
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetDb = getLocalDB(selectedHotelId);
      if (editingRoom) {
        // Edit Room (Preserve current operational status and stay tag, only update metadata/templates)
        await targetDb.updateRoom({
          ...editingRoom,
          roomNumber: roomForm.roomNumber,
          floor: Number(roomForm.floor),
          type: roomForm.type,
          guestCount: Number(roomForm.guestCount),
          notes: roomForm.notes || undefined
        });
        addToast('Room updated successfully', 'success');
      } else {
        // Create Room (Default to vacant/no-stay operational tags upon initial creation)
        await targetDb.createRoom({
          id: roomForm.roomNumber,
          roomNumber: roomForm.roomNumber,
          floor: Number(roomForm.floor),
          type: roomForm.type,
          status: 'vacant',
          isStay: false,
          guestCount: Number(roomForm.guestCount),
          notes: roomForm.notes || undefined
        });
        addToast('Room added successfully', 'success');
      }
      setRoomModalOpen(false);
    } catch (err) {
      console.error(err);
      addToast('Error saving room details', 'warning');
    }
  };

  const handleAddUserClick = () => {
    setEditingUser(null);
    const nextUsername = getNextEmployeeId('housekeeping', globalUsers);
    setUserForm({ username: nextUsername, name: '', role: 'housekeeping', pin: '', language: 'ja', hotelIds: [selectedHotelId], status: 'working' });
    setAddMode('link');
    setSelectedLinkUserId('');
    setUserModalOpen(true);
  };

  const handleEditUserClick = (user: User) => {
    setEditingUser(user);
    setUserForm({ username: user.username || '', name: user.name, role: user.role, pin: user.pin || '', language: user.language, hotelIds: user.hotelIds || [selectedHotelId], status: user.status || 'working' });
    setUserModalOpen(true);
  };

  const handleDeleteUser = async (id: string) => {
    const isGlobal = userViewMode === 'global';
    const userToDelete = globalUsers.find(u => u.id === id);
    if (userToDelete && userToDelete.username?.trim().toLowerCase() === 'admin') {
      addToast(
        language === 'vi' ? 'Không thể xóa tài khoản admin hệ thống' : 'Cannot delete the main admin account',
        'warning'
      );
      return;
    }

    const confirmMessage = isGlobal
      ? (language === 'vi' 
          ? 'Bạn có chắc chắn muốn xóa hoàn toàn nhân viên này khỏi hệ thống?' 
          : language === 'ja'
            ? 'このスタッフをシステムから完全に削除してもよろしいですか？'
            : 'Are you sure you want to completely delete this user from the system?')
      : (language === 'vi'
          ? 'Bạn có chắc chắn muốn loại bỏ nhân viên này khỏi khách sạn hiện tại?'
          : language === 'ja'
            ? 'このスタッフを現在のホテルから除外してもよろしいですか？'
            : 'Are you sure you want to remove this user from the current hotel?');

    if (window.confirm(confirmMessage)) {
      const targetDb = getLocalDB(selectedHotelId);
      if (isGlobal) {
        await targetDb.deleteUserCompletely(id);
        addToast(
          language === 'vi' ? 'Đã xóa nhân viên khỏi hệ thống' : 'Deleted user from system', 
          'success'
        );
      } else {
        await targetDb.deleteUser(id);
        addToast(
          language === 'vi' ? 'Đã loại bỏ nhân viên khỏi khách sạn' : 'Removed user from hotel', 
          'success'
        );
      }

      await refreshUsers();
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetDb = getLocalDB(selectedHotelId);
      
      if (!editingUser && userViewMode === 'local' && addMode === 'link') {
        if (!selectedLinkUserId) {
          addToast(language === 'vi' ? 'Vui lòng chọn một nhân sự' : 'Please select a user', 'warning');
          return;
        }
        const userToLink = globalUsers.find(u => u.id === selectedLinkUserId);
        if (userToLink) {
          const updatedHotelIds = userToLink.hotelIds || [];
          if (!updatedHotelIds.includes(selectedHotelId)) {
            updatedHotelIds.push(selectedHotelId);
          }
          await targetDb.updateUser({
            ...userToLink,
            hotelIds: updatedHotelIds
          });
          addToast(
            language === 'vi' 
              ? `Đã thêm nhân viên ${userToLink.name} vào khách sạn` 
              : `Added employee ${userToLink.name} to hotel`, 
            'success'
          );
        }
      } else {
        // Standard edit or create flow
        if (editingUser) {
          // Edit User
          await targetDb.updateUser({
            ...editingUser,
            username: userForm.username,
            name: userForm.name,
            role: userForm.role,
            pin: userForm.pin,
            language: userForm.language,
            hotelIds: userForm.hotelIds,
            status: userForm.status
          });
          addToast('User details updated', 'success');
        } else {
          // Create User
          let finalHotelIds = userForm.hotelIds;
          if (userViewMode === 'local') {
            finalHotelIds = [selectedHotelId];
          }

          const allGlobal = await targetDb.getAllGlobalUsers();
          let existingUser = allGlobal.find(u => u.username?.trim().toLowerCase() === userForm.username.trim().toLowerCase());
          
          if (existingUser) {
            const nextHotelIds = [...(existingUser.hotelIds || [])];
            finalHotelIds.forEach(id => {
              if (!nextHotelIds.includes(id)) {
                nextHotelIds.push(id);
              }
            });
            const updatedUser: User = {
              ...existingUser,
              name: userForm.name,
              role: userForm.role,
              language: userForm.language,
              status: userForm.status,
              hotelIds: nextHotelIds
            };
            await targetDb.updateUser(updatedUser);
          } else {
            const newUser: Omit<User, 'id'> = {
              username: userForm.username,
              name: userForm.name,
              role: userForm.role,
              pin: userForm.pin,
              language: userForm.language,
              hotelIds: finalHotelIds,
              status: userForm.status
            };
            await targetDb.createUser(newUser);
          }
          addToast('New user registered successfully', 'success');
        }
      }
      setUserModalOpen(false);
      await refreshUsers();
    } catch (err) {
      console.error(err);
      addToast('Error saving user credentials', 'warning');
    }
  };

  // HOTEL CRUD ACTIONS
  const handleAddHotelClick = () => {
    setEditingHotel(null);
    const nextHotelId = getNextHotelCode(hotels);
    setHotelForm({ id: nextHotelId, name: '', description: '', roomsList: '' });
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
      addToast(language === 'vi' ? 'Đã reset cơ sở dữ liệu!' : language === 'ja' ? 'データベースを初期化しました！' : 'Database reset successfully!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  // User Management Pagination
  const usersPerPage = 10;
  const { totalPages, indexOfLastUser, indexOfFirstUser, currentUsers } = useMemo(() => {
    const totalP = Math.ceil(displayedUsers.length / usersPerPage);
    const lastUser = usersPage * usersPerPage;
    const firstUser = lastUser - usersPerPage;
    const currUsers = displayedUsers.slice(firstUser, lastUser);
    return {
      totalPages: totalP,
      indexOfLastUser: lastUser,
      indexOfFirstUser: firstUser,
      currentUsers: currUsers
    };
  }, [displayedUsers, usersPage]);

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
    
    const hotelBreakdowns: {
      id: string;
      name: string;
      total: number;
      clean: number;
      dirty: number;
      cleaning: number;
      maintenance: number;
      checkout: number;
      workers: number;
      avgTime: number;
      issues: string[];
    }[] = [];

    const allIssues: { hotelName: string; roomId: string; note: string; type: 'maintenance' | 'log'; date: string; time: string }[] = [];
    const allLogsList: CleaningLog[] = [];

    hotels.forEach(hotel => {
      const hotelRooms = getRoomsForHotelAndDate(hotel.id, activeDate);
      const hotelLogs = getLogsForHotelAndDate(hotel.id, activeDate);
      const hotelStaff = getActiveStaffForHotelAndDate(hotel.id, activeDate);

      allLogsList.push(...hotelLogs);

      const total = hotelRooms.length;
      const clean = hotelRooms.filter(r => r.status === 'clean').length;
      const dirty = hotelRooms.filter(r => r.status === 'dirty').length;
      const cleaning = hotelRooms.filter(r => r.status === 'cleaning').length;
      const maintenance = hotelRooms.filter(r => r.status === 'maintenance').length;
      const eco = hotelRooms.filter(r => r.status === 'eco').length;
      const dnd = hotelRooms.filter(r => r.status === 'dnd').length;
      const vacant = hotelRooms.filter(r => r.status === 'vacant').length;
      const occupied = hotelRooms.filter(r => r.status === 'occupied').length;
      const stayTotal = hotelRooms.filter(r => r.isStay).length;
      const checkoutTotal = hotelRooms.filter(r => !r.isStay).length;

      const workers = hotelStaff.length;

      const finishedLogs = hotelLogs.filter(log => log.durationMinutes > 0);
      const hTotalDuration = finishedLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
      const hFinishedCount = finishedLogs.length;
      const avgTime = hFinishedCount > 0 ? Math.round(hTotalDuration / hFinishedCount) : 0;

      const hotelIssues: string[] = [];
      hotelRooms.forEach(r => {
        if (r.status === 'maintenance') {
          const note = r.notes || (language === 'vi' ? 'Đang bảo trì' : language === 'ja' ? 'メンテナンス中' : 'Under maintenance');
          hotelIssues.push(`Phòng ${r.roomNumber}: ${note}`);
          allIssues.push({
            hotelName: hotel.name,
            roomId: r.roomNumber,
            note,
            type: 'maintenance',
            date: activeDate,
            time: ''
          });
        }
      });
      hotelLogs.forEach(log => {
        if (log.notes && log.notes.trim()) {
          hotelIssues.push(`${log.cleanerName} (Phòng ${log.roomNumber}): ${log.notes}`);
          let time = '';
          try {
            const dateObj = new Date(log.endedAt);
            if (!isNaN(dateObj.getTime())) {
              const hours = String(dateObj.getHours()).padStart(2, '0');
              const minutes = String(dateObj.getMinutes()).padStart(2, '0');
              time = `${hours}:${minutes}`;
            }
          } catch (e) {}
          allIssues.push({
            hotelName: hotel.name,
            roomId: log.roomNumber,
            note: `${log.cleanerName}: ${log.notes}`,
            type: 'log',
            date: activeDate,
            time
          });
        }
      });

      hotelBreakdowns.push({
        id: hotel.id,
        name: hotel.name,
        total,
        clean,
        dirty,
        cleaning,
        maintenance,
        checkout: checkoutTotal,
        workers,
        avgTime,
        issues: hotelIssues
      });

      totalRoomsCount += total;
      dirtyRoomsCount += dirty;
      cleaningRoomsCount += cleaning;
      cleanRoomsCount += clean;
      maintenanceRoomsCount += maintenance;
      checkoutRoomsCount += checkoutTotal;
      ecoRoomsCount += eco;
      dndRoomsCount += dnd;
      vacantRoomsCount += vacant;
      occupiedRoomsCount += occupied;
      stayRoomsCount += stayTotal;
      totalWorkersCount += workers;
      totalDuration += hTotalDuration;
      finishedLogsCount += hFinishedCount;
    });

    const globalAvgTime = finishedLogsCount > 0 ? Math.round(totalDuration / finishedLogsCount) : 0;

    // System-wide Cleaner Leaderboard
    const cleanerMap: Record<string, { name: string; count: number; totalDuration: number }> = {};
    allLogsList.filter(log => log.durationMinutes > 0).forEach(log => {
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

    // System-wide Defects/Errors Stats
    let totalErrors = 0;
    const errorTypeMap: Record<string, number> = {};
    const cleanerErrorMap: Record<string, { name: string; count: number; errorList: string[] }> = {};

    allLogsList.filter(log => log.durationMinutes > 0).forEach(log => {
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

    const finishedCount = allLogsList.filter(log => log.durationMinutes > 0).length;
    const defectRate = finishedCount > 0
      ? Math.round((allLogsList.filter(l => l.durationMinutes > 0 && l.errors && l.errors.length > 0).length / finishedCount) * 100)
      : 0;

    const errorBreakdown = Object.entries(errorTypeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const cleanerErrorLeaderboard = Object.values(cleanerErrorMap)
      .sort((a, b) => b.count - a.count);

    // System-wide Hourly Trend
    const hourlyBins: Record<number, number> = {};
    for (let h = 8; h <= 18; h++) {
      hourlyBins[h] = 0;
    }
    allLogsList.filter(log => log.durationMinutes > 0).forEach(log => {
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

    const percentClean = totalRoomsCount > 0 ? Math.round((cleanRoomsCount / totalRoomsCount) * 100) : 0;

    return {
      totalRooms: totalRoomsCount,
      dirtyRooms: dirtyRoomsCount,
      cleaningRooms: cleaningRoomsCount,
      cleanRooms: cleanRoomsCount,
      maintenanceRooms: maintenanceRoomsCount,
      checkoutRooms: checkoutRoomsCount,
      ecoRooms: ecoRoomsCount,
      dndRooms: dndRoomsCount,
      vacantRooms: vacantRoomsCount,
      occupiedRooms: occupiedRoomsCount,
      stayRooms: stayRoomsCount,
      totalWorkers: totalWorkersCount,
      avgCleaningTime: globalAvgTime,
      hotelBreakdowns,
      allIssues,
      percentClean,
      leaderboard,
      hourlyTrend,
      totalErrors,
      defectRate,
      errorBreakdown,
      cleanerErrorLeaderboard
    };
  }, [hotels, activeDate, language]);

  const branchStats = useMemo(() => {
    if (!managingHotel) return null;

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

    // Filter logs for today and active branch
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
  }, [managingHotel, rooms, logs, activeStaffIds, activeDate]);

  // Reset hotel page when search, filter or selected stats date changes
  useEffect(() => {
    setHotelPage(1);
  }, [hotelSearchTerm, hotelFilterStatus, activeDate]);

  // Filter and Paginate Hotel Breakdown list
  const processedHotelsData = useMemo(() => {
    const filtered = globalStats.hotelBreakdowns.filter(hotel => {
      // Search by name or id
      const nameMatch = hotel.name.toLowerCase().includes(hotelSearchTerm.toLowerCase()) ||
                        hotel.id.toLowerCase().includes(hotelSearchTerm.toLowerCase());
      
      // Completion status filter
      const percentClean = hotel.total > 0 ? Math.round((hotel.clean / hotel.total) * 100) : 0;
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
      paginatedHotels: paginated,
      totalPages,
      currentPage,
      totalItems
    };
  }, [globalStats.hotelBreakdowns, hotelSearchTerm, hotelFilterStatus, hotelPage, hotelPerPage]);

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
            onClick={() => setActiveTab('hotels')}
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

        <main className="dashboard-content-panel">

      {/* STATS PANEL */}
      {activeTab === 'stats' && (
        <div>
          {/* Header */}
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              {language === 'vi' ? 'Thống Kê Tổng Hợp Hệ Thống' : language === 'ja' ? '総合清掃統計ボード' : 'Global Housekeeping Stats'}
            </h3>
          </div>

          {/* Aggregated Stats Metrics Grid */}
          <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
                <Hotel size={20} />
              </div>
              <div>
                <div className="metric-value">{globalStats.totalRooms}</div>
                <div className="metric-label">{language === 'vi' ? 'Tổng số phòng' : language === 'ja' ? '全部屋数' : 'Total Rooms'}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.2rem' }}>
                  🟢{globalStats.cleanRooms} | 🟡{globalStats.dirtyRooms} | 🟠{globalStats.cleaningRooms}
                </div>
              </div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-dirty)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-dirty)' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--status-dirty)' }} />
              </div>
              <div>
                <div className="metric-value">{globalStats.checkoutRooms}</div>
                <div className="metric-label">{language === 'vi' ? 'Phòng Checkout (Out)' : language === 'ja' ? 'アウト予定部屋数' : 'Checkout Rooms'}</div>
              </div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-clean)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)' }}>
                <Users size={20} style={{ color: 'var(--status-clean)' }} />
              </div>
              <div>
                <div className="metric-value">{globalStats.totalWorkers}</div>
                <div className="metric-label">{language === 'vi' ? 'Lượng nhân viên' : language === 'ja' ? '出勤スタッフ数' : 'Active Staff'}</div>
              </div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-cleaning)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--status-cleaning)' }}>
                <Clock size={20} style={{ color: 'var(--status-cleaning)' }} />
              </div>
              <div>
                <div className="metric-value">{globalStats.avgCleaningTime} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{language === 'vi' ? 'phút' : language === 'ja' ? '分' : 'mins'}</span></div>
                <div className="metric-label">{language === 'vi' ? 'T.gian dọn TB' : language === 'ja' ? '平均清掃時間' : 'Avg Clean Time'}</div>
              </div>
            </div>
          </div>

          {/* System-wide Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
            {/* Room Status Distribution Donut Chart */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                📊 {language === 'vi' ? 'Phân Bổ Trạng Thái Phòng Toàn Hệ Thống' : language === 'ja' ? '全店舗客室状況割合' : 'System-wide Room Status Distribution'}
              </h4>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', flex: 1 }}>
                {/* SVG Donut */}
                <div style={{ position: 'relative', width: '140px', height: '140px' }}>
                  {(() => {
                    const data = [
                      { key: 'clean', label: language === 'vi' ? 'Sạch' : language === 'ja' ? '清掃完了' : 'Clean', value: globalStats.cleanRooms, color: 'var(--status-clean)' },
                      { key: 'dirty', label: language === 'vi' ? 'Bần' : language === 'ja' ? '清掃前' : 'Dirty', value: globalStats.dirtyRooms, color: 'var(--status-dirty)' },
                      { key: 'cleaning', label: language === 'vi' ? 'Đang dọn' : language === 'ja' ? '清掃中' : 'Cleaning', value: globalStats.cleaningRooms, color: 'var(--status-cleaning)' },
                      { key: 'maintenance', label: language === 'vi' ? 'Bảo trì' : language === 'ja' ? '故障/メンテ' : 'Maintenance', value: globalStats.maintenanceRooms, color: 'var(--status-maintenance)' },
                      { key: 'eco', label: language === 'vi' ? 'Dọn Eco' : language === 'ja' ? 'エコ清掃' : 'Eco Clean', value: globalStats.ecoRooms, color: '#6366f1' },
                      { key: 'dnd', label: language === 'vi' ? 'DND' : language === 'ja' ? '起こさないで' : 'DND', value: globalStats.dndRooms, color: '#a855f7' },
                      { key: 'vacant', label: language === 'vi' ? 'Phòng trống' : language === 'ja' ? '空室' : 'Vacant', value: globalStats.vacantRooms, color: '#64748b' },
                      { key: 'occupied', label: language === 'vi' ? 'Có khách' : language === 'ja' ? '滞在' : 'Occupied', value: globalStats.occupiedRooms, color: '#3b82f6' },
                    ].filter(d => d.value > 0);

                    const totalVal = data.reduce((acc, d) => acc + d.value, 0);
                    const radius = 50;
                    const circumference = 2 * Math.PI * radius;
                    
                    let accumulatedPercent = 0;
                    
                    return (
                      <svg width="100%" height="100%" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="60" cy="60" r={radius} fill="transparent" stroke="rgba(0,0,0,0.03)" strokeWidth="12" />
                        {totalVal === 0 ? (
                          <circle cx="60" cy="60" r={radius} fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
                        ) : (
                          data.map((d, i) => {
                            const percent = (d.value / totalVal) * 100;
                            const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
                            const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                            accumulatedPercent += percent;
                            return (
                              <circle
                                key={i}
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="transparent"
                                stroke={d.color}
                                strokeWidth="12"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                style={{ transition: 'all 0.5s ease' }}
                              />
                            );
                          })
                        )}
                        <g style={{ transform: 'rotate(90deg) translate(0px, -120px)', transformOrigin: 'center' }}>
                          <text x="60" y="58" textAnchor="middle" fill="currentColor" style={{ fontSize: '7px', fontWeight: 800 }}>
                            {globalStats.totalRooms}
                          </text>
                          <text x="60" y="68" textAnchor="middle" fill="currentColor" style={{ fontSize: '4.5px', opacity: 0.6, fontWeight: 500 }}>
                            {language === 'vi' ? 'PHÒNG' : language === 'ja' ? '部屋' : 'ROOMS'}
                          </text>
                        </g>
                      </svg>
                    );
                  })()}
                </div>
                
                {/* Legend list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', flex: 1, minWidth: '120px' }}>
                  {[
                    { label: language === 'vi' ? 'Sạch (Clean)' : language === 'ja' ? '清掃完了' : 'Clean', value: globalStats.cleanRooms, color: 'var(--status-clean)' },
                    { label: language === 'vi' ? 'Bẩn (Dirty)' : language === 'ja' ? '清掃前' : 'Dirty', value: globalStats.dirtyRooms, color: 'var(--status-dirty)' },
                    { label: language === 'vi' ? 'Đang dọn (Cleaning)' : language === 'ja' ? '清掃中' : 'Cleaning', value: globalStats.cleaningRooms, color: 'var(--status-cleaning)' },
                    { label: language === 'vi' ? 'Bảo trì (Maint)' : language === 'ja' ? '故障/メンテ' : 'Maintenance', value: globalStats.maintenanceRooms, color: 'var(--status-maintenance)' },
                    { label: language === 'vi' ? 'Eco Clean' : language === 'ja' ? 'エコ清掃' : 'Eco Clean', value: globalStats.ecoRooms, color: '#6366f1' },
                    { label: language === 'vi' ? 'DND' : language === 'ja' ? '起こさないで' : 'DND', value: globalStats.dndRooms, color: '#a855f7' },
                    { label: language === 'vi' ? 'Phòng trống' : language === 'ja' ? '空室' : 'Vacant', value: globalStats.vacantRooms, color: '#64748b' },
                    { label: language === 'vi' ? 'Có khách' : language === 'ja' ? '滞在' : 'Occupied', value: globalStats.occupiedRooms, color: '#3b82f6' },
                  ].filter(d => d.value > 0).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                        <span style={{ opacity: 0.85 }}>{item.label}</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System-wide Hourly Completion Trend Chart */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                📈 {language === 'vi' ? 'Tiến Độ Hoàn Thành Theo Giờ Toàn Hệ Thống' : language === 'ja' ? '時間帯別清掃完了数 (全店舗累計)' : 'System-wide Hourly Cleaning Progress'}
              </h4>
              
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(() => {
                  const maxCount = Math.max(...globalStats.hourlyTrend.map(t => t.count), 4);
                  const width = 360;
                  const height = 140;
                  const paddingLeft = 20;
                  const paddingRight = 10;
                  const paddingTop = 15;
                  const paddingBottom = 20;
                  
                  const usableWidth = width - paddingLeft - paddingRight;
                  const usableHeight = height - paddingTop - paddingBottom;
                  const colWidth = usableWidth / globalStats.hourlyTrend.length;
                  const barWidth = Math.max(colWidth * 0.6, 6);
                  
                  return (
                    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                      {/* Horizontal Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const y = paddingTop + usableHeight * (1 - ratio);
                        const val = Math.round(maxCount * ratio);
                        return (
                          <g key={i}>
                            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(0,0,0,0.05)" strokeDasharray="2 2" />
                            <text x={paddingLeft - 4} y={y + 3} textAnchor="end" fill="currentColor" style={{ fontSize: '0.5rem', opacity: 0.5 }}>{val}</text>
                          </g>
                        );
                      })}
                      
                      {/* Bars rendering */}
                      {globalStats.hourlyTrend.map((t, i) => {
                        const x = paddingLeft + i * colWidth + (colWidth - barWidth) / 2;
                        const barHeight = (t.count / maxCount) * usableHeight;
                        const y = height - paddingBottom - barHeight;
                        return (
                          <g key={i}>
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
                            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" fill="currentColor" style={{ fontSize: '0.5rem', opacity: 0.7 }}>
                              {t.label.split(':')[0]}
                            </text>
                            {t.count > 0 && (
                              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fill="currentColor" style={{ fontSize: '0.55rem', fontWeight: 700 }}>
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
          </div>

          {/* System-wide Housekeeper Leaderboard & Defects Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Leaderboard Panel */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                🏆 {language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp Toàn Hệ Thống' : language === 'ja' ? 'スタッフ清掃実績ランキング (全店舗総合)' : 'System-wide Housekeeper Leaderboard'}
              </h4>
              
              {globalStats.leaderboard.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                  🧹 {language === 'vi' ? 'Chưa có dữ liệu dọn dẹp hệ thống trong ngày hôm nay' : language === 'ja' ? '本日の清掃実績はまだありません' : 'No cleaning logs recorded today'}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {globalStats.leaderboard.map((cleaner, index) => {
                      const maxRooms = Math.max(...globalStats.leaderboard.map(c => c.count), 1);
                      const percent = (cleaner.count / maxRooms) * 100;
                      const rankMedal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                      
                      return (
                        <div 
                          key={index} 
                          className="glass-panel" 
                          style={{ 
                            padding: '0.75rem 1rem', 
                            backgroundColor: 'rgba(255, 255, 255, 0.3)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '1rem',
                            borderLeft: index < 3 ? `4px solid ${index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : '#b45309'}` : '1px solid rgba(0,0,0,0.05)'
                          }}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800 }}>
                            {rankMedal}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: 700, alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>{cleaner.name}</span>
                                <span style={{
                                  fontSize: '0.6rem',
                                  padding: '0.05rem 0.3rem',
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
                            <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                              <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--primary-color)' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.7rem', opacity: 0.8 }}>
                              <span>⏱️ Avg: {cleaner.avgTime} {language === 'vi' ? 'phút / phòng' : language === 'ja' ? '分 / 室' : 'mins / room'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Housekeeper Speed Comparison SVG Chart */}
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-color)' }}>
                      📊 {language === 'vi' ? 'Biểu Đồ So Sánh Tốc Độ Dọn Dẹp (Thời gian trung bình)' : language === 'ja' ? 'スタッフ清掃速度比較グラフ (平均時間)' : 'Housekeeper Speed Comparison Chart (Avg Duration)'}
                    </h5>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      {(() => {
                        const maxAvgTime = Math.max(...globalStats.leaderboard.map(c => c.avgTime), 50);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {globalStats.leaderboard.map((cleaner, i) => {
                              const barPercent = (cleaner.avgTime / maxAvgTime) * 100;
                              const barColor = cleaner.speedCategory === 'fast' 
                                ? 'var(--status-clean)' 
                                : cleaner.speedCategory === 'slow' 
                                  ? '#f97316' 
                                  : 'var(--primary-color)';
                                  
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                                  <div style={{ width: '100px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                    {cleaner.name}
                                  </div>
                                  <div style={{ flex: 1, height: '14px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                    <div style={{ width: `${barPercent}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.5s ease-in-out', borderRadius: '4px' }} />
                                    <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', fontWeight: 700, color: cleaner.avgTime > (maxAvgTime * 0.2) ? 'white' : 'var(--text-color)' }}>
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

            {/* System-wide Defects Analytics Panel */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                ⚠️ {language === 'vi' ? 'Báo Cáo Lỗi Chất Lượng Dọn Dẹp Toàn Hệ Thống' : language === 'ja' ? '清掃不備インスペクション統計 (全店舗総合)' : 'System-wide Cleaning Defects Stats'}
              </h4>
              
              {globalStats.totalErrors === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <div>
                    ✨ {language === 'vi' ? 'Không phát hiện lỗi dọn dẹp nào trên toàn hệ thống!' : language === 'ja' ? '本日は清掃不備の指摘はありません！' : 'No cleaning defects reported today!'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="glass-panel" style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderLeft: '4px solid var(--status-maintenance)' }}>
                      <div style={{ fontSize: '0.65rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 600 }}>
                        {language === 'vi' ? 'Tổng số lỗi' : language === 'ja' ? '指摘 tổng số' : 'Total Defects'}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-maintenance)' }}>
                        {globalStats.totalErrors}
                      </div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.75rem', backgroundColor: 'rgba(251, 191, 36, 0.05)', borderLeft: '4px solid #fbbf24' }}>
                      <div style={{ fontSize: '0.65rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 600 }}>
                        {language === 'vi' ? 'Tỷ lệ lỗi phòng' : language === 'ja' ? '指摘率' : 'Defect Rate'}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309' }}>
                        {globalStats.defectRate}%
                      </div>
                    </div>
                  </div>

                  {/* Defect Frequencies Chart */}
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      📊 {language === 'vi' ? 'Tần suất lỗi dọn dẹp:' : language === 'ja' ? '不備項目別頻度:' : 'Defect Frequencies:'}
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(() => {
                        const maxErrorCount = Math.max(...globalStats.errorBreakdown.map(e => e.count), 1);
                        return globalStats.errorBreakdown.slice(0, 4).map((item, i) => {
                          const widthPct = (item.count / maxErrorCount) * 100;
                          return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.7rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                <span>{item.type}</span>
                                <span>{item.count}</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${widthPct}%`, height: '100%', backgroundColor: 'var(--status-maintenance)', borderRadius: '3px' }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Defects by Housekeeper list */}
                  <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                    <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      👤 {language === 'vi' ? 'Chi tiết lỗi theo nhân viên:' : language === 'ja' ? 'スタッフ別不備詳細:' : 'Defects by Housekeeper:'}
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {globalStats.cleanerErrorLeaderboard.slice(0, 4).map((cleaner, i) => (
                        <div key={i} style={{ fontSize: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{cleaner.name}</span>
                          <span style={{ color: 'var(--status-maintenance)', fontWeight: 700 }}>{cleaner.count} {language === 'vi' ? 'lỗi' : language === 'ja' ? '不備' : 'errors'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
            {/* Left: Hotels Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, paddingBottom: '0.5rem', borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                {language === 'vi' ? 'Chi tiết từng Khách sạn' : language === 'ja' ? '各ホテルの詳細統計' : 'Hotels Breakdown'}
              </h3>

              {/* Search, Filter, Page Size Controls */}
              <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.4)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder={language === 'vi' ? 'Tìm tên/mã khách sạn...' : language === 'ja' ? 'ホテル名・コード検索...' : 'Search hotel name/code...'}
                    value={hotelSearchTerm}
                    onChange={(e) => setHotelSearchTerm(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, minWidth: '150px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  />
                  <select
                    value={hotelFilterStatus}
                    onChange={(e) => setHotelFilterStatus(e.target.value as any)}
                    className="form-input"
                    style={{ width: '150px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : language === 'ja' ? 'すべての状態' : 'All status'}</option>
                    <option value="completed">{language === 'vi' ? 'Đã dọn xong 100%' : language === 'ja' ? '完了 (100%)' : 'Completed (100%)'}</option>
                    <option value="in_progress">{language === 'vi' ? 'Đang dọn dẹp' : language === 'ja' ? '清掃中' : 'In progress'}</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', opacity: 0.8, flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span>
                    {language === 'vi' ? `Tìm thấy ${processedHotelsData.totalItems} khách sạn` : language === 'ja' ? `${processedHotelsData.totalItems} ホテル` : `Found ${processedHotelsData.totalItems} hotels`}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>{language === 'vi' ? 'Hiển thị:' : language === 'ja' ? '表示数:' : 'Show:'}</span>
                    <select
                      value={hotelPerPage}
                      onChange={(e) => {
                        setHotelPerPage(Number(e.target.value));
                        setHotelPage(1);
                      }}
                      className="form-input"
                      style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', height: 'auto' }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>
              </div>

              {processedHotelsData.paginatedHotels.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                  {language === 'vi' ? 'Không tìm thấy khách sạn nào phù hợp' : language === 'ja' ? '該当するホテルが見つかりません' : 'No matching hotels found'}
                </div>
              ) : (
                processedHotelsData.paginatedHotels.map(hotel => {
                  const isSakura = hotel.id === 'ks1';
                  const emoji = isSakura ? '🌸' : '🗻';
                  const color = isSakura ? '#ec4899' : '#0ea5e9';
                  const percentClean = hotel.total > 0 ? Math.round((hotel.clean / hotel.total) * 100) : 0;

                  return (
                    <div key={hotel.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: color }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                          {emoji} {hotel.name}
                        </h4>
                        <span className="badge badge-clean" style={{ backgroundColor: `${color}1a`, color: color, borderColor: `${color}33` }}>
                          {percentClean}% {language === 'vi' ? 'Hoàn thành' : language === 'ja' ? '完了' : 'Done'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                        <div style={{ width: `${percentClean}%`, height: '100%', backgroundColor: color }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{hotel.workers}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{language === 'vi' ? 'Nhân sự' : language === 'ja' ? 'スタッフ' : 'Staff'}</div>
                        </div>
                        <div style={{ padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{hotel.checkout}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{language === 'vi' ? 'Phòng Out' : language === 'ja' ? 'アウト部屋' : 'Checkout'}</div>
                        </div>
                        <div style={{ padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{hotel.avgTime}m</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{language === 'vi' ? 'Dọn TB' : language === 'ja' ? '平均清掃' : 'Avg Time'}</div>
                        </div>
                      </div>

                      {/* Room counts row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span className="badge badge-clean">Ready: {hotel.clean}</span>
                          <span className="badge badge-dirty">Dirty: {hotel.dirty}</span>
                          <span className="badge badge-cleaning">Cleaning: {hotel.cleaning}</span>
                          {hotel.maintenance > 0 && <span className="badge badge-maintenance">Maint: {hotel.maintenance}</span>}
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            borderRadius: '4px',
                            fontWeight: 700,
                            boxShadow: 'none'
                          }}
                          onClick={() => {
                            const foundHotel = hotels.find(h => h.id === hotel.id);
                            if (foundHotel) {
                              setManagingHotel(foundHotel);
                              setActiveTab('hotels');
                              setBranchTab('stats');
                            }
                          }}
                        >
                          {language === 'vi' ? 'Quản lý ➔' : language === 'ja' ? '管理へ ➔' : 'Manage ➔'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Pagination controls */}
              {processedHotelsData.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setHotelPage(prev => Math.max(prev - 1, 1))}
                    disabled={processedHotelsData.currentPage === 1}
                    style={{ minWidth: '32px' }}
                  >
                    &laquo;
                  </button>
                  {Array.from({ length: processedHotelsData.totalPages }, (_, idx) => idx + 1).map(page => (
                    <button
                      key={page}
                      className={`btn btn-sm ${processedHotelsData.currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setHotelPage(page)}
                      style={{ minWidth: '32px', fontWeight: processedHotelsData.currentPage === page ? 'bold' : 'normal' }}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setHotelPage(prev => Math.min(prev + 1, processedHotelsData.totalPages))}
                    disabled={processedHotelsData.currentPage === processedHotelsData.totalPages}
                    style={{ minWidth: '32px' }}
                  >
                    &raquo;
                  </button>
                </div>
              )}
            </div>

            {/* Right: Issues & Errors list (Các lỗi xảy ra) */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-maintenance)' }} />
                {language === 'vi' ? 'Sự Cố & Lỗi Ghi Nhận' : language === 'ja' ? '報告された問題・トラブル' : 'Reported Issues & Errors'}
              </h3>

              {globalStats.allIssues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.6, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div>
                    <span style={{ fontSize: '2rem' }}>✅</span>
                    <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Không có sự cố nào được ghi nhận' : language === 'ja' ? '報告されたトラブルはありません' : 'No issues reported'}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '420px', paddingRight: '0.25rem' }}>
                  {globalStats.allIssues.map((issue, idx) => (
                    <div key={idx} style={{ padding: '0.75rem', backgroundColor: issue.type === 'maintenance' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(234, 179, 8, 0.05)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${issue.type === 'maintenance' ? 'var(--status-maintenance)' : 'var(--status-dirty)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        <span>{issue.hotelName} - Phòng {issue.roomId}</span>
                        <span style={{ color: issue.type === 'maintenance' ? 'var(--status-maintenance)' : 'var(--status-dirty)', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                          {issue.type === 'maintenance' ? 'Maintenance' : 'Report Log'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.4rem', fontWeight: 600 }}>
                        <span style={{ backgroundColor: 'rgba(0,0,0,0.04)', padding: '1px 5px', borderRadius: '4px' }}>
                          📅 {issue.date.split('-').reverse().join('/')}
                        </span>
                        {issue.time && (
                          <span style={{ backgroundColor: 'rgba(0,0,0,0.04)', padding: '1px 5px', borderRadius: '4px' }}>
                            ⏰ {issue.time}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.9 }}>
                        {issue.note}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hotels' && !managingHotel && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{getTranslation(language, 'hotelManagement')}</h3>
            <button className="btn btn-primary btn-sm" onClick={handleAddHotelClick}>
              <Plus size={16} />
              {getTranslation(language, 'addHotel')}
            </button>
          </div>

          <>
            {/* Desktop view: Table */}
            <div className="desktop-only-block" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'hotelCode')}</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'hotelName')}</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'description')}</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {hotels.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{h.id}</td>
                      <td 
                        style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--primary-color)', cursor: 'pointer' }}
                        onClick={() => {
                          setManagingHotel(h);
                          selectHotel(h.id);
                          setBranchTab('stats');
                        }}
                        title={language === 'vi' ? 'Nhấp để quản lý chi nhánh này' : 'Click to manage this branch'}
                      >
                        {h.name}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', opacity: 0.8 }}>{h.description || '-'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} 
                          onClick={() => {
                            setManagingHotel(h);
                            selectHotel(h.id);
                            setBranchTab('stats');
                          }}
                        >
                          {language === 'vi' ? 'Quản lý' : 'Manage'}
                        </button>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleEditHotelClick(h)}>
                          <Edit2 size={12} />
                        </button>
                        <button 
                          className="btn btn-danger btn-sm" 
                          style={{ padding: '0.25rem 0.5rem' }} 
                          onClick={() => handleDeleteHotel(h.id)}
                          disabled={h.id === hotelId}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view: Cards */}
            <div className="mobile-only-block" style={{ width: '100%' }}>
              {hotels.map(h => (
                <div key={h.id} className="glass-panel" style={{ padding: '1rem', marginBottom: '0.75rem', borderLeft: '4px solid var(--primary-color)', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span 
                      style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary-color)', cursor: 'pointer' }}
                      onClick={() => {
                        setManagingHotel(h);
                        selectHotel(h.id);
                        setBranchTab('stats');
                      }}
                    >
                      🏨 {h.name}
                    </span>
                    <span className="badge badge-clean" style={{ fontSize: '0.65rem' }}>{h.id}</span>
                  </div>
                  {h.description && (
                    <p style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.75rem' }}>{h.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button 
                      className="btn btn-primary btn-sm"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        setManagingHotel(h);
                        selectHotel(h.id);
                        setBranchTab('stats');
                      }}
                    >
                      {language === 'vi' ? 'Quản lý' : 'Manage'}
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.3rem 0.6rem' }}
                      onClick={() => handleEditHotelClick(h)}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.3rem 0.6rem' }}
                      onClick={() => handleDeleteHotel(h.id)}
                      disabled={h.id === hotelId}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        </div>
      )}


      {/* DETAILED HOTEL SUB-MANAGEMENT BOARD */}
      {activeTab === 'hotels' && managingHotel && (
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
          <div className="branch-subtabs glass-panel">
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
              className={`btn btn-sm ${branchTab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBranchTab('staff')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
            >
              <Users size={14} />
              <span>{language === 'vi' ? 'Phân công dọn dẹp' : language === 'ja' ? '出勤スタッフ設定' : 'Staff Assignment'}</span>
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
              className={`btn btn-sm ${branchTab === 'linkStaff' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBranchTab('linkStaff')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
            >
              <Users size={14} />
              <span>{language === 'vi' ? 'Liên kết nhân sự' : language === 'ja' ? 'スタッフ連携' : 'Link Staff'}</span>
            </button>
          </div>

          {/* Sub-tab Contents */}
          {branchTab === 'stats' && branchStats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                              { key: 'dirty', label: language === 'vi' ? 'Bẩn' : language === 'ja' ? '未清掃' : 'Dirty', value: branchStats.dirty, color: 'var(--status-dirty)' },
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

          {branchTab === 'grid' && (
            <div>
              {/* Floor grid of rooms */}
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
                          
                          <div className="room-grid">
                            {floorRooms
                              .sort((a: Room, b: Room) => a.roomNumber.localeCompare(b.roomNumber))
                              .map((room: Room) => {
                                const guestLabel = language === 'vi' 
                                  ? `Set: ${room.guestCount} người` 
                                  : language === 'ja' 
                                    ? `セット: ${room.guestCount}人` 
                                    : `Set: ${room.guestCount} Pax`;

                                return (
                                  <div 
                                    key={room.id} 
                                    className={`room-card ${room.status}`}
                                    onClick={() => handleEditRoomClick(room)}
                                    style={{ cursor: 'pointer', position: 'relative' }}
                                    title={room.notes ? `Ghi chú: ${room.notes}` : undefined}
                                  >
                                    {room.isStay && <span className="stay-badge" style={{ right: '24px' }}>Stay</span>}
                                    
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRoom(room.id, room.roomNumber);
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: '4px',
                                        right: '4px',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
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
                                    
                                    <div>
                                      <div className="room-type-text">{getFormattedRoomType(room.type)}</div>
                                      <div className="room-number" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {room.roomNumber}
                                        {room.status === 'dirty' && <Play size={14} style={{ color: 'var(--status-dirty)' }} fill="var(--status-dirty)" />}
                                        {room.status === 'eco' && <Play size={14} style={{ color: 'var(--status-eco)' }} fill="var(--status-eco)" />}
                                        {room.status === 'cleaning' && <CheckCircle size={14} style={{ color: 'var(--status-cleaning)' }} />}
                                        {room.notes && <AlertTriangle size={14} style={{ color: 'var(--status-maintenance)' }} className="animate-pulse" />}
                                      </div>
                                    </div>
                                    
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
                    });
                })()
              )}
            </div>
          )}

          {branchTab === 'staff' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📅 {language === 'vi' ? `Phân công nhân sự ngày ${activeDate}` : language === 'ja' ? `${activeDate} の出勤スタッフ設定` : `Cleaners Assignment for ${activeDate}`}
              </h3>
              
              {cleaners.length === 0 ? (
                <p style={{ opacity: 0.6 }}>
                  {language === 'vi' ? 'Chưa có nhân viên dọn phòng nào được đăng ký trong hệ thống.' : language === 'ja' ? 'システムに出勤可能な清掃スタッフが登録されていません。' : 'No housekeeping staff registered in the system.'}
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {cleaners.map(cleaner => {
                    const isActive = activeStaffIds.includes(cleaner.id);
                    return (
                      <div 
                        key={cleaner.id}
                        onClick={() => handleStaffToggle(cleaner.id)}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          backgroundColor: isActive ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0,0,0,0.02)',
                          border: isActive ? '1px solid var(--status-clean)' : '1px solid rgba(0,0,0,0.05)',
                          padding: '1rem',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>👤</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{cleaner.name}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.1rem' }}>
                              {language === 'vi' ? 'Mã NV' : language === 'ja' ? 'スタッフID' : 'ID'}: {cleaner.username}
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '50%', 
                          border: '2px solid',
                          borderColor: isActive ? 'var(--status-clean)' : 'rgba(0,0,0,0.2)',
                          backgroundColor: isActive ? 'var(--status-clean)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          transition: 'all var(--transition-fast)'
                        }}>
                          {isActive && '✓'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                {language === 'vi' 
                  ? '* Lưu ý: Chỉ những nhân viên được chọn tại đây mới có thể đăng nhập để thao tác dọn phòng trong ngày này.' 
                  : language === 'ja'
                    ? '※ 注意: ここで選択されたスタッフのみが、指定した日付にログインして清掃作業を行えます。' 
                    : '* Note: Only cleaners selected here will be permitted to log in to perform tasks on this date.'}
              </p>
            </div>
          )}

          {branchTab === 'rooms' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {/* Left Column: Rooms Table */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                    🚪 {language === 'vi' ? 'Danh sách phòng' : 'Room List'} ({rooms.length})
                  </h4>
                  <button className="btn btn-primary btn-sm" onClick={handleAddRoomClick}>
                    <Plus size={16} />
                    {getTranslation(language, 'addRoom')}
                  </button>
                </div>

                <>
                  {/* Desktop view: Table */}
                  <div className="desktop-only-block" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', maxHeight: '450px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'roomNumber')}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'floor')}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'roomType')}</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms
                          .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
                          .map(room => (
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

                  {/* Mobile view: Cards */}
                  <div className="mobile-only-block" style={{ width: '100%', maxHeight: '450px', overflowY: 'auto' }}>
                    {rooms
                      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
                      .map(room => (
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
                </>
              </div>

              {/* Right Column: Bulk Rooms List updater and Generator */}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    👥 {language === 'vi' ? 'Nhân sự chi nhánh' : 'Branch Staff'} ({managingHotelStaff.length})
                  </h4>
                </div>

                {/* Staff List */}
                {managingHotelStaff.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', opacity: 0.5, border: '1px dashed rgba(0,0,0,0.08)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1.5rem' }}>📥</span>
                    <p style={{ fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', margin: '0.5rem 0 0 0' }}>
                      {language === 'vi' ? 'Kéo thả nhân sự vào đây để liên kết khách sạn.' : 'Drag & drop staff here to link.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', maxHeight: '420px', paddingRight: '0.25rem' }}>
                    {managingHotelStaff.map(u => {
                      let roleColor = '#10b981';
                      if (u.role === 'admin') roleColor = '#ef4444';
                      else if (u.role === 'front_desk') roleColor = '#3b82f6';
                      else if (u.role === 'checka') roleColor = '#8b5cf6';
                      else if (u.role === 'kacho') roleColor = '#f59e0b';

                      return (
                        <div 
                          key={u.id}
                          draggable={u.username !== 'admin'} // Admin shouldn't be unlinked easily
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
                        language: 'vi'
                      });
                      setSubNewStaffOpen(true);
                    }}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    <Plus size={14} />
                    {language === 'vi' ? 'Tạo mới' : 'New Staff'}
                  </button>
                </div>

                {/* Search filter input */}
                <div style={{ marginBottom: '1rem' }}>
                  <input 
                    type="text"
                    className="form-input"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    placeholder={language === 'vi' ? 'Tìm nhanh nhân sự...' : 'Search system staff...'}
                    value={staffSearchTerm}
                    onChange={e => setStaffSearchTerm(e.target.value)}
                  />
                </div>

                {/* Unlinked Staff List */}
                {(() => {
                  const unlinkedUsers = globalUsers.filter(u => 
                    !u.hotelIds?.includes(managingHotel.id) &&
                    u.status !== 'quit' &&
                    (u.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) || 
                     u.username.toLowerCase().includes(staffSearchTerm.toLowerCase()))
                  );

                  if (unlinkedUsers.length === 0) {
                    return (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, border: '1px dashed rgba(0,0,0,0.08)', borderRadius: 'var(--radius-sm)', padding: '2rem 1rem' }}>
                        <p style={{ fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
                          {language === 'vi' ? 'Không có nhân sự mới thích hợp.' : 'No other active staff found.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', maxHeight: '350px', paddingRight: '0.25rem' }}>
                      {unlinkedUsers.map(u => {
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
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', fontWeight: 'bold' }}
                              onClick={() => handleLinkStaffById(u.id)}
                              title={language === 'vi' ? 'Liên kết vào chi nhánh này' : 'Link to this hotel'}
                            >
                              +
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>
          )}
        </div>
      )}


      {/* USERS TABLE & CRUD */}
      {activeTab === 'users' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>{getTranslation(language, 'userManagement')}</h3>
              
              {/* Selector Button Group */}
              <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <button
                  type="button"
                  onClick={() => { setUserViewMode('global'); setUsersPage(1); }}
                  style={{
                    border: 'none',
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: userViewMode === 'global' ? 'var(--primary-color)' : 'transparent',
                    color: userViewMode === 'global' ? 'white' : 'inherit',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  🌐 {language === 'vi' ? 'Nhân sự hệ thống (Tổng thể)' : language === 'ja' ? 'システム全スタッフ' : 'All System Staff'}
                </button>
                <button
                  type="button"
                  onClick={() => { setUserViewMode('local'); setUsersPage(1); }}
                  style={{
                    border: 'none',
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: userViewMode === 'local' ? 'var(--primary-color)' : 'transparent',
                    color: userViewMode === 'local' ? 'white' : 'inherit',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  🏨 {language === 'vi' ? 'Nhân sự của khách sạn này' : language === 'ja' ? '当ホテルのスタッフ' : 'Current Hotel Staff'}
                </button>
              </div>
            </div>
            
            <button className="btn btn-primary btn-sm" onClick={handleAddUserClick}>
              <Plus size={16} />
              {language === 'vi' ? 'Thêm nhân viên' : language === 'ja' ? 'スタッフ登録' : getTranslation(language, 'addUser')}
            </button>
          </div>

          <>
            {/* Desktop view: Table */}
            <div className="desktop-only-block" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                     <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'cleanerName')}</th>
                     <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'username')}</th>
                     <th style={{ padding: '0.75rem 0.5rem' }}>Role</th>
                     <th style={{ padding: '0.75rem 0.5rem' }}>Password</th>
                     <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Khách sạn' : language === 'ja' ? '所属ホテル' : 'Hotels'}</th>
                     <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Trạng thái' : language === 'ja' ? 'ステータス' : 'Status'}</th>
                     <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.map(user => (
                    <tr key={user.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{user.name}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{user.username || '-'}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span className="badge badge-occupied" style={{ fontSize: '0.65rem' }}>{user.role.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>
                        <span style={{ marginRight: '0.5rem' }}>
                          {showPasswords[user.id] ? `${user.username || 'cleaner'}123` : '••••••••'}
                        </span>
                        <button
                          onClick={() => setShowPasswords(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', verticalAlign: 'middle', color: '#64748b' }}
                          title={showPasswords[user.id] ? 'Hide' : 'Show'}
                        >
                          {showPasswords[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
                        {user.hotelIds?.map(hId => {
                          const match = hotels.find(h => h.id === hId);
                          return match ? match.name : hId;
                        }).join(', ') || '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        {user.status === 'quit' ? (
                          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-maintenance)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {language === 'vi' ? 'Đã nghỉ' : language === 'ja' ? '退職' : 'Quit'}
                          </span>
                        ) : (
                          <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {language === 'vi' ? 'Đang làm' : language === 'ja' ? '在職' : 'Working'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleEditUserClick(user)}>
                          <Edit2 size={12} />
                        </button>
                        <button 
                          className="btn btn-danger btn-sm" 
                          style={{ padding: '0.25rem 0.5rem' }} 
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.username === 'admin'} // Protect primary admin from deletion
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view: Cards */}
            <div className="mobile-only-block" style={{ width: '100%' }}>
              {currentUsers.map(user => (
                <div key={user.id} className="glass-panel" style={{ padding: '1rem', marginBottom: '0.75rem', borderLeft: '4px solid var(--primary-color)', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>👤 {user.name}</span>
                    <span className="badge badge-occupied" style={{ fontSize: '0.65rem' }}>{user.role.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <strong>{getTranslation(language, 'username')}:</strong> {user.username || '-'}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>Password:</strong> 
                    <span>{showPasswords[user.id] ? `${user.username || 'cleaner'}123` : '••••••••'}</span>
                    <button
                      onClick={() => setShowPasswords(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', display: 'inline-flex', alignItems: 'center', color: '#64748b' }}
                    >
                      {showPasswords[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <strong>{language === 'vi' ? 'Khách sạn' : language === 'ja' ? '所属ホテル' : 'Hotels'}:</strong>{' '}
                    {user.hotelIds?.map(hId => {
                      const match = hotels.find(h => h.id === hId);
                      return match ? match.name : hId;
                    }).join(', ') || '-'}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    <strong>Status:</strong>{' '}
                    {user.status === 'quit' ? (
                      <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-maintenance)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {language === 'vi' ? 'Đã nghỉ' : language === 'ja' ? '退職' : 'Quit'}
                      </span>
                    ) : (
                      <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {language === 'vi' ? 'Đang làm' : language === 'ja' ? '在職' : 'Working'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '0.3rem 0.6rem' }} 
                      onClick={() => handleEditUserClick(user)}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      className="btn btn-danger btn-sm" 
                      style={{ padding: '0.3rem 0.6rem' }} 
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={user.username === 'admin'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>


          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem 0.5rem 0 0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                {language === 'vi' 
                  ? `Hiển thị ${indexOfFirstUser + 1}-${Math.min(indexOfLastUser, displayedUsers.length)} trên tổng số ${displayedUsers.length} nhân viên` 
                  : language === 'ja'
                    ? `${displayedUsers.length}名中 ${indexOfFirstUser + 1}-${Math.min(indexOfLastUser, displayedUsers.length)}名を表示`
                    : `Showing ${indexOfFirstUser + 1}-${Math.min(indexOfLastUser, displayedUsers.length)} of ${displayedUsers.length} users`}
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setUsersPage(prev => Math.max(prev - 1, 1))}
                  disabled={usersPage === 1}
                  style={{ minWidth: '40px' }}
                >
                  &laquo;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    type="button"
                    className={`btn btn-sm ${usersPage === page ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setUsersPage(page)}
                    style={{ minWidth: '32px', fontWeight: usersPage === page ? 'bold' : 'normal' }}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setUsersPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={usersPage === totalPages}
                  style={{ minWidth: '40px' }}
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (() => {
        const dailyLogs = logs.filter(log => log.endedAt.startsWith(activeDate));
        return (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                {getTranslation(language, 'cleaningSummary')} ({activeDate})
              </h3>
              <button
                onClick={handleExportCSV}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                disabled={dailyLogs.length === 0}
              >
                <Download size={16} />
                {language === 'vi' ? 'Xuất CSV' : language === 'ja' ? 'CSV出力' : 'Export CSV'}
              </button>
            </div>

            {dailyLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>{getTranslation(language, 'noData')}</div>
            ) : (
              <>
                {/* Desktop view: Table */}
                <div className="desktop-only-block" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'roomNumber')}</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'cleanerName')}</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'startCleaning')}</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'finishCleaning')}</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Duration</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'notes')}</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Photo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyLogs
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

                {/* Mobile view: Cards */}
                <div className="mobile-only-block" style={{ width: '100%' }}>
                  {dailyLogs
                    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
                    .map(log => (
                      <div key={log.id} className="glass-panel" style={{ padding: '1rem', marginBottom: '0.75rem', borderLeft: '4px solid var(--primary-color)', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Room {log.roomNumber} ({log.floor}F)</span>
                          <span className="badge badge-clean" style={{ fontSize: '0.65rem' }}>{log.durationMinutes} mins</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                          <strong>{getTranslation(language, 'cleanerName')}:</strong> {log.cleanerName}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          <span>🕒 {language === 'vi' ? 'Bắt đầu' : 'Start'}: {new Date(log.startedAt).toLocaleTimeString()}</span>
                          <span>⌛ {language === 'vi' ? 'Kết thúc' : 'Finish'}: {new Date(log.endedAt).toLocaleTimeString()}</span>
                        </div>
                        {log.notes && (
                          <div style={{ fontSize: '0.8rem', backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.35rem 0.5rem', borderRadius: '4px', marginBottom: '0.5rem', borderLeft: '2px solid #eab308' }}>
                            <strong>{getTranslation(language, 'notes')}:</strong> {log.notes}
                          </div>
                        )}
                        <div style={{ marginTop: '0.5rem' }}>
                          {log.photoAfter ? (
                            <a href={log.photoAfter} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', padding: '0.25rem 0.75rem', fontSize: '0.75rem', alignItems: 'center' }}>
                              🖼️ {language === 'vi' ? 'Xem ảnh' : language === 'ja' ? '写真を見る' : 'View Photo'}
                            </a>
                          ) : (
                            <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>🚫 {language === 'vi' ? 'Không có ảnh' : language === 'ja' ? '写真なし' : 'No Photo'}</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        );
      })()}



        </main>
      </div>

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
                disabled={editingRoom !== null} // Cannot edit room ID
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
                <option value="1 Bed">{language === 'vi' ? '1 Giường' : language === 'ja' ? '1ベッド' : '1 Bed'}</option>
                <option value="2 Beds">{language === 'vi' ? '2 Giường' : language === 'ja' ? '2ベッド' : '2 Beds'}</option>
                <option value="3 Beds">{language === 'vi' ? '3 Giường' : language === 'ja' ? '3ベッド' : '3 Beds'}</option>
                <option value="4 Beds">{language === 'vi' ? '4 Giường' : language === 'ja' ? '4ベッド' : '4 Beds'}</option>
                <option value="Minpaku">{language === 'vi' ? 'Minpaku / Homestay' : language === 'ja' ? '民泊 / Homestay' : 'Minpaku / Homestay'}</option>
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Twin">Twin</option>
                <option value="Suite">Suite</option>
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

      {/* USER CREATE/EDIT DIALOG MODAL */}
      {userModalOpen && (
        <div className="modal-overlay">
          <form className="modal-content glass-panel" onSubmit={handleUserSubmit} style={{ maxWidth: '440px' }}>
            <h3 className="modal-title" style={{ marginBottom: '1rem' }}>
              {editingUser 
                ? (language === 'vi' ? 'Sửa thông tin nhân sự' : 'Edit User Credentials') 
                : (language === 'vi' ? 'Thêm nhân sự mới' : 'Add New User')
              }
            </h3>

            {/* Toggle Link/Create (Only when creating in local view) */}
            {!editingUser && userViewMode === 'local' && (
              <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.25rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                <button
                  type="button"
                  onClick={() => setAddMode('link')}
                  style={{
                    flex: 1,
                    border: 'none',
                    padding: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: addMode === 'link' ? 'var(--primary-color)' : 'transparent',
                    color: addMode === 'link' ? 'white' : 'inherit',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  🔗 {language === 'vi' ? 'Chọn từ danh sách hệ thống' : language === 'ja' ? 'システムから選択' : 'Select from system'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('create')}
                  style={{
                    flex: 1,
                    border: 'none',
                    padding: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: addMode === 'create' ? 'var(--primary-color)' : 'transparent',
                    color: addMode === 'create' ? 'white' : 'inherit',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  ➕ {language === 'vi' ? 'Tạo mới nhân viên' : language === 'ja' ? '新規スタッフ登録' : 'Create new employee'}
                </button>
              </div>
            )}

            {!editingUser && userViewMode === 'local' && addMode === 'link' ? (
              <div className="form-group">
                <label className="form-label">
                  {language === 'vi' ? 'Chọn nhân viên hệ thống' : language === 'ja' ? 'システムスタッフを選択' : 'Select system employee'}
                </label>
                <select
                  className="form-input"
                  value={selectedLinkUserId}
                  onChange={e => setSelectedLinkUserId(e.target.value)}
                  required
                >
                  <option value="">-- {language === 'vi' ? 'Chọn nhân viên' : 'Select employee'} --</option>
                  {globalUsers
                    .filter(u => !u.hotelIds?.includes(selectedHotelId))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.username}) - {u.role.toUpperCase()}
                      </option>
                    ))
                  }
                </select>
                <span style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.4rem', display: 'block', lineHeight: 1.4 }}>
                  {language === 'vi' 
                    ? '* Chỉ hiển thị những nhân viên hệ thống chưa thuộc khách sạn này.' 
                    : language === 'ja'
                      ? '※ このホテルにまだ所属していないシステムスタッフのみが表示されます。'
                      : '* Only showing system employees who are not yet assigned to this hotel.'}
                </span>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">{getTranslation(language, 'cleanerName')}</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={userForm.name}
                    onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                    placeholder="e.g. Yamada Tarou"
                  />
                </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-input"
                value={userForm.role}
                onChange={e => {
                  const newRole = e.target.value as User['role'];
                  if (!editingUser) {
                    const nextUsername = getNextEmployeeId(newRole, globalUsers);
                    setUserForm({ ...userForm, role: newRole, username: nextUsername });
                  } else {
                    setUserForm({ ...userForm, role: newRole });
                  }
                }}
              >
                <option value="admin">Administrator (Admin)</option>
                <option value="front_desk">Front Desk (Receptionist)</option>
                <option value="housekeeping">Housekeeping (Cleaner)</option>
                <option value="checka">{language === 'vi' ? 'Giám sát / Kiểm phòng (Checker)' : language === 'ja' ? '検査スタッフ (Checker)' : 'Room Checker (Checker)'}</option>
                <option value="kacho">{language === 'vi' ? 'Trưởng bộ phận (Kacho)' : language === 'ja' ? '課長 (Kacho)' : 'Section Manager (Kacho)'}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                {userForm.role === 'housekeeping' 
                  ? (language === 'vi' ? 'Mã nhân viên (Username)' : language === 'ja' ? 'スタッフID (ユーザー名)' : 'Employee ID (Username)') 
                  : getTranslation(language, 'username')}
              </label>
              <input
                type="text"
                className="form-input"
                required
                value={userForm.username}
                disabled={true}
                placeholder={userForm.role === 'housekeeping' ? 'e.g. nv01' : 'e.g. front2'}
              />

              <span style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem', display: 'block' }}>
                {language === 'vi' 
                  ? `Mật khẩu đăng nhập sẽ là: Tên đăng nhập + "123"` 
                  : language === 'ja'
                    ? `ログインパスワードは ユーザー名 + "123" になります。`
                    : `Password will be username + "123".`}
              </span>
            </div>

            {/* Employment Status Selector (Only when editing user) */}
            {editingUser !== null && (
              <div className="form-group">
                <label className="form-label">
                  {language === 'vi' ? 'Trạng thái nhân sự' : language === 'ja' ? '在職ステータス' : 'Employment Status'}
                </label>
                <select
                  className="form-input"
                  value={userForm.status}
                  onChange={e => setUserForm({ ...userForm, status: e.target.value as User['status'] })}
                >
                  <option value="working">🟢 {language === 'vi' ? 'Đang làm' : language === 'ja' ? '在職' : 'Working'}</option>
                  <option value="quit">🔴 {language === 'vi' ? 'Đã nghỉ việc' : language === 'ja' ? '退職' : 'Quit'}</option>
                </select>
              </div>
            )}
              </>
            )}

            {/* Hotel Associations Checkboxes */}
            {(userViewMode === 'global' || editingUser !== null) && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  {language === 'vi' ? 'Khách sạn làm việc' : language === 'ja' ? '勤務先ホテル' : 'Assigned Hotels'}
                </label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  {hotels.map(h => {
                    const isChecked = userForm.hotelIds?.includes(h.id);
                    return (
                      <label key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let nextHotelIds = userForm.hotelIds || [];
                            if (isChecked) {
                              nextHotelIds = nextHotelIds.filter(id => id !== h.id);
                            } else {
                              nextHotelIds = [...nextHotelIds, h.id];
                            }
                            // Don't allow empty hotel list
                            if (nextHotelIds.length === 0) {
                              addToast(language === 'vi' ? 'Phải chọn ít nhất một khách sạn' : 'Must assign to at least one hotel', 'warning');
                              return;
                            }
                            setUserForm({ ...userForm, hotelIds: nextHotelIds });
                          }}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>{h.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setUserModalOpen(false)}>
                {getTranslation(language, 'cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                {getTranslation(language, 'save')}
              </button>
            </div>
          </form>
        </div>
      )}

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
                disabled={true}
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
                placeholder="e.g. Tokyo Palace Hotel"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'description')}</label>
              <input
                type="text"
                className="form-input"
                value={hotelForm.description}
                onChange={e => setHotelForm({ ...hotelForm, description: e.target.value })}
                placeholder="e.g. Near Shinjuku station"
              />
            </div>

            {!editingHotel && (
              <>
                {/* Quick Generator Panel */}
                <div className="glass-panel" style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: 'rgba(0,0,0,0.02)', border: '1px dashed rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      {language === 'ja' ? '部屋の一括生成' : language === 'vi' ? 'Tạo nhanh danh sách phòng' : 'Quick Room Generator'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                      onClick={() => setShowGenerator(!showGenerator)}
                    >
                      {showGenerator ? (language === 'ja' ? '閉じる' : language === 'vi' ? 'Đóng' : 'Close') : (language === 'ja' ? '開く' : language === 'vi' ? 'Mở' : 'Open')}
                    </button>
                  </div>
                  
                  {showGenerator && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '0.25rem', opacity: 0.8 }}>Tầng từ</label>
                        <input 
                          type="number" 
                          min={1} 
                          className="form-input" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          value={genFromFloor}
                          onChange={e => setGenFromFloor(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '0.25rem', opacity: 0.8 }}>Tầng đến</label>
                        <input 
                          type="number" 
                          min={1} 
                          className="form-input" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          value={genToFloor}
                          onChange={e => setGenToFloor(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '0.25rem', opacity: 0.8 }}>Phòng/Tầng</label>
                        <input 
                          type="number" 
                          min={1} 
                          className="form-input" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          value={genRoomsPerFloor}
                          onChange={e => setGenRoomsPerFloor(Number(e.target.value))}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ gridColumn: 'span 3', padding: '0.35rem', fontSize: '0.75rem', marginTop: '0.25rem' }}
                        onClick={handleGenerateRoomsClick}
                      >
                        {language === 'ja' ? '生成して入力する' : language === 'vi' ? 'Tạo & Điền vào ô dưới' : 'Generate & Fill'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {language === 'ja' ? '客室リスト (カンマ区切り)' : language === 'vi' ? 'Danh sách phòng (cách nhau bằng dấu phẩy)' : 'Rooms List (comma-separated)'}
                  </label>
                  <textarea
                    className="form-input"
                    style={{ minHeight: '80px', fontFamily: 'inherit' }}
                    value={hotelForm.roomsList}
                    onChange={e => setHotelForm({ ...hotelForm, roomsList: e.target.value })}
                    placeholder="e.g. 101, 102, 103, 201, 202, 301"
                    required
                  />
                  <span style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem', display: 'block' }}>
                    {language === 'ja' ? '例: 101, 102, 201, 202' : language === 'vi' ? 'Ví dụ: 101, 102, 201, 202' : 'Example: 101, 102, 201, 202'}
                  </span>
                </div>

                {/* Simulated Rooms list selector */}
                {simulatedRooms.length > 0 && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      🏡 {language === 'vi' ? 'Cấu hình loại phòng giả lập:' : language === 'ja' ? '生成予定の客室タイプ選択:' : 'Configure Simulated Room Types:'}
                    </label>
                    <div style={{ 
                      display: 'flex', 
                      gap: '0.5rem', 
                      flexWrap: 'wrap', 
                      maxHeight: '150px', 
                      overflowY: 'auto', 
                      padding: '0.75rem', 
                      backgroundColor: 'rgba(0,0,0,0.02)', 
                      borderRadius: 'var(--radius-sm)', 
                      border: '1px solid rgba(0,0,0,0.05)' 
                    }}>
                      {simulatedRooms.map((sr, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.35rem', 
                          backgroundColor: 'var(--bg-card-light)', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '6px', 
                          border: '1px solid rgba(0,0,0,0.06)',
                          fontSize: '0.8rem'
                        }}>
                          <span style={{ fontWeight: 700 }}>{sr.roomNumber}:</span>
                          <select
                            style={{ 
                              padding: '0.1rem', 
                              fontSize: '0.75rem', 
                              border: 'none', 
                              backgroundColor: 'transparent', 
                              fontWeight: 600, 
                              color: 'var(--primary-color)',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                            value={sr.type}
                            onChange={e => {
                              const newType = e.target.value;
                              setSimulatedRooms(prev => prev.map(p => p.roomNumber === sr.roomNumber ? { ...p, type: newType } : p));
                            }}
                          >
                            <option value="1 Bed">{language === 'vi' ? '1 Giường' : language === 'ja' ? '1ベッド' : '1 Bed'}</option>
                            <option value="2 Beds">{language === 'vi' ? '2 Giường' : language === 'ja' ? '2ベッド' : '2 Beds'}</option>
                            <option value="3 Beds">{language === 'vi' ? '3 Giường' : language === 'ja' ? '3ベッド' : '3 Beds'}</option>
                            <option value="4 Beds">{language === 'vi' ? '4 Giường' : language === 'ja' ? '4ベッド' : '4 Beds'}</option>
                            <option value="Minpaku">{language === 'vi' ? 'Minpaku / Homestay' : language === 'ja' ? '民泊 / Homestay' : 'Minpaku / Homestay'}</option>
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
              </>
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
      {/* SUB NEW STAFF DIALOG MODAL */}
      {subNewStaffOpen && managingHotel && (
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

      {/* SUB ADD ROOM DIALOG MODAL */}
      {subAddRoomOpen && managingHotel && (
        <div className="modal-overlay">
          <form className="modal-content glass-panel" onSubmit={handleSubAddRoom} style={{ maxWidth: '400px' }}>
            <h3 className="modal-title">
              {language === 'vi' ? `Thêm phòng cho ${managingHotel.name}` : `Add room for ${managingHotel.name}`}
            </h3>
            
            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'roomNumber')}</label>
              <input
                type="text"
                className="form-input"
                required
                value={subAddRoomForm.roomNumber}
                onChange={e => {
                  const val = e.target.value;
                  const match = val.match(/^(\d+)/);
                  let computedFloor = 1;
                  if (match) {
                    const parsed = parseInt(match[1], 10);
                    computedFloor = parsed >= 100 ? Math.floor(parsed / 100) : parsed;
                  }
                  setSubAddRoomForm({ ...subAddRoomForm, roomNumber: val, floor: computedFloor });
                }}
                placeholder="e.g. 305"
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
                value={subAddRoomForm.floor}
                onChange={e => setSubAddRoomForm({ ...subAddRoomForm, floor: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{getTranslation(language, 'roomType')}</label>
              <select
                className="form-input"
                value={subAddRoomForm.type}
                onChange={e => setSubAddRoomForm({ ...subAddRoomForm, type: e.target.value })}
              >
                <option value="1 Bed">{language === 'vi' ? '1 Giường' : language === 'ja' ? '1ベッド' : '1 Bed'}</option>
                <option value="2 Beds">{language === 'vi' ? '2 Giường' : language === 'ja' ? '2ベッド' : '2 Beds'}</option>
                <option value="3 Beds">{language === 'vi' ? '3 Giường' : language === 'ja' ? '3ベッド' : '3 Beds'}</option>
                <option value="4 Beds">{language === 'vi' ? '4 Giường' : language === 'ja' ? '4ベッド' : '4 Beds'}</option>
                <option value="Minpaku">{language === 'vi' ? 'Minpaku / Homestay' : language === 'ja' ? '民泊 / Homestay' : 'Minpaku / Homestay'}</option>
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Twin">Twin</option>
                <option value="Suite">Suite</option>
              </select>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSubAddRoomOpen(false)}>
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
