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

  const handleLogin = (e: React.FormEvent) => {
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
    } else {
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
    return (
      <div>
        <App />
        {/* NEW: Professional login status card */}
        <div data-print-keep style={{
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
        }}>
          <span style={{ 
            fontSize: '14px', 
            color: '#666',
            flex: 1
          }}>
            Inloggad som: {JSON.parse(localStorage.getItem('simpleAuth_user') || '{}').username}
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: '#ff3b30',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e6342a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ff3b30';
            }}
          >
            Logga ut
          </button>
        </div>
      </div>
    );
  }

  // Visa inloggningssida
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '800',
            color: '#333',
            margin: '0 0 0.5rem 0'
          }}>
            Ungdomsstöd
          </h1>
          <p style={{
            color: '#666',
            margin: '0',
            fontSize: '16px'
          }}>
            Logga in för att komma åt dashboard
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#333',
              fontSize: '14px'
            }}>
              Användarnamn
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007aff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#333',
              fontSize: '14px'
            }}>
              Lösenord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007aff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          <button
            type="submit"
            style={{
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
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 122, 255, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Logga in
          </button>
        </form>

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#666'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>Test-användare:</p>
          <p style={{ margin: '0 0 0.25rem 0' }}>• admin / admin123</p>
          <p style={{ margin: '0 0 0.25rem 0' }}>• staff / staff123</p>
          <p style={{ margin: '0 0 0.25rem 0' }}>• user / user123</p>
          <p style={{ margin: '0' }}>• test / test123</p>
        </div>
      </div>
    </div>
  );
}

