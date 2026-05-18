import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const LOGIN_URL = 'http://127.0.0.1:8000/token';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: false, password: false });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    const emailInvalid = credentials.username === '' || !credentials.username.includes('@');
    const passwordInvalid = credentials.password.length < 6;
    setErrors({ email: emailInvalid, password: passwordInvalid });
    if (emailInvalid || passwordInvalid) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);

      const response = await fetch(LOGIN_URL, { method: 'POST', body: formData });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('role', data.role);
        navigate(data.role === 'admin' ? '/admin' : '/');
      } else {
        alert(data.detail || 'Login failed. Please check your credentials.');
      }
    } catch {
      alert('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="site-title">KL <span>Learning App</span></div>

      <div className="card">
        <div className="card-top">
          <div className="icon-circle">🔒</div>
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>

        <hr className="divider" />

        <form onSubmit={handleLogin}>
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            placeholder="you@example.com"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
          />
          {errors.email && <p className="error" style={{ display: 'block' }}>Please enter a valid email address.</p>}

          <label htmlFor="password">Password</label>
          <div className="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              placeholder="Enter your password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            />
            <button type="button" className="show-hide-btn" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && <p className="error" style={{ display: 'block' }}>Password must be at least 6 characters.</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="bottom-text">
          <p>Don't have an account? <Link to="/register">Create one</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
