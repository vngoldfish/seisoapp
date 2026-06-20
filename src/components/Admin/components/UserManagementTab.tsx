import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import type { User, Hotel as HotelType } from '../../../db/dbInterface';
import { getLocalDB } from '../../../db/localDB';

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

  const [userForm, setUserForm] = useState<{
    username: string;
    name: string;
    role: User['role'];
    pin: string;
    language: User['language'];
    hotelIds: string[];
    status: User['status'];
  }>({
    username: '',
    name: '',
    role: 'housekeeping',
    pin: '',
    language: 'ja',
    hotelIds: [],
    status: 'working'
  });

  const userViewMode = activeTab === 'users' ? 'global' : 'local';

  // Compute displayed users list
  const displayedUsers = useMemo(() => {
    const isHotelLocalUsers = activeTab === 'hotels' && managingHotel && branchTab === 'users';
    const baseUsers = isHotelLocalUsers ? managingHotelStaff : (userViewMode === 'global' ? globalUsers : hotelUsers);
    if (!userSearchTerm.trim()) return baseUsers;
    const term = userSearchTerm.toLowerCase().trim();
    return baseUsers.filter(user => {
      const nameMatch = user.name.toLowerCase().includes(term);
      const usernameMatch = (user.username || '').toLowerCase().includes(term);
      const userHotels = user.hotelIds?.map(hId => {
        const match = hotels.find(h => h.id === hId);
        return match ? match.name.toLowerCase() : '';
      }) || [];
      const hotelMatch = userHotels.some(hName => hName.includes(term));
      return nameMatch || usernameMatch || hotelMatch;
    });
  }, [activeTab, managingHotel, branchTab, userViewMode, globalUsers, hotelUsers, managingHotelStaff, userSearchTerm, hotels]);

  // Adjust page if it exceeds bounds
  useEffect(() => {
    const totalPagesCount = Math.ceil(displayedUsers.length / 10);
    if (totalPagesCount > 0 && usersPage > totalPagesCount) {
      setUsersPage(totalPagesCount);
    }
  }, [displayedUsers, usersPage, setUsersPage]);

  // Pagination bounds
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

  const handleAddUserClick = () => {
    setEditingUser(null);
    const nextUsername = getNextEmployeeId('housekeeping', globalUsers);
    const targetHotelId = managingHotel ? managingHotel.id : selectedHotelId;
    setUserForm({
      username: nextUsername,
      name: '',
      role: 'housekeeping',
      pin: '',
      language: 'ja',
      hotelIds: [targetHotelId],
      status: 'working'
    });
    setAddMode('link');
    setSelectedLinkUserId('');
    setUserModalOpen(true);
  };

  const handleEditUserClick = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username || '',
      name: user.name,
      role: user.role,
      pin: user.pin || '',
      language: user.language,
      hotelIds: user.hotelIds || [selectedHotelId],
      status: user.status || 'working'
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
        if (editingUser) {
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
        <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
          <input
            type="text"
            placeholder={
              language === 'vi' 
                ? 'Tìm kiếm theo tên hoặc khách sạn đang làm...' 
                : language === 'ja'
                  ? '名前 hoặc 所属ホテル で検索...'
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
                  <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    {user.username || '-'}
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
              width: '90%', 
              padding: '1.75rem', 
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              position: 'relative',
              overflow: 'hidden'
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
                    {language === 'vi' ? 'Mã NV (Tên đăng nhập)' : language === 'ja' ? 'ユーザー名 / スタッフID' : 'Username'}
                  </strong>
                  <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 600 }}>{viewingUser.username || '-'}</span>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                    Vai trò (Role)
                  </strong>
                  <span className="badge badge-occupied" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {viewingUser.role}
                  </span>
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                  Mật khẩu (Password)
                </strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.04)', width: 'fit-content' }}>
                  <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                    {showPasswords[viewingUser.id] ? `${viewingUser.username || 'cleaner'}123` : '••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, [viewingUser.id]: !prev[viewingUser.id] }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: '#64748b', display: 'flex', alignItems: 'center' }}
                    title={showPasswords[viewingUser.id] ? 'Hide' : 'Show'}
                  >
                    {showPasswords[viewingUser.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: '0.25rem' }}>
                  {language === 'vi' ? 'Khách sạn làm việc' : language === 'ja' ? '所属ホテル' : 'Assigned Hotels'}
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                  {viewingUser.hotelIds && viewingUser.hotelIds.length > 0 ? (
                    viewingUser.hotelIds.map(hId => {
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
                    <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-maintenance)', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {language === 'vi' ? 'Đã nghỉ việc' : language === 'ja' ? '退職' : 'Quit'}
                    </span>
                  ) : (
                    <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {language === 'vi' ? 'Đang làm việc' : language === 'ja' ? '在職' : 'Working'}
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
