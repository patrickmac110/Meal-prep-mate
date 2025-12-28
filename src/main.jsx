import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Error Boundary to catch React render errors
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('React Error Boundary caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Hide loading screen and show error
            const loader = document.getElementById('loading-screen');
            if (loader) loader.style.display = 'none';

            return (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '24px',
                    fontFamily: 'system-ui, sans-serif',
                    background: '#fff'
                }}>
                    <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                        <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>😕 Something went wrong</h2>
                        <p style={{ color: '#64748b', marginBottom: '16px' }}>
                            The app encountered an error.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '24px' }}>
                            {this.state.error?.message || 'Unknown error'}
                        </p>
                        <button
                            onClick={() => {
                                // Clear localStorage and reload
                                if (confirm('This will clear all app data. Continue?')) {
                                    localStorage.clear();
                                    location.reload();
                                }
                            }}
                            style={{
                                background: '#ef4444',
                                color: 'white',
                                padding: '12px 24px',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                marginRight: '8px'
                            }}
                        >
                            Reset App
                        </button>
                        <button
                            onClick={() => location.reload()}
                            style={{
                                background: '#10b981',
                                color: 'white',
                                padding: '12px 24px',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hide loading screen function
const hideLoading = () => {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.3s';
        setTimeout(() => { loader.style.display = 'none'; }, 300);
    }
};

// Global error handler for uncaught errors
window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global error:', message, source, lineno, colno, error);
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.innerHTML = `<div style="text-align:center;padding:24px;font-family:system-ui,sans-serif;">
            <h2 style="color:#ef4444;margin-bottom:12px;">⚠️ JavaScript Error</h2>
            <p style="color:#64748b;margin-bottom:16px;">Something went wrong loading the app.</p>
            <p style="color:#94a3b8;font-size:11px;margin-bottom:16px;">${message}</p>
            <button onclick="location.reload()" style="background:#10b981;color:white;padding:12px 24px;border:none;border-radius:12px;font-weight:bold;cursor:pointer;">Reload</button>
        </div>`;
    }
};

// Mount the app with error boundary
try {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </React.StrictMode>
    );

    // Hide loading after app renders (give it more time)
    setTimeout(hideLoading, 500);
} catch (error) {
    console.error('Failed to mount app:', error);
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.innerHTML = `<div style="text-align:center;padding:24px;font-family:system-ui,sans-serif;">
            <h2 style="color:#ef4444;margin-bottom:12px;">😕 Mount Failed</h2>
            <p style="color:#64748b;">${error.message}</p>
            <button onclick="location.reload()" style="margin-top:16px;background:#10b981;color:white;padding:12px 24px;border:none;border-radius:12px;font-weight:bold;cursor:pointer;">Reload</button>
        </div>`;
    }
}

// DON'T register service worker for now - it's causing caching issues
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         navigator.serviceWorker.register('/Meal-prep-mate/sw.js', { scope: '/Meal-prep-mate/' })
//             .then(reg => console.log('SW registered:', reg.scope))
//             .catch(err => console.log('SW registration failed:', err));
//     });
// }
