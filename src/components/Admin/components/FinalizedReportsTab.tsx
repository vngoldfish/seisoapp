import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, User, TrendingUp, ChevronDown, ChevronUp, Trash2, Search } from 'lucide-react';
import { db } from '../../../db/firebaseDB';
import type { FinalizedDayReport } from '../../../db/dbInterface';

interface FinalizedReportsTabProps {
  language: 'vi' | 'ja' | 'en';
  selectedHotelId: string;
  addToast: (msg: string, type: 'success' | 'warning' | 'info') => void;
}

const localT = {
  vi: {
    historyTitle: 'Lịch sử chốt ngày',
    date: 'Ngày',
    hotelName: 'Khách sạn',
    totalRooms: 'Tổng số phòng',
    totalCleaned: 'Đã hoàn tất dọn',
    finalizedBy: 'Người chốt',
    finalizedAt: 'Thời gian chốt',
    actions: 'Thao tác',
    viewDetails: 'Xem chi tiết',
    hideDetails: 'Ẩn chi tiết',
    cleanerName: 'Nhân viên dọn phòng',
    roomsCleanedCount: 'Số phòng đã dọn',
    noReports: 'Chưa có ngày nào được chốt.',
    summaryTotalDays: 'Tổng số ngày chốt',
    summaryAvgCleaned: 'Trung bình phòng dọn/ngày',
    summaryTopCleaner: 'Nhân viên dọn nhiều nhất',
    searchPlaceholder: 'Tìm kiếm theo ngày...',
    deleteReport: 'Xóa lịch sử chốt',
    confirmDeleteReport: 'Bạn có chắc chắn muốn xóa lịch sử chốt ngày này? (Hành động này không mở khóa dữ liệu phòng của ngày đó)',
    cleanerDetails: 'Chi tiết năng suất nhân viên',
    cleanerHeader: 'Năng suất nhân viên dọn phòng',
  },
  ja: {
    historyTitle: '業務締め切り履歴',
    date: '日付',
    hotelName: 'ホテル名',
    totalRooms: '総客室数',
    totalCleaned: '清掃完了数',
    finalizedBy: '締め切り担当者',
    finalizedAt: '締め切り日時',
    actions: '操作',
    viewDetails: '詳細表示',
    hideDetails: '詳細非表示',
    cleanerName: '清掃員名',
    roomsCleanedCount: '清掃客室数',
    noReports: '締め切られた日付はありません。',
    summaryTotalDays: '総締め切り日数',
    summaryAvgCleaned: '1日平均清掃数',
    summaryTopCleaner: '最多清掃員',
    searchPlaceholder: '日付で検索...',
    deleteReport: '締め切り履歴の削除',
    confirmDeleteReport: 'この締め切り履歴を削除してもよろしいですか？（該当日の客室ロックは解除されません）',
    cleanerDetails: '清掃員生産性詳細',
    cleanerHeader: '清掃員別清掃実績',
  },
  en: {
    historyTitle: 'Day Closing History',
    date: 'Date',
    hotelName: 'Hotel',
    totalRooms: 'Total Rooms',
    totalCleaned: 'Total Cleaned',
    finalizedBy: 'Locked By',
    finalizedAt: 'Time Locked',
    actions: 'Actions',
    viewDetails: 'View Details',
    hideDetails: 'Hide Details',
    cleanerName: 'Cleaner Name',
    roomsCleanedCount: 'Rooms Cleaned',
    noReports: 'No days have been finalized yet.',
    summaryTotalDays: 'Total Finalized Days',
    summaryAvgCleaned: 'Avg Cleaned/Day',
    summaryTopCleaner: 'Top Cleaner',
    searchPlaceholder: 'Search by date...',
    deleteReport: 'Delete History',
    confirmDeleteReport: 'Are you sure you want to delete this finalized day history? (This will NOT unlock the day)',
    cleanerDetails: 'Cleaner productivity details',
    cleanerHeader: 'Cleaner Productivity Report',
  }
};

export const FinalizedReportsTab: React.FC<FinalizedReportsTabProps> = ({
  language,
  selectedHotelId,
  addToast
}) => {
  const [reports, setReports] = useState<FinalizedDayReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const t = localT[language] || localT.en;

  const fetchReports = async () => {
    setLoading(true);
    try {
      const list = await db.getFinalizedDayReports();
      // Sort reports by date descending
      const sorted = list.sort((a, b) => b.date.localeCompare(a.date));
      setReports(sorted);
    } catch (e) {
      console.error(e);
      addToast('Failed to load finalized day reports', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedHotelId]);

  const handleDelete = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t.confirmDeleteReport)) {
      try {
        await db.deleteFinalizedDayReport(reportId);
        addToast(language === 'vi' ? 'Đã xóa lịch sử chốt thành công' : 'Successfully deleted closing history', 'success');
        fetchReports();
      } catch (e) {
        console.error(e);
        addToast('Failed to delete report', 'warning');
      }
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => r.date.includes(searchTerm));
  }, [reports, searchTerm]);

  // Compute Summary Statistics
  const summary = useMemo(() => {
    const totalDays = filteredReports.length;
    if (totalDays === 0) {
      return { totalDays, avgCleaned: 0, topCleaner: '-' };
    }

    const totalCleanedSum = filteredReports.reduce((sum, r) => sum + r.totalCleaned, 0);
    const avgCleaned = Math.round(totalCleanedSum / totalDays * 10) / 10;

    // Top cleaner calculation across all filtered reports
    const cleanerTotals: Record<string, { name: string; count: number }> = {};
    filteredReports.forEach(r => {
      r.staffReport.forEach(staff => {
        if (!cleanerTotals[staff.cleanerId]) {
          cleanerTotals[staff.cleanerId] = { name: staff.cleanerName, count: 0 };
        }
        cleanerTotals[staff.cleanerId].count += staff.roomsCleanedCount;
      });
    });

    let topCleanerName = '-';
    let topCount = 0;
    Object.values(cleanerTotals).forEach(c => {
      if (c.count > topCount) {
        topCount = c.count;
        topCleanerName = `${c.name} (${c.count} rooms)`;
      }
    });

    return {
      totalDays,
      avgCleaned,
      topCleaner: topCleanerName
    };
  }, [filteredReports]);

  return (
    <div className="tab-pane-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-color)' }}>
          {t.historyTitle}
        </h2>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        width: '150%'
      }}>
        <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '12px' }}>
          <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '0.75rem', borderRadius: '8px' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.summaryTotalDays}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-color)' }}>{summary.totalDays}</div>
          </div>
        </div>

        <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '12px' }}>
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-clean)', padding: '0.75rem', borderRadius: '8px' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.summaryAvgCleaned}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-color)' }}>{summary.avgCleaned}</div>
          </div>
        </div>

        <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '12px' }}>
          <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.75rem', borderRadius: '8px' }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.summaryTopCleaner}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-color)', marginTop: '0.25rem' }}>{summary.topCleaner}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar glass-panel" style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', borderRadius: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 1rem 0.5rem 2.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'rgba(0,0,0,0.02)',
              color: 'var(--text-color)',
              fontSize: '0.875rem'
            }}
          />
        </div>
      </div>

      {/* Reports Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--primary-color)', width: '30px', height: '30px', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <span>Loading reports...</span>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderRadius: '12px', color: 'var(--text-muted)' }}>
          {t.noReports}
        </div>
      ) : (
        <div className="table-responsive glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem' }}>{t.date}</th>
                <th style={{ padding: '1rem' }}>{t.hotelName}</th>
                <th style={{ padding: '1rem' }}>{t.totalRooms}</th>
                <th style={{ padding: '1rem' }}>{t.totalCleaned}</th>
                <th style={{ padding: '1rem' }}>{t.finalizedBy}</th>
                <th style={{ padding: '1rem' }}>{t.finalizedAt}</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => {
                const isExpanded = expandedReportId === report.id;
                return (
                  <React.Fragment key={report.id}>
                    <tr 
                      onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      className="hover-row"
                    >
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{report.date}</td>
                      <td style={{ padding: '1rem' }}>{report.hotelName}</td>
                      <td style={{ padding: '1rem' }}>{report.totalRooms}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                          color: 'var(--status-clean)', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          fontWeight: 600
                        }}>
                          {report.totalCleaned} / {report.totalRooms}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>{report.finalizedBy}</td>
                      <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(report.finalizedAt).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US')}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.35rem 0.75rem',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              color: 'var(--text-color)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? t.hideDetails : t.viewDetails}
                          </button>
                          <button
                            onClick={(e) => handleDelete(report.id, e)}
                            title={t.deleteReport}
                            style={{
                              padding: '0.35rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              backgroundColor: 'rgba(239, 68, 68, 0.05)',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.01)' }}>
                        <td colSpan={7} style={{ padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-color)' }}>
                              📋 {t.cleanerHeader}
                            </h4>
                            {report.staffReport.length === 0 ? (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {language === 'vi' ? 'Không có dữ liệu dọn phòng của nhân viên.' : 'No housekeeper cleaning data recorded for this day.'}
                              </div>
                            ) : (
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                                gap: '0.75rem',
                                marginTop: '0.25rem'
                              }}>
                                {report.staffReport.map((staff, idx) => (
                                  <div 
                                    key={idx} 
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center', 
                                      padding: '0.75rem 1rem', 
                                      borderRadius: '8px', 
                                      backgroundColor: 'var(--background-color)', 
                                      border: '1px solid var(--border-color)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{staff.cleanerName}</span>
                                    </div>
                                    <span style={{ 
                                      fontSize: '0.85rem', 
                                      fontWeight: 700, 
                                      color: 'var(--primary-color)',
                                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                      padding: '0.25rem 0.6rem',
                                      borderRadius: '6px'
                                    }}>
                                      {staff.roomsCleanedCount} {language === 'vi' ? 'phòng' : language === 'ja' ? '室' : 'rooms'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* CSS injection for spinning animation & hover */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .hover-row:hover {
          background-color: rgba(0,0,0,0.02) !important;
        }
      `}</style>
    </div>
  );
};
