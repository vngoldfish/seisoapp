import React, { useState } from 'react';
import { useApp } from './AppContext';
import { getTranslation } from '../../i18n/translations';
import { Hotel, User as UserIcon, KeyRound, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, language, setLanguage, addToast } = useApp();
  
  // Credentials for password login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);


  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      addToast(getTranslation(language, 'invalidLogin'), 'warning');
      return;
    }

    setLoading(true);
    const result = await login({ username, password });
    setLoading(false);

    if (!result.success) {
      if (result.errorType === 'credentials') {
        addToast(getTranslation(language, 'invalidLogin'), 'warning');
      }
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card glass-panel" style={{ minHeight: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '48px', 
            height: '48px', 
            borderRadius: 'var(--radius-md)', 
            backgroundColor: 'rgba(37, 99, 235, 0.1)', 
            color: 'var(--primary-color)',
            marginBottom: '0.5rem'
          }}>
            <Hotel size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: '1.2' }}>
            {getTranslation(language, 'loginTitle')}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {getTranslation(language, 'loginSubtitle')}
          </p>
        </div>

        {/* Language selector on login screen */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button 
            className={`lang-btn ${language === 'ja' ? 'active' : ''}`} 
            onClick={() => setLanguage('ja')}
          >
            日本語
          </button>
          <button 
            className={`lang-btn ${language === 'vi' ? 'active' : ''}`} 
            onClick={() => setLanguage('vi')}
          >
            Tiếng Việt
          </button>
          <button 
            className={`lang-btn ${language === 'en' ? 'active' : ''}`} 
            onClick={() => setLanguage('en')}
          >
            English
          </button>
        </div>

        {/* Form area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                {language === 'vi' 
                  ? 'Tên đăng nhập / Mã NV' 
                  : language === 'ja' 
                    ? 'ユーザー名 / スタッフID' 
                    : 'Username / Employee ID'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={language === 'vi' ? 'Ví dụ: admin, front1, cleaner1...' : language === 'ja' ? '例: admin, front1, cleaner1...' : 'e.g. admin, front1, cleaner1'}
                  disabled={loading}
                  required
                />
                <UserIcon size={14} style={{ position: 'absolute', left: '10px', top: '10px', opacity: 0.4 }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>{getTranslation(language, 'password')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
                <KeyRound size={14} style={{ position: 'absolute', left: '10px', top: '10px', opacity: 0.4 }} />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-full"
              style={{ marginTop: '0.5rem', padding: '0.5rem 1rem' }}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : getTranslation(language, 'loginBtn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
