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

export const CleaningLogsTab: React.FC<CleaningLogsTabProps> = ({
  language,
  logs,
  activeDate,
  selectedHotelId,
  addToast,
  getTranslation
}) => {
  const dailyLogs = logs.filter(log => log.endedAt.startsWith(activeDate));

  const handleExportCSV = () => {
    const headers = language === 'vi' 
      ? ["Số phòng", "Tầng", "Nhân viên dọn", "Bắt đầu", "Kết thúc", "Thời gian dọn (phút)", "Ghi chú", "Lỗi phát hiện", "Hình ảnh"]
      : language === 'ja'
        ? ["部屋番号", "階", "清掃スタッフ", "開始時間", "完了時間", "清掃時間 (分)", "メモ", "検出された欠陥", "写真"]
        : ["Room Number", "Floor", "Cleaner Name", "Start Time", "End Time", "Duration (mins)", "Notes", "Defects Detected", "Photo"];

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
};
