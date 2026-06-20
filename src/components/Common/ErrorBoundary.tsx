import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - Catches render errors in child components and displays
 * a friendly fallback UI with a reload option. Supports dark mode via
 * the existing glass-panel CSS class.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="auth-layout"
          style={{
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '2rem',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '2.5rem',
              maxWidth: '480px',
              width: '100%',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '1.5rem', lineHeight: 1.6 }}>
              An unexpected error occurred. Please reload the page to try again.
            </p>
            {this.state.error && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  opacity: 0.5,
                  textAlign: 'left',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  overflow: 'auto',
                  maxHeight: '120px',
                  marginBottom: '1.5rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="btn btn-primary"
              style={{
                padding: '0.6rem 2rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              🔄 Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
