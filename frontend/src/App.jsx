import { Routes, Route, Navigate } from 'react-router-dom';
import FlashCardApp from './components/FlashCardApp';
import Login from './components/Login';

// Redirects to /login if no token is stored
function ProtectedRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <FlashCardApp />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
