import { Component } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import FlashCardApp from './components/FlashCardApp';
import AdminApp from './components/AdminApp';
import Login from './components/Login';
import Register from './components/Register';

// Catches unhandled render errors so the app never shows a blank white page
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9a9de0', fontFamily: 'Verdana, sans-serif', gap: '12px' }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#6a6b99', margin: 0 }}>Please refresh the page to continue.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9a9de0', fontFamily: 'Verdana, sans-serif', gap: '12px' }}>
      <div style={{ fontSize: '48px', opacity: 0.4 }}>404</div>
      <p style={{ color: '#6a6b99', margin: 0 }}>Page not found.</p>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <FlashCardApp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminApp />
            </AdminRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}
