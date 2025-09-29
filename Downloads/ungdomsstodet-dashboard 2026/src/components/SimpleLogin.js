import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export default function SimpleLogin() {
    const [email, setEmail] = useState('admin@ungdomsstod.se');
    const [password, setPassword] = useState('admin123');
    const [result, setResult] = useState('');
    const testLogin = async () => {
        console.log('Testing login...');
        setResult('Testing...');
        try {
            const response = await fetch('http://localhost:3001/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            console.log('Response:', response);
            const data = await response.json();
            console.log('Data:', data);
            if (data.success) {
                setResult(`✅ Success! Token: ${data.data.token.substring(0, 20)}...`);
            }
            else {
                setResult(`❌ Failed: ${data.message}`);
            }
        }
        catch (error) {
            console.error('Error:', error);
            setResult(`❌ Error: ${error}`);
        }
    };
    return (_jsxs("div", { style: { padding: '20px', fontFamily: 'monospace' }, children: [_jsx("h1", { children: "Simple Login Test" }), _jsxs("div", { style: { marginBottom: '10px' }, children: [_jsx("label", { children: "Email: " }), _jsx("input", { type: "text", value: email, onChange: (e) => setEmail(e.target.value), style: { width: '300px', padding: '5px' } })] }), _jsxs("div", { style: { marginBottom: '10px' }, children: [_jsx("label", { children: "Password: " }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), style: { width: '300px', padding: '5px' } })] }), _jsx("button", { onClick: testLogin, style: { padding: '10px 20px', marginBottom: '20px' }, children: "Test Login" }), _jsx("div", { style: {
                    background: '#f0f0f0',
                    padding: '10px',
                    border: '1px solid #ccc',
                    whiteSpace: 'pre-wrap'
                }, children: result }), _jsxs("div", { style: { marginTop: '20px', fontSize: '12px' }, children: [_jsx("p", { children: "Test credentials:" }), _jsx("p", { children: "\u2022 admin@ungdomsstod.se / admin123" }), _jsx("p", { children: "\u2022 anna@ungdomsstod.se / staff123" }), _jsx("p", { children: "\u2022 johan@ungdomsstod.se / staff123" })] })] }));
}
