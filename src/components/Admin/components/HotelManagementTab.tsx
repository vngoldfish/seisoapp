import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import type { Hotel as HotelType } from '../../../db/dbInterface';

interface HotelManagementTabProps {
  language: string;
  hotels: HotelType[];
  hotelSearchTerm: string;
  setHotelSearchTerm: (val: string) => void;
  hotelFilterStatus: 'all' | 'completed' | 'in_progress';
  setHotelFilterStatus: (val: 'all' | 'completed' | 'in_progress') => void;
  hotelPage: number;
  setHotelPage: React.Dispatch<React.SetStateAction<number>>;
  hotelPerPage: number;
  setHotelPerPage: (val: number) => void;
  hotelSortBy: 'id' | 'name';
  setHotelSortBy: (val: 'id' | 'name') => void;
  hotelSortOrder: 'asc' | 'desc';
  setHotelSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  processedHotelsData: {
    displayed: HotelType[];
    totalPages: number;
    currentPage: number;
    totalItems: number;
  };
  handleAddHotelClick: () => void;
  handleEditHotelClick: (hotel: HotelType) => void;
  handleDeleteHotel: (id: string) => void;
  setManagingHotel: (hotel: HotelType | null) => void;
  selectHotel: (id: string) => void;
  setBranchTab: (tab: any) => void;
  hotelId: string;
  getTranslation: (lang: any, key: any) => string;
  getVisiblePages: (curr: number, total: number) => (number | string)[];
}

export const HotelManagementTab: React.FC<HotelManagementTabProps> = ({
  language,
  hotelSearchTerm,
  setHotelSearchTerm,
  hotelFilterStatus,
  setHotelFilterStatus,
  hotelPage,
  setHotelPage,
  hotelPerPage,
  setHotelPerPage,
  hotelSortBy,
  setHotelSortBy,
  hotelSortOrder,
  setHotelSortOrder,
  processedHotelsData,
  handleAddHotelClick,
  handleEditHotelClick,
  handleDeleteHotel,
  setManagingHotel,
  selectHotel,
  setBranchTab,
  hotelId,
  getTranslation,
  getVisiblePages
}) => {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{getTranslation(language, 'hotelManagement')}</h3>
        <button className="btn btn-primary btn-sm" onClick={handleAddHotelClick}>
          <Plus size={16} />
          <span className="desktop-only-inline">
            {getTranslation(language, 'addHotel')}
          </span>
          <span className="mobile-only-inline">
            {language === 'vi' ? 'Thêm' : 'Add'}
          </span>
        </button>
      </div>

      {/* Search, Filter, Sort, Page Size Controls */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'var(--panel-bg-subtle)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder={language === 'vi' ? 'Tìm tên/mã khách sạn...' : language === 'ja' ? 'ホテル名・コード検索...' : 'Search hotel name/code...'}
            value={hotelSearchTerm}
            onChange={(e) => setHotelSearchTerm(e.target.value)}
            className="form-input"
            style={{ flex: '2 1 180px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          />
          <select
            value={hotelFilterStatus}
            onChange={(e) => setHotelFilterStatus(e.target.value as any)}
            className="form-input"
            style={{ flex: '1 1 130px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', height: 'auto' }}
          >
            <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : language === 'ja' ? 'すべての状態' : 'All status'}</option>
            <option value="completed">{language === 'vi' ? 'Đã dọn xong 100%' : language === 'ja' ? '完了 (100%)' : 'Completed (100%)'}</option>
            <option value="in_progress">{language === 'vi' ? 'Đang dọn dẹp' : language === 'ja' ? '清掃中' : 'In progress'}</option>
          </select>
          
          {/* Sorting controls */}
          <select
            value={hotelSortBy}
            onChange={(e) => setHotelSortBy(e.target.value as any)}
            className="form-input"
            style={{ flex: '1 1 130px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', height: 'auto' }}
          >
            <option value="name">{language === 'vi' ? 'Tên khách sạn' : language === 'ja' ? 'ホテル名' : 'Hotel Name'}</option>
            <option value="id">{language === 'vi' ? 'Mã khách sạn' : language === 'ja' ? 'ホテルコード' : 'Hotel Code'}</option>
          </select>
          <button
            type="button"
            onClick={() => setHotelSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={language === 'vi' ? 'Đảo chiều sắp xếp' : 'Toggle Sort Order'}
          >
            {hotelSortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
          </button>
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

      <>
        {/* Desktop view: Table */}
        <div className="desktop-only-block" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                <th 
                  style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => {
                    setHotelSortBy('id');
                    setHotelSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                  title="Sort by Hotel Code"
                >
                  {getTranslation(language, 'hotelCode')} {hotelSortBy === 'id' ? (hotelSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th 
                  style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => {
                    setHotelSortBy('name');
                    setHotelSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                  title="Sort by Hotel Name"
                >
                  {getTranslation(language, 'hotelName')} {hotelSortBy === 'name' ? (hotelSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'description')}</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'action')}</th>
              </tr>
            </thead>
            <tbody>
              {processedHotelsData.displayed.map(h => (
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
          {processedHotelsData.displayed.map(h => (
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

        {/* Pagination Controls */}
        {processedHotelsData.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem 0.5rem 0 0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>
              {language === 'vi' 
                ? `Hiển thị ${((hotelPage - 1) * hotelPerPage) + 1}-${Math.min(hotelPage * hotelPerPage, processedHotelsData.totalItems)} trên tổng số ${processedHotelsData.totalItems} khách sạn` 
                : language === 'ja'
                  ? `${processedHotelsData.totalItems}軒中 ${((hotelPage - 1) * hotelPerPage) + 1}-${Math.min(hotelPage * hotelPerPage, processedHotelsData.totalItems)}軒を表示`
                  : `Showing ${((hotelPage - 1) * hotelPerPage) + 1}-${Math.min(hotelPage * hotelPerPage, processedHotelsData.totalItems)} of ${processedHotelsData.totalItems} hotels`}
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setHotelPage(prev => Math.max(prev - 1, 1))}
                disabled={hotelPage === 1}
                style={{ minWidth: '40px' }}
              >
                &laquo;
              </button>
              {getVisiblePages(hotelPage, processedHotelsData.totalPages).map((page, idx) => {
                if (page === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} style={{ padding: '0.4rem 0.5rem', opacity: 0.5, fontSize: '0.85rem' }}>
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={page}
                    className={`btn btn-sm ${hotelPage === page ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setHotelPage(page as number)}
                    style={{ minWidth: '32px', fontWeight: hotelPage === page ? 'bold' : 'normal' }}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setHotelPage(prev => Math.min(prev + 1, processedHotelsData.totalPages))}
                disabled={hotelPage === processedHotelsData.totalPages}
                style={{ minWidth: '40px' }}
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </>
    </div>
  );
};
