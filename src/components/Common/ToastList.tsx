import React from 'react';
import { useApp } from './AppContext';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastList: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(toast => {
        let icon = <Info size={18} />;
        let toastClass = 'toast-info';

        if (toast.type === 'success') {
          icon = <CheckCircle size={18} style={{ color: 'var(--status-clean)' }} />;
          toastClass = 'toast-success';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle size={18} style={{ color: 'var(--status-dirty)' }} />;
          toastClass = 'toast-warning';
        }

        return (
          <div key={toast.id} className={`toast ${toastClass} glass-panel`}>
            <div className="toast-icon-container" style={{ marginTop: '0.15rem' }}>
              {icon}
            </div>
            <div className="toast-message" style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>
              {toast.message}
            </div>
            <button 
              onClick={() => removeToast(toast.id)} 
              aria-label="Close notification"
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                opacity: 0.5,
                display: 'flex',
                alignItems: 'center',
                padding: '0.1rem'
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastList;
