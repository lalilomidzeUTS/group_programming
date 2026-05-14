import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

    // Client-side validation matching the HTML version
    const emailInvalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.username.trim());
    const passwordInvalid = credentials.password.length < 8;
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
    <>
      <div className="bg-blobs">
        <div className="blob blob1"></div>
        <div className="blob blob2"></div>
        <div className="blob blob3"></div>
      </div>

      <div className="wrapper">
        <div className="card">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" fill="rgba(255,255,255,0.92)" />
              </svg>
            </div>
            <span className="logo-text">KL Learnin App</span>
          </div>

          <div className="heading">Welcome back</div>
          <div className="subheading">Sign in to continue to your workspace</div>

          <form onSubmit={handleLogin} noValidate>
            <div className={`field ${errors.email ? 'has-error' : ''}`}>
              <label htmlFor="email">Email address</label>
              <div className="input-wrap">
                <input
                  type="email"
                  id="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                />
                <span className="input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
              </div>
              <div className="error-msg">Please enter a valid email address.</div>
            </div>

            <div className={`field ${errors.password ? 'has-error' : ''}`}>
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />
                <span className="input-icon" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </span>
              </div>
              <div className="error-msg">Password must be at least 8 characters.</div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="signup">
            Don't have an account? <a href="#signup">Create one</a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
