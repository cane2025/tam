import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import App from './App';
export default function AppWithAPI() {
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        // Kontrollera om vi redan har en token
        const savedToken = localStorage.getItem('authToken') || localStorage.getItem('devToken');
        if (savedToken) {
            setToken(savedToken);
        }
        setLoading(false);
    }, []);
    const handleLogin = (newToken) => {
        console.log('Setting token:', newToken);
        localStorage.setItem('authToken', newToken);
        setToken(newToken);
    };
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('devToken');
        setToken(null);
    };
    if (loading) {
        return (_jsx("div", { style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#f5f7fb'
            }, children: _jsx("div", { style: { fontSize: '18px', color: '#666' }, children: "Laddar..." }) }));
    }
    if (!token) {
        return _jsx(LoginForm, { onLogin: handleLogin });
    }
    return (_jsxs("div", { children: [_jsx(App, {}), _jsx("div", { style: {
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    zIndex: 1000
                }, children: _jsx("button", { onClick: handleLogout, style: {
                        background: '#ff3b30',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }, children: "Logga ut" }) })] }));
}
