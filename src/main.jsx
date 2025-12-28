import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Hide loading screen on successful mount
const hideLoading = () => {
    const loader = document.getElementById('loading-screen');
    if (loader) loader.style.display = 'none';
};

try {
    ReactDOM.createRoot(document.getElementById('root')).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
    // Hide loading after a short delay to ensure app is ready
    setTimeout(hideLoading, 100);
} catch (error) {
    console.error('Failed to mount app:', error);
    // Show error message to user
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.innerHTML = '<div style="text-align:center;padding:24px;"><h2 style="color:#ef4444;margin-bottom:12px;">😕 Something went wrong</h2><p style="color:#64748b;">Please try refreshing the page.<br/>If the problem persists, clear your browser cache.</p></div>';
    }
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/Meal-prep-mate/sw.js', { scope: '/Meal-prep-mate/' })
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}
