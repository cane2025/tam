import { useState } from 'react';

interface LoginFormProps {
  onLogin: (token: string) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('Attempting login with:', { email, password: '***' });

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);

      if (data.success && data.data && data.data.token) {
        console.log('Login successful, token:', data.data.token);
        onLogin(data.data.token);
      } else {
        console.log('Login failed:', data.message || data.error);
        setError(data.message || data.error || 'Inloggning misslyckades');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Nätverksfel. Kontrollera att servern körs.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = () => {
    // Använd dev-token för snabb inloggning
    localStorage.setItem('devToken', 'dev-token-for-testing');
    onLogin('dev-token-for-testing');
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f5f7fb',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#111',
          fontSize: '24px',
          fontWeight: '800'
        }}>
          Ungdomsstöd Login
        </h1>

        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#333'
            }}>
              E-post
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#333'
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
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#ccc' : '#007aff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem'
            }}
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          padding: '1rem',
          borderTop: '1px solid #eee',
          marginTop: '1rem'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '14px' }}>
            Utvecklingsläge
          </p>
          <button
            onClick={handleDevLogin}
            style={{
              background: 'transparent',
              color: '#007aff',
              border: '1px solid #007aff',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Logga in med dev-token
          </button>
        </div>
      </div>
    </div>
  );
}
