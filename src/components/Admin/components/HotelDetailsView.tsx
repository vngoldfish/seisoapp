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
  Play,
  CheckCircle,
  AlertTriangle,
  User as UserIcon
} from 'lucide-react';
import type { Room, User, CleaningLog, Hotel as HotelType } from '../../../db/dbInterface';
import { getLocalDB } from '../../../db/localDB';
import { UserManagementTab } from './UserManagementTab';

interface HotelDetailsViewProps {
  language: any;
  managingHotel: HotelType;
  setManagingHotel: (hotel: HotelType | null) => void;
  branchTab: 'stats' | 'grid' | 'staff' | 'rooms' | 'users' | 'linkStaff';
  setBranchTab: (tab: 'stats' | 'grid' | 'staff' | 'rooms' | 'users' | 'linkStaff') => void;
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
  const [roomForm, setRoomForm] = useState({ 
    roomNumber: '', 
    floor: 1, 
    type: 'Single', 
    status: 'vacant' as Room['status'],
    isStay: false,
    guestCount: 0,
    notes: ''
  });

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
    setRoomForm({ roomNumber: '', floor: 1, type: '1 Bed', status: 'vacant', isStay: false, guestCount: 0, notes: '' });
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
          notes: roomForm.notes || undefined
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
          notes: roomForm.notes || undefined
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
        </select>
      </div>

      {/* Sub-tab Contents */}
      {branchTab === 'stats' && branchStats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Metrics Row */}
          <div className="metrics-grid">
            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--status-clean)' }}>
              <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)' }}>
                <CheckCircle2 size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="metric-value">{branchStats.percentClean}%</div>
                <div className="metric-label">{language === 'vi' ? 'Tiến độ dọn phòng' : language === 'ja' ? '清傷進捗率' : 'Cleaning Progress'}</div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden', marginTop: '0.4rem' }}>
                  <div style={{ width: `${branchStats.percentClean}%`, height: '100%', backgroundColor: 'var(--status-clean)' }} />
                </div>
              </div>
            </div>

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
                      
                      {branchStats.hourlyTrend.map((t, i) => {
                        const barHeight = (t.count / maxCount) * usableHeight;
                        const x = paddingLeft + i * colWidth + (colWidth - barWidth) / 2;
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
                            <text
                              x={x + barWidth / 2}
                              y={height - 8}
                              textAnchor="middle"
                              fill="currentColor"
                              style={{ fontSize: '0.6rem', opacity: 0.7 }}
                            >
                              {t.label.split(':')[0]}
                            </text>
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

            {/* Productivity Leaderboard */}
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

            {/* Defects Panel */}
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

                  <div className="glass-panel" style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
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
                <span className="desktop-only-inline">
                  {getTranslation(language, 'addRoom')}
                </span>
                <span className="mobile-only-inline">
                  {language === 'vi' ? 'Thêm' : language === 'ja' ? '追加' : 'Add'}
                </span>
              </button>
            </div>

            {/* Desktop View Table */}
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
                  {[...rooms]
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

            {/* Mobile View Cards */}
            <div className="mobile-only-block" style={{ width: '100%', maxHeight: '450px', overflowY: 'auto' }}>
              {[...rooms]
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
              );
            })()}
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


    </div>
  );
};
