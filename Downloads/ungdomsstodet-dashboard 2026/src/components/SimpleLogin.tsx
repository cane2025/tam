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
      } else {
        setResult(`❌ Failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      setResult(`❌ Error: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Simple Login Test</h1>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Email: </label>
        <input 
          type="text" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '300px', padding: '5px' }}
        />
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Password: </label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '300px', padding: '5px' }}
        />
      </div>
      
      <button onClick={testLogin} style={{ padding: '10px 20px', marginBottom: '20px' }}>
        Test Login
      </button>
      
      <div style={{ 
        background: '#f0f0f0', 
        padding: '10px', 
        border: '1px solid #ccc',
        whiteSpace: 'pre-wrap'
      }}>
        {result}
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '12px' }}>
        <p>Test credentials:</p>
        <p>• admin@ungdomsstod.se / admin123</p>
        <p>• anna@ungdomsstod.se / staff123</p>
        <p>• johan@ungdomsstod.se / staff123</p>
      </div>
    </div>
  );
}

