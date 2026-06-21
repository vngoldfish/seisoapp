import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import type { User, Hotel as HotelType } from '../../../db/dbInterface';
import { getDatabaseProvider } from '../../../db/firebaseDB';
import { hashPassword } from '../../../utils/crypto';

interface UserManagementTabProps {
  language: any;
  globalUsers: User[];
  hotels: HotelType[];
  selectedHotelId: string;
  managingHotel: HotelType | null;
  branchTab: string;
  activeTab: string;
  managingHotelStaff: User[];
  hotelUsers: User[];
  usersPage: number;
  setUsersPage: React.Dispatch<React.SetStateAction<number>>;
  refreshUsers: () => Promise<void>;
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

export const UserManagementTab: React.FC<UserManagementTabProps> = ({
  language,
  globalUsers,
  hotels,
  selectedHotelId,
  managingHotel,
  branchTab,
  activeTab,
  managingHotelStaff,
  hotelUsers,
  usersPage,
  setUsersPage,
  refreshUsers,
  addToast,
  getTranslation,
  getVisiblePages
}) => {
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showPasswords, setShowPasswords] = useState<{ [id: string]: boolean }>({});
  const [addMode, setAddMode] = useState<'link' | 'create'>('link');
  const [selectedLinkUserId, setSelectedLinkUserId] = useState('');
  const [changePasswordOption, setChangePasswordOption] = useState(false);
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);

  const [userForm, setUserForm] = useState<{
    username: string;
    name: string;
    role: User['role'];
    pin: string;
    language: User['language'];
    hotelIds: string[];
    status: User['status'];
    employeeCode: string;
    password: string;
  }>({
    username: '',
    name: '',
    role: 'housekeeping',
    pin: '',
    language: 'ja',
    hotelIds: [],
    status: 'working',
    employeeCode: '',
    password: ''
  });

  const userViewMode = activeTab === 'users' ? 'global' : 'local';

  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userSortField, setUserSortField] = useState<'name' | 'username' | 'role' | 'status'>('name');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');
  const [usersPerPage, setUsersPerPage] = useState(10);

  // Compute filtered users list
  const filteredUsers = useMemo(() => {
    const isHotelLocalUsers = activeTab === 'hotels' && managingHotel && branchTab === 'users';
    const baseUsers = isHotelLocalUsers ? managingHotelStaff : (userViewMode === 'global' ? globalUsers : hotelUsers);
    
    return baseUsers.filter(user => {
      // Search term filter
      const term = userSearchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        user.name.toLowerCase().includes(term) ||
        (user.username || '').toLowerCase().includes(term) ||
        (user.hotelIds?.map(hId => hotels.find(h => h.id === hId)?.name.toLowerCase() || '').some(hName => hName.includes(term)));

      // Role filter
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;

      // Status filter
      const matchesStatus = statusFilter === 'all' || (user.status || 'working') === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [activeTab, managingHotel, branchTab, userViewMode, globalUsers, hotelUsers, managingHotelStaff, userSearchTerm, hotels, roleFilter, statusFilter]);

  // Compute sorted users list
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let valA = a[userSortField] || '';
      let valB = b[userSortField] || '';

      if (userSortField === 'name' || userSortField === 'username' || userSortField === 'role' || userSortField === 'status') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return userSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return userSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, userSortField, userSortOrder]);

  // Adjust page if it exceeds bounds
  useEffect(() => {
    const limit = usersPerPage === 0 ? sortedUsers.length || 1 : usersPerPage;
    const totalPagesCount = Math.ceil(sortedUsers.length / limit);
    if (totalPagesCount > 0 && usersPage > totalPagesCount) {
      setUsersPage(totalPagesCount);
    }
  }, [sortedUsers, usersPage, setUsersPage, usersPerPage]);

  // Reset page when filter/sort changes
  useEffect(() => {
    setUsersPage(1);
  }, [userSearchTerm, roleFilter, statusFilter, userSortField, userSortOrder, usersPerPage, setUsersPage]);

  // Pagination bounds
  const { totalPages, indexOfLastUser, indexOfFirstUser, currentUsers } = useMemo(() => {
    const limit = usersPerPage === 0 ? sortedUsers.length : usersPerPage;
    const totalP = usersPerPage === 0 ? 1 : Math.ceil(sortedUsers.length / limit);
    const lastUser = usersPage * limit;
    const firstUser = lastUser - limit;
    const currUsers = sortedUsers.slice(firstUser, lastUser);
    return {
      totalPages: totalP,
      indexOfLastUser: lastUser,
      indexOfFirstUser: firstUser,
      currentUsers: currUsers
    };
  }, [sortedUsers, usersPage, usersPerPage]);

  const handleAddUserClick = () => {
    setEditingUser(null);
    setChangePasswordOption(false);
    const nextUsername = getNextEmployeeId('housekeeping', globalUsers);
    const targetHotelId = managingHotel ? managingHotel.id : selectedHotelId;
    
    let initialHotelIds: string[] = [];
    if (targetHotelId && targetHotelId !== 'admin' && targetHotelId !== 'portal') {
      initialHotelIds = [targetHotelId];
    } else if (hotels.length > 0) {
      initialHotelIds = [hotels[0].id];
    }

    setUserForm({
      username: nextUsername,
      name: '',
      role: 'housekeeping',
      pin: '',
      language: 'ja',
      hotelIds: initialHotelIds,
      status: 'working',
      employeeCode: nextUsername.toUpperCase(),
      password: ''
    });
    setAddMode('link');
    setSelectedLinkUserId('');
    setAutoGenerateCode(true);
    setUserModalOpen(true);
  };

  const handleEditUserClick = (user: User) => {
    setEditingUser(user);
    setChangePasswordOption(false);
    
    let initialHotelIds = (user.hotelIds || []).filter(id => id !== 'admin' && id !== 'portal');
    if (initialHotelIds.length === 0) {
      if (selectedHotelId && selectedHotelId !== 'admin' && selectedHotelId !== 'portal') {
        initialHotelIds = [selectedHotelId];
      } else if (hotels.length > 0) {
        initialHotelIds = [hotels[0].id];
      }
    }

    setUserForm({
      username: user.username || '',
      name: user.name,
      role: user.role,
      pin: user.pin || '',
      language: user.language,
      hotelIds: initialHotelIds,
      status: user.status || 'working',
      employeeCode: user.employeeCode || '',
      password: ''
    });
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
      const targetDb = getDatabaseProvider(selectedHotelId);
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
      const targetDb = getDatabaseProvider(selectedHotelId);

      // Validate that employeeCode is not empty
      if (!userForm.employeeCode.trim()) {
        addToast(
          language === 'vi' 
            ? 'Mã nhân viên là bắt buộc!' 
            : language === 'ja'
              ? '社員コードは必須です！'
              : 'Employee Code is required!',
          'warning'
        );
        return;
      }

      // Validate that employeeCode is unique across all global users
      const codeCheck = userForm.employeeCode.trim().toUpperCase();
      const duplicateUser = globalUsers.find(
        u => u.id !== editingUser?.id && u.employeeCode?.trim().toUpperCase() === codeCheck
      );
      if (duplicateUser) {
        addToast(
          language === 'vi'
            ? `Mã nhân viên "${userForm.employeeCode}" đã trùng với nhân viên "${duplicateUser.name}"!`
            : language === 'ja'
              ? `社員コード "${userForm.employeeCode}" は " ${duplicateUser.name} " に重複しています！`
              : `Employee Code "${userForm.employeeCode}" is duplicate with "${duplicateUser.name}"!`,
          'warning'
        );
        return;
      }

      const sanitizedHotelIds = (userForm.hotelIds || []).filter(hId => hId !== 'admin' && hId !== 'portal');

      const isAddingHotels = editingUser 
        ? sanitizedHotelIds.some(id => !editingUser.hotelIds?.includes(id)) 
        : (userViewMode === 'local' ? true : (sanitizedHotelIds.length > 0));

      if (userForm.status === 'quit' && isAddingHotels) {
        addToast(
          language === 'vi'
            ? 'Không thể thêm nhân viên đã nghỉ việc (❌) vào khách sạn. Vui lòng đổi trạng thái sang "Đang làm" trước.'
            : 'Cannot add a quit employee (❌) to a hotel. Please change status to "Working" first.',
          'warning'
        );
        return;
      }
      
      if (!editingUser && userViewMode === 'local' && addMode === 'link') {
        if (!selectedLinkUserId) {
          addToast(language === 'vi' ? 'Vui lòng chọn một nhân sự' : 'Please select a user', 'warning');
          return;
        }
        const userToLink = globalUsers.find(u => u.id === selectedLinkUserId);
        if (userToLink) {
          if (userToLink.status === 'quit') {
            addToast(
              language === 'vi'
                ? 'Nhân viên này đã nghỉ việc (❌), không thể thêm vào khách sạn'
                : 'This employee has quit (❌) and cannot be added to the hotel',
              'warning'
            );
            return;
          }
          const updatedHotelIds = (userToLink.hotelIds || []).filter(id => id !== 'admin' && id !== 'portal');
          if (!updatedHotelIds.includes(selectedHotelId) && selectedHotelId !== 'admin' && selectedHotelId !== 'portal') {
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
        let passwordHash = editingUser?.passwordHash;
        if (userForm.password.trim()) {
          passwordHash = await hashPassword(userForm.password.trim());
        } else if (!editingUser) {
          const defaultPassword = userForm.username.trim() + '123';
          passwordHash = await hashPassword(defaultPassword);
        }

        if (editingUser) {
          await targetDb.updateUser({
            ...editingUser,
            username: userForm.username.trim(),
            name: userForm.name.trim(),
            role: userForm.role,
            pin: userForm.pin,
            language: userForm.language,
            hotelIds: sanitizedHotelIds,
            status: userForm.status,
            employeeCode: userForm.employeeCode.trim().toUpperCase(),
            passwordHash: passwordHash
          });
          addToast('User details updated', 'success');
        } else {
          let finalHotelIds = sanitizedHotelIds;
          if (userViewMode === 'local') {
            if (selectedHotelId !== 'admin' && selectedHotelId !== 'portal') {
              finalHotelIds = [selectedHotelId];
            } else if (hotels.length > 0) {
              finalHotelIds = [hotels[0].id];
            }
          }

          const allGlobal = await targetDb.getAllGlobalUsers();
          let existingUser = allGlobal.find(u => u.username?.trim().toLowerCase() === userForm.username.trim().toLowerCase());
          
          if (existingUser) {
            const nextHotelIds = [...(existingUser.hotelIds || [])].filter(id => id !== 'admin' && id !== 'portal');
            finalHotelIds.forEach(id => {
              if (!nextHotelIds.includes(id)) {
                nextHotelIds.push(id);
              }
            });
            const updatedUser: User = {
              ...existingUser,
              name: userForm.name.trim(),
              role: userForm.role,
              language: userForm.language,
              status: userForm.status,
              hotelIds: nextHotelIds,
              employeeCode: userForm.employeeCode.trim().toUpperCase() || existingUser.employeeCode,
              passwordHash: passwordHash || existingUser.passwordHash
            };
            await targetDb.updateUser(updatedUser);
          } else {
            const newUser: Omit<User, 'id'> = {
              username: userForm.username.trim(),
              name: userForm.name.trim(),
              role: userForm.role,
              pin: userForm.pin,
              language: userForm.language,
              hotelIds: finalHotelIds,
              status: userForm.status,
              employeeCode: userForm.employeeCode.trim().toUpperCase(),
              passwordHash: passwordHash
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

  const title = activeTab === 'users'
    ? (language === 'vi' ? 'Quản lý nhân sự hệ thống' : language === 'ja' ? 'システム全スタッフ' : 'All System Staff')
    : (language === 'vi' ? 'Quản lý nhân sự chi nhánh' : language === 'ja' ? '当ホテルのスタッフ管理' : 'Branch Staff Management');

  return (
    <>
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{title}</h3>
          </div>
          
          <button className="btn btn-primary btn-sm" onClick={handleAddUserClick}>
            <Plus size={16} />
            <span className="desktop-only-inline">
              {language === 'vi' ? 'Thêm nhân viên' : language === 'ja' ? 'スタッフ登録' : getTranslation(language, 'addUser')}
            </span>
            <span className="mobile-only-inline">
              {language === 'vi' ? 'Thêm' : language === 'ja' ? '追加' : 'Add'}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <input
            type="text"
            placeholder={
              language === 'vi' 
                ? 'Tìm kiếm theo tên hoặc khách sạn đang làm...' 
                : language === 'ja'
                  ? '名前/所属ホテルで検索...'
                  : 'Search by name or assigned hotel...'
            }
            value={userSearchTerm}
            onChange={(e) => {
              setUserSearchTerm(e.target.value);
              setUsersPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.75rem 1.25rem 0.75rem 2.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            className="user-search-input"
          />
          <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
            🔍
          </span>
          {userSearchTerm && (
            <button
              type="button"
              onClick={() => {
                setUserSearchTerm('');
                setUsersPage(1);
              }}
              style={{
                position: 'absolute',
                right: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                opacity: 0.6,
                padding: '0.2rem'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Toolbar: Filters, Sorting and Page Size */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', backgroundColor: 'var(--panel-bg-subtle)', marginBottom: '1.25rem', alignItems: 'center' }}>
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setUsersPage(1);
            }}
            className="form-input"
            style={{ flex: '1 1 140px', padding: '0.4rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
          >
            <option value="all">{language === 'vi' ? 'Tất cả chức vụ' : language === 'ja' ? 'すべての権限' : 'All Roles'}</option>
            <option value="housekeeping">{language === 'vi' ? 'Dọn phòng (Housekeeper)' : language === 'ja' ? '清掃 (Housekeeper)' : 'Housekeeper'}</option>
            <option value="front_desk">{language === 'vi' ? 'Lễ tân (Front Desk)' : language === 'ja' ? 'フロント (Front Desk)' : 'Front Desk'}</option>
            <option value="checka">{language === 'vi' ? 'Kiểm phòng (Checker)' : language === 'ja' ? '検査 (Checker)' : 'Checker'}</option>
            <option value="kacho">{language === 'vi' ? 'Trưởng bộ phận (Kacho)' : language === 'ja' ? '課長 (Kacho)' : 'Kacho'}</option>
            <option value="admin">{language === 'vi' ? 'Quản trị (Admin)' : language === 'ja' ? '管理者 (Admin)' : 'Admin'}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setUsersPage(1);
            }}
            className="form-input"
            style={{ flex: '1 1 130px', padding: '0.4rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
          >
            <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : language === 'ja' ? 'すべての状態' : 'All Statuses'}</option>
            <option value="working">{language === 'vi' ? 'Đang làm (Working)' : language === 'ja' ? '在職 (Working)' : 'Working'}</option>
            <option value="quit">{language === 'vi' ? 'Đã nghỉ (Quit)' : language === 'ja' ? '退職 (Quit)' : 'Quit'}</option>
          </select>

          {/* Sort field for Mobile/Quick selection */}
          <select
            value={userSortField}
            onChange={(e) => setUserSortField(e.target.value as any)}
            className="form-input"
            style={{ flex: '1 1 140px', padding: '0.4rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
          >
            <option value="name">{language === 'vi' ? 'Tên nhân viên' : language === 'ja' ? '名前' : 'Name'}</option>
            <option value="username">{language === 'vi' ? 'Tên đăng nhập' : language === 'ja' ? 'ユーザー名' : 'Username'}</option>
            <option value="role">{language === 'vi' ? 'Chức vụ' : language === 'ja' ? '権限' : 'Role'}</option>
            <option value="status">{language === 'vi' ? 'Trạng thái' : language === 'ja' ? '状態' : 'Status'}</option>
          </select>

          {/* Sort order toggle button */}
          <button
            type="button"
            onClick={() => setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            {userSortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
          </button>

          {/* Page size options */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{language === 'vi' ? 'Hiển thị:' : 'Show:'}</span>
            <select
              value={usersPerPage}
              onChange={(e) => {
                setUsersPerPage(Number(e.target.value));
                setUsersPage(1);
              }}
              className="form-input"
              style={{ width: '70px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', height: 'auto' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={0}>{language === 'vi' ? 'Tất cả' : 'All'}</option>
            </select>
          </div>
        </div>

        <>
          {/* Desktop view: Table */}
          <div className="desktop-only-block" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                  <th style={{ padding: '0.75rem 0.5rem', width: '50px' }}>
                    {language === 'vi' ? 'STT' : 'No.'}
                  </th>
                  <th 
                    style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => {
                      setUserSortField('name');
                      setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    }}
                    title="Click to sort by Name"
                  >
                    {language === 'vi' ? 'Họ tên' : language === 'ja' ? '名前' : 'Name'} {userSortField === 'name' ? (userSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>
                    {language === 'vi' ? 'Mã NV' : 'Emp Code'}
                  </th>
                  <th 
                    style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => {
                      setUserSortField('username');
                      setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    }}
                    title="Click to sort by Username"
                  >
                    {getTranslation(language, 'username')} {userSortField === 'username' ? (userSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                  <th 
                    style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => {
                      setUserSortField('role');
                      setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    }}
                    title="Click to sort by Role"
                  >
                    Role {userSortField === 'role' ? (userSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Password</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Khách sạn' : language === 'ja' ? '所属ホテル' : 'Hotels'}</th>
                  <th 
                    style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => {
                      setUserSortField('status');
                      setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    }}
                    title="Click to sort by Status"
                  >
                    {language === 'vi' ? 'Trạng thái' : language === 'ja' ? 'ステータス' : 'Status'} {userSortField === 'status' ? (userSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'action')}</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.map((user, idx) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', opacity: 0.7 }}>
                      {indexOfFirstUser + idx + 1}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{user.name}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{user.employeeCode || '-'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{user.username || '-'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span className="badge badge-occupied" style={{ fontSize: '0.65rem' }}>{user.role.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>
                      <span style={{ marginRight: '0.5rem' }}>
                        {user.passwordHash 
                          ? '••••••••' 
                          : showPasswords[user.id] ? `${user.username || 'cleaner'}123` : '••••••••'}
                      </span>
                      {!user.passwordHash && (
                        <button
                          onClick={() => setShowPasswords(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', verticalAlign: 'middle', color: '#64748b' }}
                          title={showPasswords[user.id] ? 'Hide' : 'Show'}
                        >
                          {showPasswords[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
                      {user.hotelIds?.filter(hId => hId !== 'admin' && hId !== 'portal').map(hId => {
                        const match = hotels.find(h => h.id === hId);
                        return match ? match.name : hId;
                      }).join(', ') || '-'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {user.status === 'quit' ? (
                        <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-maintenance)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }} title={language === 'vi' ? 'Đã nghỉ' : language === 'ja' ? '退職' : 'Quit'}>
                          ❌
                        </span>
                      ) : (
                        <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }} title={language === 'vi' ? 'Đang làm' : language === 'ja' ? '在職' : 'Working'}>
                          ✔️
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
                        disabled={user.username === 'admin'}
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
              <div 
                key={user.id} 
                className="glass-panel user-row-hoverable" 
                style={{ padding: '1rem', marginBottom: '0.75rem', borderLeft: '4px solid var(--primary-color)', cursor: 'pointer' }}
                onClick={() => setViewingUser(user)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>👤 {user.name}</span>
                  <span style={{ fontSize: '0.85rem', opacity: 0.7, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span>{user.username || '-'}</span>
                    {user.employeeCode && (
                      <>
                        <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.5 }}></span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{user.employeeCode}</span>
                      </>
                    )}
                  </span>
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
                ? `Hiển thị ${indexOfFirstUser + 1}-${Math.min(indexOfLastUser, sortedUsers.length)} trên tổng số ${sortedUsers.length} nhân viên` 
                : language === 'ja'
                  ? `${sortedUsers.length}名中 ${indexOfFirstUser + 1}-${Math.min(indexOfLastUser, sortedUsers.length)}名を表示`
                  : `Showing ${indexOfFirstUser + 1}-${Math.min(indexOfLastUser, sortedUsers.length)} of ${sortedUsers.length} users`}
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
              {getVisiblePages(usersPage, totalPages).map((page, index) => {
                if (page === '...') {
                  return (
                    <span key={`ellipsis-${index}`} style={{ padding: '0.4rem 0.5rem', opacity: 0.5, fontSize: '0.85rem' }}>
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={page}
                    type="button"
                    className={`btn btn-sm ${usersPage === page ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setUsersPage(page as number)}
                    style={{ minWidth: '32px', fontWeight: usersPage === page ? 'bold' : 'normal' }}
                  >
                    {page}
                  </button>
                );
              })}
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

      {/* USER DETAILS POPUP MODAL (For Mobile View) */}
      {viewingUser && (
        <div className="modal-overlay" onClick={() => setViewingUser(null)}>
          <div 
            className="modal-content glass-panel" 
            style={{ 
              maxWidth: '440px', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title" style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              marginBottom: '1.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
              paddingBottom: '0.75rem'
            }}>
              👤 {language === 'vi' ? 'Chi tiết nhân sự' : language === 'ja' ? 'スタッフ詳細' : 'Staff Details'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                  {language === 'vi' ? 'Họ và tên' : language === 'ja' ? '氏名' : 'Full Name'}
                </strong>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-color)' }}>{viewingUser.name}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                    {language === 'vi' ? 'Tên đăng nhập' : language === 'ja' ? 'ユーザー名' : 'Username'}
                  </strong>
                  <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 600 }}>{viewingUser.username || '-'}</span>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                    {language === 'vi' ? 'Mã NV' : 'Employee Code'}
                  </strong>
                  <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 600 }}>{viewingUser.employeeCode || '-'}</span>
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                  Vai trò (Role)
                </strong>
                <span className="badge badge-occupied" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  {viewingUser.role}
                </span>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                  Mật khẩu (Password)
                </strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.04)', width: 'fit-content' }}>
                  <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                    {viewingUser.passwordHash 
                      ? '••••••••' 
                      : showPasswords[viewingUser.id] ? `${viewingUser.username || 'cleaner'}123` : '••••••••'}
                  </span>
                  {!viewingUser.passwordHash && (
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, [viewingUser.id]: !prev[viewingUser.id] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: '#64748b', display: 'flex', alignItems: 'center' }}
                      title={showPasswords[viewingUser.id] ? 'Hide' : 'Show'}
                    >
                      {showPasswords[viewingUser.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                  {language === 'vi' ? 'Khách sạn làm việc' : language === 'ja' ? '所属ホテル' : 'Assigned Hotels'}
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                  {viewingUser.hotelIds && viewingUser.hotelIds.filter(hId => hId !== 'admin' && hId !== 'portal').length > 0 ? (
                    viewingUser.hotelIds.filter(hId => hId !== 'admin' && hId !== 'portal').map(hId => {
                      const match = hotels.find(h => h.id === hId);
                      return (
                        <span key={hId} className="badge badge-clean" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                          🏨 {match ? match.name : hId}
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.5 }}>-</span>
                  )}
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                  {language === 'vi' ? 'Trạng thái' : language === 'ja' ? 'ステータス' : 'Status'}
                </strong>
                <div style={{ marginTop: '0.25rem' }}>
                  {viewingUser.status === 'quit' ? (
                    <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-maintenance)', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }} title={language === 'vi' ? 'Đã nghỉ việc' : language === 'ja' ? '退職' : 'Quit'}>
                      ❌
                    </span>
                  ) : (
                    <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }} title={language === 'vi' ? 'Đang làm việc' : language === 'ja' ? '在職' : 'Working'}>
                      ✔️
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1.25rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setViewingUser(null);
                  handleEditUserClick(viewingUser);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Edit2 size={13} />
                <span>{language === 'vi' ? 'Sửa' : language === 'ja' ? '編集' : 'Edit'}</span>
              </button>
              <button 
                type="button" 
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setViewingUser(null);
                  handleDeleteUser(viewingUser.id);
                }}
                disabled={viewingUser.username === 'admin'}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Trash2 size={13} />
                <span>{language === 'vi' ? 'Xóa' : language === 'ja' ? '削除' : 'Delete'}</span>
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setViewingUser(null)}
                style={{ paddingLeft: '1rem', paddingRight: '1rem' }}
              >
                {language === 'vi' ? 'Đóng' : language === 'ja' ? '閉じる' : 'Close'}
              </button>
            </div>
          </div>
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
                    .filter(u => !u.hotelIds?.includes(selectedHotelId) && u.status !== 'quit')
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
                  <label className="form-label">{language === 'vi' ? 'Họ tên' : language === 'ja' ? '氏名' : 'Full Name'}</label>
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
                  <label className="form-label">
                    {language === 'vi' ? 'Vai trò / Phân quyền' : language === 'ja' ? '権限 / 役割' : 'Role'}
                  </label>
                  <select
                    className="form-input"
                    value={userForm.role}
                    onChange={e => {
                      const newRole = e.target.value as User['role'];
                      if (!editingUser) {
                        const nextUsername = getNextEmployeeId(newRole, globalUsers);
                        setUserForm({ 
                          ...userForm, 
                          role: newRole, 
                          username: nextUsername, 
                          employeeCode: autoGenerateCode ? nextUsername.toUpperCase() : userForm.employeeCode 
                        });
                      } else {
                        setUserForm({ ...userForm, role: newRole });
                      }
                    }}
                  >
                    <option value="housekeeping">{getTranslation(language, 'roleHousekeeping')}</option>
                    <option value="front_desk">{getTranslation(language, 'roleFrontDesk')}</option>
                    <option value="checka">{getTranslation(language, 'roleChecker')}</option>
                    <option value="kacho">{getTranslation(language, 'roleKacho')}</option>
                    <option value="admin">{getTranslation(language, 'roleAdmin')}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {language === 'vi' ? 'Mã NV (Mã nhân viên)' : language === 'ja' ? 'スタッフコード (Mã NV)' : 'Employee Code (Mã NV)'}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    disabled={!!editingUser || autoGenerateCode}
                    value={userForm.employeeCode}
                    onChange={e => setUserForm({ ...userForm, employeeCode: e.target.value })}
                    placeholder="e.g. NV001"
                    style={(editingUser || autoGenerateCode) ? { backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'not-allowed' } : {}}
                  />
                  {!editingUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <input
                        type="checkbox"
                        id="autoGenerateCode"
                        checked={autoGenerateCode}
                        onChange={e => {
                          const checked = e.target.checked;
                          setAutoGenerateCode(checked);
                          if (checked) {
                            const nextUsername = getNextEmployeeId(userForm.role, globalUsers);
                            setUserForm(prev => ({
                              ...prev,
                              employeeCode: nextUsername.toUpperCase()
                            }));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="autoGenerateCode" style={{ fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', opacity: 0.8 }}>
                        {language === 'vi' ? 'Tự động sinh mã nhân viên' : language === 'ja' ? '社員コードを自動生成する' : 'Auto-generate employee code'}
                      </label>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {language === 'vi' ? 'Tên đăng nhập (Username)' : language === 'ja' ? 'ユーザー名 (Username)' : 'Username'}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={userForm.username}
                    disabled={editingUser !== null}
                    onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder={userForm.role === 'housekeeping' ? 'e.g. nv01' : 'e.g. front2'}
                  />
                </div>

                {editingUser !== null && (
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input
                      type="checkbox"
                      id="changePasswordCheckbox"
                      checked={changePasswordOption}
                      onChange={e => {
                        setChangePasswordOption(e.target.checked);
                        if (!e.target.checked) {
                          setUserForm(prev => ({ ...prev, password: '' }));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="changePasswordCheckbox" style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      {language === 'vi' ? 'Thay đổi mật khẩu' : language === 'ja' ? 'パスワードを変更する' : 'Change Password'}
                    </label>
                  </div>
                )}

                {(!editingUser || changePasswordOption) && (
                  <div className="form-group">
                    <label className="form-label">
                      {language === 'vi' ? 'Mật khẩu (Password)' : language === 'ja' ? 'パスワード (Password)' : 'Password'}
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      required={!editingUser || changePasswordOption}
                      value={userForm.password}
                      onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder={editingUser ? (language === 'vi' ? 'Nhập mật khẩu mới' : 'Enter new password') : 'e.g. secret123'}
                    />
                    {!editingUser && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem', display: 'block' }}>
                        {language === 'vi' 
                          ? `* Nếu để trống, mật khẩu mặc định sẽ là: Tên đăng nhập + "123"` 
                          : language === 'ja'
                            ? `※ 空白の場合、初期パスワードはユーザー名 + "123" になります。`
                            : `* If left empty, default password is username + "123".`}
                      </span>
                    )}
                  </div>
                )}

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
    </>
  );
};
