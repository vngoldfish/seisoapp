import React from 'react';
import { CheckCircle2, Users, Clock, AlertTriangle, Building } from 'lucide-react';
import type { Hotel as HotelType } from '../../../db/dbInterface';

interface GlobalStatsProps {
  language: string;
  globalStats: {
    totalRooms: number;
    cleanRooms: number;
    dirtyRooms: number;
    cleaningRooms: number;
    maintenanceRooms: number;
    checkoutRooms: number;
    totalWorkers: number;
    avgCleaningTime: number;
    housekeeperRoomsCount: Record<string, number>;
    housekeeperTimes: Record<string, number[]>;
    defectsByCleaner: Record<string, { roomNumber: string; note: string; date: string; time?: string }[]>;
    allIssues: { hotelName: string; roomId: string; date: string; time?: string; type: string; note: string }[];
    hotelBreakdowns: Record<string, { total: number; clean: number; dirty: number; cleaning: number; maintenance: number; checkout: number; progress: number }>;
  };
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
  setManagingHotel: (hotel: HotelType) => void;
  selectHotel: (id: string) => void;
  setBranchTab: (tab: any) => void;
  getVisiblePages: (curr: number, total: number) => (number | string)[];
}

export const GlobalStats: React.FC<GlobalStatsProps> = ({
  language,
  globalStats,
  hotelSearchTerm,
  setHotelSearchTerm,
  hotelFilterStatus,
  setHotelFilterStatus,
  setHotelPage,
  hotelPerPage,
  setHotelPerPage,
  hotelSortBy,
  setHotelSortBy,
  hotelSortOrder,
  setHotelSortOrder,
  processedHotelsData,
  setManagingHotel,
  selectHotel,
  setBranchTab,
  getVisiblePages
}) => {
  const [issueSearch, setIssueSearch] = React.useState('');
  const [issueType, setIssueType] = React.useState('all');
  const [issueSortField, setIssueSortField] = React.useState<'date' | 'hotelName' | 'roomId'>('date');
  const [issueSortOrder, setIssueSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [issuePage, setIssuePage] = React.useState(1);
  const [issuePerPage, setIssuePerPage] = React.useState(5);

  const filteredIssues = React.useMemo(() => {
    return globalStats.allIssues.filter(issue => {
      const term = issueSearch.toLowerCase().trim();
      const matchesSearch = !term ||
        issue.hotelName.toLowerCase().includes(term) ||
        issue.roomId.toLowerCase().includes(term) ||
        issue.note.toLowerCase().includes(term);

      const matchesType = issueType === 'all' || issue.type === issueType;

      return matchesSearch && matchesType;
    });
  }, [globalStats.allIssues, issueSearch, issueType]);

  const sortedIssues = React.useMemo(() => {
    return [...filteredIssues].sort((a, b) => {
      let valA: any = a[issueSortField] || '';
      let valB: any = b[issueSortField] || '';

      if (issueSortField === 'date') {
        const timeA = a.time ? ` ${a.time}` : ' 00:00';
        const timeB = b.time ? ` ${b.time}` : ' 00:00';
        try {
          valA = new Date(`${a.date}${timeA}`).getTime();
          valB = new Date(`${b.date}${timeB}`).getTime();
        } catch {
          valA = 0;
          valB = 0;
        }
      } else {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return issueSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return issueSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredIssues, issueSortField, issueSortOrder]);

  const paginatedIssues = React.useMemo(() => {
    if (issuePerPage === 0) return sortedIssues;
    const startIdx = (issuePage - 1) * issuePerPage;
    return sortedIssues.slice(startIdx, startIdx + issuePerPage);
  }, [sortedIssues, issuePage, issuePerPage]);

  const totalIssuePages = React.useMemo(() => {
    if (issuePerPage === 0) return 1;
    return Math.ceil(sortedIssues.length / issuePerPage) || 1;
  }, [sortedIssues, issuePerPage]);

  const [defectSearch, setDefectSearch] = React.useState('');
  const [defectSortField, setDefectSortField] = React.useState<'name' | 'count'>('count');
  const [defectSortOrder, setDefectSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [defectPage, setDefectPage] = React.useState(1);
  const [defectPerPage, setDefectPerPage] = React.useState(5);

  const parsedDefects = React.useMemo(() => {
    return Object.entries(globalStats.defectsByCleaner || {}).map(([name, defects]) => ({
      name,
      defects,
      count: defects.length
    }));
  }, [globalStats.defectsByCleaner]);

  const filteredDefects = React.useMemo(() => {
    return parsedDefects.filter(item => {
      const term = defectSearch.toLowerCase().trim();
      return !term || item.name.toLowerCase().includes(term) || item.defects.some(d => d.roomNumber.toLowerCase().includes(term) || d.note.toLowerCase().includes(term));
    });
  }, [parsedDefects, defectSearch]);

  const sortedDefects = React.useMemo(() => {
    return [...filteredDefects].sort((a, b) => {
      if (defectSortField === 'name') {
        return defectSortOrder === 'asc'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      } else {
        return defectSortOrder === 'asc'
          ? a.count - b.count
          : b.count - a.count;
      }
    });
  }, [filteredDefects, defectSortField, defectSortOrder]);

  const paginatedDefects = React.useMemo(() => {
    if (defectPerPage === 0) return sortedDefects;
    const startIdx = (defectPage - 1) * defectPerPage;
    return sortedDefects.slice(startIdx, startIdx + defectPerPage);
  }, [sortedDefects, defectPage, defectPerPage]);

  const totalDefectPages = React.useMemo(() => {
    if (defectPerPage === 0) return 1;
    return Math.ceil(sortedDefects.length / defectPerPage) || 1;
  }, [sortedDefects, defectPerPage]);

  React.useEffect(() => {
    setIssuePage(1);
  }, [issueSearch, issueType, issueSortField, issueSortOrder, issuePerPage]);

  React.useEffect(() => {
    setDefectPage(1);
  }, [defectSearch, defectSortField, defectSortOrder, defectPerPage]);

  return (
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
            <Building size={20} />
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
        {/* Housekeeper Leaderboard Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
            🏆 {language === 'vi' ? 'Bảng Thành Tích Dọn Dẹp Toàn Hệ Thống' : language === 'ja' ? 'スタッフ清掃実績ランキング (全店舗総合)' : 'System-wide Housekeeper Leaderboard'}
          </h3>
          {Object.keys(globalStats.housekeeperRoomsCount).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.6, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {language === 'vi' ? 'Chưa có hoạt động dọn dẹp nào được ghi nhận' : language === 'ja' ? '本日の実績はありません' : 'No housekeeping activities recorded'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto', maxHeight: '420px', paddingRight: '0.25rem' }}>
              {Object.entries(globalStats.housekeeperRoomsCount)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count], index) => {
                  let badgeStyle = { backgroundColor: 'rgba(0,0,0,0.04)', color: 'inherit' };
                  if (index === 0) badgeStyle = { backgroundColor: '#fef3c7', color: '#d97706' }; // Gold
                  else if (index === 1) badgeStyle = { backgroundColor: '#f1f5f9', color: '#475569' }; // Silver
                  else if (index === 2) badgeStyle = { backgroundColor: '#ffedd5', color: '#ea580c' }; // Bronze

                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', fontSize: '0.8rem', fontWeight: 800, ...badgeStyle }}>
                          {index + 1}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{name}</span>
                      </div>
                      <span className="badge badge-clean" style={{ fontWeight: 'bold' }}>
                        {language === 'vi' ? `${count} phòng` : language === 'ja' ? `${count} 部屋` : `${count} rooms`}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Cleaner Speed Comparison Chart */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
            📊 {language === 'vi' ? 'Biểu Đồ So Sánh Tốc Độ Dọn Dẹp (Thời gian trung bình)' : language === 'ja' ? 'スタッフ清掃速度比較グラフ (平均時間)' : 'Housekeeper Speed Comparison Chart (Avg Duration)'}
          </h3>
          {Object.keys(globalStats.housekeeperTimes).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.6, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {language === 'vi' ? 'Chưa có hoạt động dọn dẹp nào được ghi nhận' : language === 'ja' ? '本日の実績はありません' : 'No housekeeping activities recorded'}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', padding: '0.5rem 0' }}>
              {Object.entries(globalStats.housekeeperTimes).map(([name, times]) => {
                const avg = Math.round(times.reduce((sum, t) => sum + t, 0) / times.length) || 0;
                // Normalize bar width (max 60 minutes represents 100%)
                const percentage = Math.min(100, Math.max(10, (avg / 60) * 100));

                let barColor = 'var(--status-clean)';
                if (avg > 45) barColor = 'var(--status-maintenance)';
                else if (avg > 30) barColor = 'var(--status-dirty)';

                return (
                  <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                      <span>{name}</span>
                      <span style={{ opacity: 0.8 }}>
                        {avg} {language === 'vi' ? 'phút / phòng' : language === 'ja' ? '分 / 部屋' : 'mins / room'} ({times.length} {language === 'vi' ? 'lần' : language === 'ja' ? '回' : 'cleans'})
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '12px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          backgroundColor: barColor,
                          borderRadius: '6px',
                          transition: 'width 0.5s ease-out'
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Cleaner Defects List */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
            👤 {language === 'vi' ? 'Chi tiết lỗi theo nhân viên:' : language === 'ja' ? 'スタッフ別不備詳細:' : 'Defects by Housekeeper:'}
          </h3>
          {Object.keys(globalStats.defectsByCleaner).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.6, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {language === 'vi' ? 'Không phát hiện lỗi dọn dẹp nào' : language === 'ja' ? '指摘された不備はありません' : 'No cleaner defects reported'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              {/* Defect Search, Sort, Page Size Toolbar */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1, padding: '0.35rem 0.75rem', fontSize: '0.8rem', minWidth: '150px' }}
                  placeholder={language === 'vi' ? 'Tìm nhân viên, phòng, lỗi...' : 'Search staff, room, note...'}
                  value={defectSearch}
                  onChange={e => setDefectSearch(e.target.value)}
                />
                
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <select
                    value={defectSortField}
                    onChange={e => setDefectSortField(e.target.value as any)}
                    className="form-input"
                    style={{ width: '90px', padding: '0.35rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                  >
                    <option value="count">{language === 'vi' ? 'Số lỗi' : 'Defects'}</option>
                    <option value="name">{language === 'vi' ? 'Tên NV' : 'Name'}</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDefectSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {defectSortOrder === 'asc' ? '▲' : '▼'}
                  </button>
                  <select
                    value={defectPerPage}
                    onChange={e => setDefectPerPage(Number(e.target.value))}
                    className="form-input"
                    style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                  >
                    <option value={3}>3 / pg</option>
                    <option value={5}>5 / pg</option>
                    <option value={10}>10 / pg</option>
                    <option value={0}>All</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '350px', paddingRight: '0.25rem', flex: 1 }}>
                {paginatedDefects.map((item) => (
                  <div key={item.name} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                      🧹 {item.name} ({item.count} {language === 'vi' ? 'lỗi' : language === 'ja' ? '指摘' : 'defects'})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {item.defects.map((d, index) => (
                        <div key={index} style={{ fontSize: '0.8rem', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.015)', border: '1px solid rgba(0,0,0,0.03)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span>Phòng {d.roomNumber}</span>
                            <span style={{ opacity: 0.6 }}>{d.date.split('-').reverse().join('/')} {d.time || ''}</span>
                          </div>
                          <div style={{ fontStyle: 'italic', color: 'var(--status-maintenance)' }}>
                            ⚠️ {d.note}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Defects Footer Pagination */}
              {totalDefectPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem', fontSize: '0.75rem' }}>
                  <span style={{ opacity: 0.6 }}>
                    {language === 'vi' ? `Trang ${defectPage} / ${totalDefectPages}` : `Page ${defectPage} of ${totalDefectPages}`}
                  </span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setDefectPage(prev => Math.max(prev - 1, 1))}
                      disabled={defectPage === 1}
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                    >
                      &laquo;
                    </button>
                    {getVisiblePages(defectPage, totalDefectPages).map((p, idx) => {
                      if (p === '...') {
                        return <span key={`dots-${idx}`} style={{ padding: '0 0.2rem', opacity: 0.5 }}>...</span>;
                      }
                      return (
                        <button
                          key={p}
                          type="button"
                          className={`btn ${defectPage === p ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          onClick={() => setDefectPage(p as number)}
                          style={{ minWidth: '22px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setDefectPage(prev => Math.min(prev + 1, totalDefectPages))}
                      disabled={defectPage === totalDefectPages}
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                    >
                      &raquo;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Hotel Progress & Breakdown */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
            🏢 {language === 'vi' ? 'Tiến Độ Dọn Dẹp Chi Nhánh' : language === 'ja' ? 'ホテル別清掃進捗状況' : 'Branch Clean Progress'}
          </h3>

          {/* Search, Filter, Page Size Controls */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'var(--panel-bg-subtle)', marginBottom: '1rem' }}>
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
                style={{ width: '130px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', height: 'auto' }}
              >
                <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : language === 'ja' ? 'すべての状態' : 'All status'}</option>
                <option value="completed">{language === 'vi' ? 'Đã dọn xong 100%' : language === 'ja' ? '完了 (100%)' : 'Completed (100%)'}</option>
                <option value="in_progress">{language === 'vi' ? 'Đang dọn dẹp' : language === 'ja' ? '清掃中' : 'In progress'}</option>
              </select>
              <select
                value={hotelSortBy}
                onChange={(e) => setHotelSortBy(e.target.value as any)}
                className="form-input"
                style={{ width: '120px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', height: 'auto' }}
              >
                <option value="name">{language === 'vi' ? 'Tên khách sạn' : 'Hotel Name'}</option>
                <option value="id">{language === 'vi' ? 'Mã khách sạn' : 'Hotel Code'}</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setHotelSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px' }}
                title={language === 'vi' ? 'Đảo chiều sắp xếp' : 'Toggle Sort Order'}
              >
                {hotelSortOrder === 'asc' ? '▲' : '▼'}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            {processedHotelsData.displayed.map(h => {
              const b = globalStats.hotelBreakdowns[h.id] || { total: 0, clean: 0, dirty: 0, cleaning: 0, maintenance: 0, checkout: 0, progress: 0 };
              return (
                <div
                  key={h.id}
                  style={{
                    padding: '0.85rem',
                    backgroundColor: 'rgba(0,0,0,0.015)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    setManagingHotel(h);
                    selectHotel(h.id);
                    setBranchTab('stats');
                  }}
                  title={language === 'vi' ? 'Xem chi tiết chi nhánh' : 'View branch details'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    <span>🏨 {h.name}</span>
                    <span style={{ color: 'var(--primary-color)' }}>{b.progress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{ width: `${b.progress}%`, height: '100%', backgroundColor: b.progress === 100 ? 'var(--status-clean)' : 'var(--primary-color)', borderRadius: '4px' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.8 }}>
                    <span>Tổng: <strong>{b.total}</strong> phòng</span>
                    <span>🟢 {b.clean} | 🟡 {b.dirty} | 🟠 {b.cleaning} | 🔴 {b.maintenance}</span>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            {processedHotelsData.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: '0.25rem', width: '100%', justifyContent: 'center' }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setHotelPage(prev => Math.max(prev - 1, 1))}
                    disabled={processedHotelsData.currentPage === 1}
                    style={{ minWidth: '32px' }}
                  >
                    &laquo;
                  </button>
                  {getVisiblePages(processedHotelsData.currentPage, processedHotelsData.totalPages).map((page, idx) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} style={{ padding: '0.2rem 0.4rem', opacity: 0.5, fontSize: '0.85rem' }}>
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        className={`btn btn-sm ${processedHotelsData.currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setHotelPage(page as number)}
                        style={{ minWidth: '32px', fontWeight: processedHotelsData.currentPage === page ? 'bold' : 'normal' }}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setHotelPage(prev => Math.min(prev + 1, processedHotelsData.totalPages))}
                    disabled={processedHotelsData.currentPage === processedHotelsData.totalPages}
                    style={{ minWidth: '32px' }}
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Issues & Errors list (Các lỗi xảy ra) */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} style={{ color: 'var(--status-maintenance)' }} />
            {language === 'vi' ? 'Sự Cố & Lỗi Ghi Nhận' : language === 'ja' ? '報告された問題・トラブル' : 'Reported Issues & Errors'}
          </h3>

          {/* Search, Filter, Sort and Page size for Issues */}
          <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', backgroundColor: 'var(--panel-bg-subtle)', marginBottom: '1rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm sự cố, số phòng, chi nhánh...' : language === 'ja' ? '問題、客室、ホテル検索...' : 'Search issues, room, hotel...'}
              value={issueSearch}
              onChange={(e) => setIssueSearch(e.target.value)}
              className="form-input"
              style={{ flex: '2 1 200px', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            />
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="form-input"
              style={{ flex: '1 1 120px', padding: '0.35rem 0.5rem', fontSize: '0.8rem', height: 'auto' }}
            >
              <option value="all">{language === 'vi' ? 'Tất cả loại sự cố' : language === 'ja' ? 'すべてのタイプ' : 'All Types'}</option>
              <option value="maintenance">{language === 'vi' ? 'Bảo trì (Maintenance)' : language === 'ja' ? '不具合 (Maintenance)' : 'Maintenance'}</option>
              <option value="dirty">{language === 'vi' ? 'Lỗi dọn dẹp (Defect)' : language === 'ja' ? '清掃不備 (Defect)' : 'Defect'}</option>
            </select>
            <select
              value={issueSortField}
              onChange={(e) => setIssueSortField(e.target.value as any)}
              className="form-input"
              style={{ flex: '1 1 120px', padding: '0.35rem 0.5rem', fontSize: '0.8rem', height: 'auto' }}
            >
              <option value="date">{language === 'vi' ? 'Sắp xếp theo ngày' : language === 'ja' ? '日付でソート' : 'Sort by Date'}</option>
              <option value="hotelName">{language === 'vi' ? 'Khách sạn' : language === 'ja' ? 'ホテル名' : 'Hotel'}</option>
              <option value="roomId">{language === 'vi' ? 'Số phòng' : language === 'ja' ? '部屋番号' : 'Room Number'}</option>
            </select>
            <button
              type="button"
              onClick={() => setIssueSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}
            >
              {issueSortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{language === 'vi' ? 'Hiển thị:' : 'Show:'}</span>
              <select
                value={issuePerPage}
                onChange={(e) => setIssuePerPage(Number(e.target.value))}
                className="form-input"
                style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', height: 'auto' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={0}>{language === 'vi' ? 'Tất cả' : 'All'}</option>
              </select>
            </div>
          </div>

          {sortedIssues.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.6, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div>
                <span style={{ fontSize: '2rem' }}>✅</span>
                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                  {language === 'vi' ? 'Không tìm thấy sự cố nào thích hợp' : language === 'ja' ? '該当するトラブルはありません' : 'No matching issues found'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '420px', paddingRight: '0.25rem' }}>
                {paginatedIssues.map((issue, idx) => (
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

              {/* Issue Pagination Controls */}
              {totalIssuePages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.75rem 0.5rem 0 0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                    {language === 'vi' 
                      ? `Hiển thị ${((issuePage - 1) * (issuePerPage || sortedIssues.length)) + 1}-${Math.min(issuePage * (issuePerPage || sortedIssues.length), sortedIssues.length)} trên tổng số ${sortedIssues.length} sự cố` 
                      : language === 'ja'
                        ? `${sortedIssues.length}件中 ${((issuePage - 1) * (issuePerPage || sortedIssues.length)) + 1}-${Math.min(issuePage * (issuePerPage || sortedIssues.length), sortedIssues.length)}件を表示`
                        : `Showing ${((issuePage - 1) * (issuePerPage || sortedIssues.length)) + 1}-${Math.min(issuePage * (issuePerPage || sortedIssues.length), sortedIssues.length)} of ${sortedIssues.length} issues`}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIssuePage(prev => Math.max(prev - 1, 1))}
                      disabled={issuePage === 1}
                      style={{ minWidth: '32px' }}
                    >
                      &laquo;
                    </button>
                    {getVisiblePages(issuePage, totalIssuePages).map((page, index) => {
                      if (page === '...') {
                        return (
                          <span key={`ellipsis-${index}`} style={{ padding: '0.2rem 0.4rem', opacity: 0.5, fontSize: '0.8rem' }}>
                            ...
                          </span>
                        );
                      }
                      return (
                        <button
                          key={page}
                          type="button"
                          className={`btn btn-sm ${issuePage === page ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setIssuePage(page as number)}
                          style={{ minWidth: '28px', fontSize: '0.75rem', padding: '0.2rem 0.4rem', fontWeight: issuePage === page ? 'bold' : 'normal' }}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIssuePage(prev => Math.min(prev + 1, totalIssuePages))}
                      disabled={issuePage === totalIssuePages}
                      style={{ minWidth: '32px' }}
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
    </div>
  );
};
