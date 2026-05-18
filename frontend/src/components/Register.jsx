import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const REGISTER_URL = 'http://127.0.0.1:8000/register';

const Register = () => {
  const [form, setForm] = useState({ fullname: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({ name: false, email: false, password: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nameInvalid = form.fullname.trim() === '';
    const emailInvalid = form.email === '' || !form.email.includes('@');
    const passwordInvalid = form.password.length < 6;
    const confirmInvalid = form.password !== form.confirmPassword;

    setErrors({ name: nameInvalid, email: emailInvalid, password: passwordInvalid, confirm: confirmInvalid });
    if (nameInvalid || emailInvalid || passwordInvalid || confirmInvalid) return;

    setLoading(true);
    try {
      const response = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullname: form.fullname, username: form.email, password: form.password }),
      });
      const data = await response.json();

      if (response.ok) {
        navigate('/login');
      } else {
        alert(data.detail || 'Registration failed.');
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
          <div className="icon-circle">👤</div>
          <h1>Create Account</h1>
          <p>Fill in the details to get started</p>
        </div>

        <hr className="divider" />

        <form onSubmit={handleSubmit}>
          <label htmlFor="fullname">Full Name</label>
          <input
            type="text"
            id="fullname"
            placeholder="Enter your full name"
            value={form.fullname}
            onChange={(e) => setForm({ ...form, fullname: e.target.value })}
          />
          {errors.name && <p className="error" style={{ display: 'block' }}>Please enter your full name.</p>}

          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {errors.email && <p className="error" style={{ display: 'block' }}>Please enter a valid email address.</p>}

          <label htmlFor="password">Password</label>
          <div className="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              placeholder="Create a password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="button" className="show-hide-btn" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && <p className="error" style={{ display: 'block' }}>Password must be at least 6 characters.</p>}

          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="password-row">
            <input
              type={showConfirm ? 'text' : 'password'}
              id="confirmPassword"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
            <button type="button" className="show-hide-btn" onClick={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.confirm && <p className="error" style={{ display: 'block' }}>Passwords do not match.</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="bottom-text">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;
