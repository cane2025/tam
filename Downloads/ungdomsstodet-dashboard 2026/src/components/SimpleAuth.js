import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import App from '../App';
export default function SimpleAuth() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    // Kontrollera om användaren redan är inloggad
    useEffect(() => {
        const savedUser = localStorage.getItem('simpleAuth_user');
        if (savedUser) {
            setIsLoggedIn(true);
        }
    }, []);
    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        // Dummy-autentisering - enkla användarnamn/lösenord
        const validUsers = [
            { username: 'admin', password: 'admin123' },
            { username: 'staff', password: 'staff123' },
            { username: 'user', password: 'user123' },
            { username: 'test', password: 'test123' }
        ];
        const user = validUsers.find(u => u.username === username && u.password === password);
        if (user) {
            // Spara användaren i localStorage
            localStorage.setItem('simpleAuth_user', JSON.stringify({
                username: user.username,
                loginTime: new Date().toISOString()
            }));
            setIsLoggedIn(true);
        }
        else {
            setError('Fel användarnamn eller lösenord');
        }
    };
    const handleLogout = () => {
        localStorage.removeItem('simpleAuth_user');
        setIsLoggedIn(false);
        setUsername('');
        setPassword('');
    };
    // Visa dashboard om inloggad
    if (isLoggedIn) {
        return (_jsxs("div", { children: [_jsx(App, {}), _jsxs("div", { "data-print-keep": true, style: {
                        position: 'fixed',
                        top: '16px',
                        right: '16px',
                        zIndex: 10001,
                        background: '#ffffff',
                        border: '2px solid #ff0000', // DEBUG: Röd border för att se elementet
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        minWidth: '280px'
                    }, children: [_jsxs("span", { style: {
                                fontSize: '14px',
                                color: '#666',
                                flex: 1
                            }, children: ["Inloggad som: ", JSON.parse(localStorage.getItem('simpleAuth_user') || '{}').username] }), _jsx("button", { onClick: handleLogout, style: {
                                background: '#ff3b30',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease'
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.background = '#e6342a';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.background = '#ff3b30';
                            }, children: "Logga ut" })] })] }));
    }
    // Visa inloggningssida
    return (_jsx("div", { style: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }, children: _jsxs("div", { style: {
                background: 'white',
                padding: '2rem',
                borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                width: '100%',
                maxWidth: '400px'
            }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '2rem' }, children: [_jsx("h1", { style: {
                                fontSize: '28px',
                                fontWeight: '800',
                                color: '#333',
                                margin: '0 0 0.5rem 0'
                            }, children: "Ungdomsst\u00F6d" }), _jsx("p", { style: {
                                color: '#666',
                                margin: '0',
                                fontSize: '16px'
                            }, children: "Logga in f\u00F6r att komma \u00E5t dashboard" })] }), error && (_jsx("div", { style: {
                        background: '#fee',
                        color: '#c33',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        fontSize: '14px',
                        textAlign: 'center'
                    }, children: error })), _jsxs("form", { onSubmit: handleLogin, children: [_jsxs("div", { style: { marginBottom: '1rem' }, children: [_jsx("label", { style: {
                                        display: 'block',
                                        marginBottom: '0.5rem',
                                        fontWeight: '600',
                                        color: '#333',
                                        fontSize: '14px'
                                    }, children: "Anv\u00E4ndarnamn" }), _jsx("input", { type: "text", value: username, onChange: (e) => setUsername(e.target.value), required: true, style: {
                                        width: '100%',
                                        padding: '12px',
                                        border: '2px solid #e1e5e9',
                                        borderRadius: '8px',
                                        fontSize: '16px',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.2s'
                                    }, onFocus: (e) => e.target.style.borderColor = '#007aff', onBlur: (e) => e.target.style.borderColor = '#e1e5e9' })] }), _jsxs("div", { style: { marginBottom: '1.5rem' }, children: [_jsx("label", { style: {
                                        display: 'block',
                                        marginBottom: '0.5rem',
                                        fontWeight: '600',
                                        color: '#333',
                                        fontSize: '14px'
                                    }, children: "L\u00F6senord" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, style: {
                                        width: '100%',
                                        padding: '12px',
                                        border: '2px solid #e1e5e9',
                                        borderRadius: '8px',
                                        fontSize: '16px',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.2s'
                                    }, onFocus: (e) => e.target.style.borderColor = '#007aff', onBlur: (e) => e.target.style.borderColor = '#e1e5e9' })] }), _jsx("button", { type: "submit", style: {
                                width: '100%',
                                padding: '14px',
                                background: 'linear-gradient(135deg, #007aff 0%, #0051d5 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s'
                            }, onMouseOver: (e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 122, 255, 0.3)';
                            }, onMouseOut: (e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }, children: "Logga in" })] }), _jsxs("div", { style: {
                        marginTop: '2rem',
                        padding: '1rem',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#666'
                    }, children: [_jsx("p", { style: { margin: '0 0 0.5rem 0', fontWeight: '600' }, children: "Test-anv\u00E4ndare:" }), _jsx("p", { style: { margin: '0 0 0.25rem 0' }, children: "\u2022 admin / admin123" }), _jsx("p", { style: { margin: '0 0 0.25rem 0' }, children: "\u2022 staff / staff123" }), _jsx("p", { style: { margin: '0 0 0.25rem 0' }, children: "\u2022 user / user123" }), _jsx("p", { style: { margin: '0' }, children: "\u2022 test / test123" })] })] }) }));
}
