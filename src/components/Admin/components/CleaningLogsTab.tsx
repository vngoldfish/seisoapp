import React from 'react';
import { Download } from 'lucide-react';
import type { CleaningLog } from '../../../db/dbInterface';

interface CleaningLogsTabProps {
  language: string;
  logs: CleaningLog[];
  activeDate: string;
  selectedHotelId: string;
  addToast: (msg: string, type: 'success' | 'warning' | 'info') => void;
  getTranslation: any;
}

const translateDefect = (defect: string, lang: string): string => {
  if (!defect) return '';
  if (lang === 'vi') return defect;
  
  if (defect.startsWith('Lỗi khác:')) {
    const text = defect.substring(9).trim();
    if (lang === 'ja') return `その他指摘: ${text}`;
    return `Other defect: ${text}`;
  }
  
  switch (defect) {
    case 'Chưa lau sàn / hút bụi':
      return lang === 'ja' ? '床掃除・掃除機未実施' : 'Floor dusty/dirty';
    case 'Thiếu khăn / đồ tiêu hao':
      return lang === 'ja' ? 'アメニティ・タオル不足' : 'Missing towels/amenities';
    case 'Bẩn nhà vệ sinh / bồn tắm':
      return lang === 'ja' ? '水回り・浴室汚れ' : 'Dirty bathroom';
    case 'Ga giường nhăn / bẩn':
      return lang === 'ja' ? 'シーツしわ・汚れ' : 'Wrinkled/dirty sheet';
    case 'Chưa đổ rác':
      return lang === 'ja' ? 'ゴミ未回収' : 'Trash not emptied';
    case 'Còn bụi bẩn trên bàn / tủ':
      return lang === 'ja' ? '家具ほこり残り' : 'Dust on furniture';
    default:
      return defect;
  }
};

export const CleaningLogsTab: React.FC<CleaningLogsTabProps> = ({
  language,
  logs,
  activeDate,
  selectedHotelId,
  addToast,
  getTranslation
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [floorFilter, setFloorFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [sortBy, setSortBy] = React.useState<'endedAt' | 'startedAt' | 'duration' | 'roomNumber' | 'cleanerName'>('endedAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Filter logs for the active date
  const dailyLogs = React.useMemo(() => logs.filter(log => log.endedAt.startsWith(activeDate)), [logs, activeDate]);

  // Extract unique floors from daily logs
  const uniqueFloors = React.useMemo(() => {
    const floors = dailyLogs.map(log => log.floor);
    return Array.from(new Set(floors)).sort((a, b) => a - b);
  }, [dailyLogs]);

  // Filter logs by search query, floor, and special statuses
  const filteredLogs = React.useMemo(() => {
    return dailyLogs.filter(log => {
      const sTerm = searchTerm.trim().toLowerCase();
      const matchesSearch = !sTerm || 
        log.roomNumber.toLowerCase().includes(sTerm) || 
        log.cleanerName.toLowerCase().includes(sTerm) ||
        (log.notes && log.notes.toLowerCase().includes(sTerm));
      
      const matchesFloor = floorFilter === 'all' || log.floor.toString() === floorFilter;
      
      let matchesStatus = true;
      if (statusFilter === 'notes') {
        matchesStatus = !!log.notes;
      } else if (statusFilter === 'defects') {
        matchesStatus = !!(log.errors && log.errors.length > 0);
      } else if (statusFilter === 'photo') {
        matchesStatus = !!log.photoAfter;
      }
      
      return matchesSearch && matchesFloor && matchesStatus;
    });
  }, [dailyLogs, searchTerm, floorFilter, statusFilter]);

  // Sort filtered logs
  const sortedLogs = React.useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let valA: any = sortBy === 'duration' ? a.durationMinutes : a[sortBy];
      let valB: any = sortBy === 'duration' ? b.durationMinutes : b[sortBy];

      if (sortBy === 'startedAt' || sortBy === 'endedAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortBy === 'roomNumber') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : valB.localeCompare(valA, undefined, { numeric: true });
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, sortBy, sortOrder]);

  // Paginated logs
  const paginatedLogs = React.useMemo(() => {
    if (itemsPerPage === 0) return sortedLogs;
    const startIdx = (currentPage - 1) * itemsPerPage;
    return sortedLogs.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedLogs, currentPage, itemsPerPage]);

  const totalPages = React.useMemo(() => {
    if (itemsPerPage === 0) return 1;
    return Math.ceil(sortedLogs.length / itemsPerPage) || 1;
  }, [sortedLogs, itemsPerPage]);

  // Reset to page 1 when search or filter states change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, floorFilter, statusFilter, sortBy, sortOrder, itemsPerPage]);

  const getVisiblePages = (curr: number, total: number) => {
    const pages: (number | string)[] = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (curr <= 3) {
        pages.push(1, 2, 3, 4, '...', total);
      } else if (curr >= total - 2) {
        pages.push(1, '...', total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, '...', curr - 1, curr, curr + 1, '...', total);
      }
    }
    return pages;
  };

  const handleExportCSV = () => {
    const headers = language === 'vi' 
      ? ["Số phòng", "Tầng", "Nhân viên dọn", "Người duyệt", "Thời gian duyệt", "Bắt đầu", "Kết thúc", "Thời gian dọn (phút)", "Ghi chú", "Lỗi phát hiện", "Hình ảnh"]
      : language === 'ja'
        ? ["部屋番号", "階", "清掃スタッフ", "検査者", "検査時間", "開始時間", "完了時間", "清掃時間 (分)", "メモ", "検出された欠陥", "写真"]
        : ["Room Number", "Floor", "Cleaner Name", "Checked By", "Checked At", "Start Time", "End Time", "Duration (mins)", "Notes", "Defects Detected", "Photo"];

    const rows = sortedLogs.map(log => {
      const errorsStr = log.errors && log.errors.length > 0 ? log.errors.join('; ') : '';
      const noteStr = log.notes || '';
      const photoStr = log.photoAfter ? (log.photoAfter.startsWith('data:') ? 'Image uploaded' : log.photoAfter) : '';
      const checkerName = log.checkedBy || '';
      const checkerTime = log.checkedAt ? new Date(log.checkedAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US') : '';
      
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
        checkerName,
        checkerTime,
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
          disabled={sortedLogs.length === 0}
        >
          <Download size={16} />
          {language === 'vi' ? 'Xuất CSV' : language === 'ja' ? 'CSV出力' : 'Export CSV'}
        </button>
      </div>

      {/* Toolbar: Search, Filters, Sort, Page Size */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'var(--panel-bg-subtle)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ flex: '2 1 200px', position: 'relative' }}>
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm phòng, nhân viên, ghi chú...' : language === 'ja' ? '部屋、スタッフ、メモで検索...' : 'Search room, cleaner, notes...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.85rem' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', opacity: 0.5 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Floor filter */}
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="form-input"
            style={{ flex: '1 1 110px', padding: '0.4rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
          >
            <option value="all">{language === 'vi' ? 'Tất cả các tầng' : language === 'ja' ? 'すべての階' : 'All Floors'}</option>
            {uniqueFloors.map(floor => (
              <option key={floor} value={floor.toString()}>{floor}F</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input"
            style={{ flex: '1 1 120px', padding: '0.4rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
          >
            <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : language === 'ja' ? 'すべての状態' : 'All Status'}</option>
            <option value="notes">{language === 'vi' ? 'Có ghi chú' : language === 'ja' ? 'メモあり' : 'Has Notes'}</option>
            <option value="defects">{language === 'vi' ? 'Có lỗi phát hiện' : language === 'ja' ? '不備あり' : 'Has Defects'}</option>
            <option value="photo">{language === 'vi' ? 'Có ảnh dọn dẹp' : language === 'ja' ? '写真あり' : 'Has Photos'}</option>
          </select>

          {/* Sort field */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="form-input"
            style={{ flex: '1 1 120px', padding: '0.4rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
          >
            <option value="endedAt">{language === 'vi' ? 'Giờ kết thúc' : language === 'ja' ? '完了時間' : 'End Time'}</option>
            <option value="startedAt">{language === 'vi' ? 'Giờ bắt đầu' : language === 'ja' ? '開始時間' : 'Start Time'}</option>
            <option value="duration">{language === 'vi' ? 'Thời lượng' : language === 'ja' ? '清掃時間' : 'Duration'}</option>
            <option value="roomNumber">{language === 'vi' ? 'Số phòng' : language === 'ja' ? '部屋番号' : 'Room Number'}</option>
            <option value="cleanerName">{language === 'vi' ? 'Nhân viên dọn' : language === 'ja' ? '清掃スタッフ' : 'Cleaner Name'}</option>
          </select>

          {/* Sort order button */}
          <button
            type="button"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={language === 'vi' ? 'Đảo chiều sắp xếp' : 'Toggle Sort Order'}
          >
            {sortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', opacity: 0.8, flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>
            {language === 'vi' ? `Tìm thấy ${sortedLogs.length} bản ghi` : language === 'ja' ? `${sortedLogs.length} 件 của tài liệu` : `Found ${sortedLogs.length} records`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>{language === 'vi' ? 'Hiển thị:' : language === 'ja' ? '表示数:' : 'Show:'}</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="form-input"
              style={{ width: '70px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', height: 'auto' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={0}>{language === 'vi' ? 'Tất cả' : language === 'ja' ? 'すべて' : 'All'}</option>
            </select>
          </div>
        </div>
      </div>

      {sortedLogs.length === 0 ? (
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
                  <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Người duyệt' : language === 'ja' ? '検査者' : 'Checked By'}</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'startCleaning')}</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'finishCleaning')}</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Thời lượng' : language === 'ja' ? '清掃時間' : 'Duration'}</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>{getTranslation(language, 'notes')}</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>{language === 'vi' ? 'Hình ảnh' : language === 'ja' ? '写真' : 'Photo'}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>
                      {log.roomNumber} <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6 }}>({log.floor}F)</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{log.cleanerName}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem' }}>
                      {log.checkedBy ? (
                        <span style={{ fontWeight: 500 }}>
                          {log.checkedBy}
                          <span style={{ fontSize: '0.75rem', opacity: 0.6, display: 'block' }}>
                            {new Date(log.checkedAt!).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </span>
                      ) : (
                        <span style={{ opacity: 0.4 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>
                      {new Date(log.startedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>
                      {new Date(log.endedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span className="badge badge-clean" style={{ fontSize: '0.65rem' }}>{log.durationMinutes} mins</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem' }}>
                      {log.notes && (
                        <div style={{ marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>🧹 {language === 'vi' ? 'Ghi chú NV:' : language === 'ja' ? '清掃員メモ:' : 'Cleaner Notes:'}</span> {log.notes}
                        </div>
                      )}
                      {log.checkerNotes && (
                        <div style={{ marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.6, color: 'var(--status-maintenance)' }}>🔍 {language === 'vi' ? 'Người check:' : language === 'ja' ? '指摘メモ:' : 'Checker Notes:'}</span> {log.checkerNotes}
                        </div>
                      )}
                      {log.errors && log.errors.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem', marginTop: '0.25rem' }}>
                          {log.errors.map((e, idx) => (
                            <span key={idx} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-maintenance)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '3px' }}>
                              {translateDefect(e, language)}
                            </span>
                          ))}
                        </div>
                      ) : log.checkedBy ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--status-clean)', fontWeight: 500, marginTop: '0.25rem' }}>
                          ✓ {language === 'vi' ? 'Đạt 100%' : language === 'ja' ? '100%合格' : 'Passed 100%'}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {log.photoAfter ? (
                        <a href={log.photoAfter} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600 }}>
                          {language === 'vi' ? 'Xem ảnh' : language === 'ja' ? '写真を見る' : 'View Photo'}
                        </a>
                      ) : (
                        <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>{language === 'vi' ? 'Không ảnh' : language === 'ja' ? '写真なし' : 'No Photo'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view: Cards */}
          <div className="mobile-only-block" style={{ width: '100%' }}>
            {paginatedLogs.map(log => (
              <div key={log.id} className="glass-panel" style={{ padding: '1rem', marginBottom: '0.75rem', borderLeft: '4px solid var(--primary-color)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>Room {log.roomNumber} ({log.floor}F)</span>
                  <span className="badge badge-clean" style={{ fontSize: '0.65rem' }}>{log.durationMinutes} mins</span>
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <strong>{getTranslation(language, 'cleanerName')}:</strong> {log.cleanerName}
                </div>
                {log.checkedBy && (
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <strong>{language === 'vi' ? 'Người duyệt:' : language === 'ja' ? '検査者:' : 'Checked By:'}</strong> {log.checkedBy} <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>({new Date(log.checkedAt!).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })})</span>
                  </div>
                )}
                <div style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span>🕒 {language === 'vi' ? 'Bắt đầu' : language === 'ja' ? '開始' : 'Start'}: {new Date(log.startedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span>⌛ {language === 'vi' ? 'Kết thúc' : language === 'ja' ? '完了' : 'Finish'}: {new Date(log.endedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                {(log.notes || log.checkerNotes || (log.errors && log.errors.length > 0)) && (
                  <div style={{ fontSize: '0.8rem', backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.5rem', borderLeft: '3px solid var(--primary-color)' }}>
                    {log.notes && (
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>🧹 {language === 'vi' ? 'Ghi chú NV:' : language === 'ja' ? '清掃員メモ:' : 'Cleaner Notes:'}</strong> {log.notes}
                      </div>
                    )}
                    {log.checkerNotes && (
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>🔍 {language === 'vi' ? 'Ghi chú kiểm phòng:' : language === 'ja' ? '検査指摘メモ:' : 'Checker Notes:'}</strong> {log.checkerNotes}
                      </div>
                    )}
                    {log.errors && log.errors.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.35rem' }}>
                        {log.errors.map((e, idx) => (
                          <span key={idx} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-maintenance)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '3px' }}>
                            ❌ {translateDefect(e, language)}
                          </span>
                        ))}
                      </div>
                    )}
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

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem 0.5rem 0 0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                {language === 'vi' 
                  ? `Hiển thị ${((currentPage - 1) * itemsPerPage) + 1}-${Math.min(currentPage * itemsPerPage, sortedLogs.length)} trên tổng số ${sortedLogs.length} lịch sử` 
                  : language === 'ja'
                    ? `${sortedLogs.length}件中 ${((currentPage - 1) * itemsPerPage) + 1}-${Math.min(currentPage * itemsPerPage, sortedLogs.length)}件を表示`
                    : `Showing ${((currentPage - 1) * itemsPerPage) + 1}-${Math.min(currentPage * itemsPerPage, sortedLogs.length)} of ${sortedLogs.length} logs`}
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{ minWidth: '40px' }}
                >
                  &laquo;
                </button>
                {getVisiblePages(currentPage, totalPages).map((page, idx) => {
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
                      type="button"
                      className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCurrentPage(page as number)}
                      style={{ minWidth: '32px', fontWeight: currentPage === page ? 'bold' : 'normal' }}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{ minWidth: '40px' }}
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
