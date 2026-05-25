import { Component } from 'react'; // Component base class needed to create a class-based ErrorBoundary (hooks cannot catch render errors)
import { Routes, Route, Navigate } from 'react-router-dom'; // Routes is the route container, Route maps a URL path to a component, Navigate redirects programmatically in JSX
import FlashCardApp from './components/FlashCardApp'; // the main flashcard management page shown to logged-in regular users
import AdminApp from './components/AdminApp'; // the admin dashboard page shown only to users with the "admin" role
import Login from './components/Login'; // the login page where users enter their credentials
import Register from './components/Register'; // the registration page where new users create an account

// Catches unhandled render errors so the app never shows a blank white page
class ErrorBoundary extends Component { // class component because React error boundaries require lifecycle methods unavailable in function components
  constructor(props) { // initialise the component with its props from the parent
    super(props); // call the parent Component constructor (required)
    this.state = { crashed: false }; // track whether a render error has occurred; false means the app is running normally
  }
  static getDerivedStateFromError() { // React calls this static method when a child component throws during rendering
    return { crashed: true }; // update state to crashed so the fallback UI is shown instead of the broken tree
  }
  render() { // render either the fallback error screen or the normal child tree
    if (this.state.crashed) { // if a render error has been caught
      return ( // show the fallback error UI centred on the screen
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9a9de0', fontFamily: 'Verdana, sans-serif', gap: '12px' }}>
          {/* full-screen centered flex column with the app's purple text colour */}
          <div style={{ fontSize: '32px' }}>⚠️</div> {/* large warning emoji as a visual indicator */}
          <h2 style={{ margin: 0 }}>Something went wrong</h2> {/* brief error heading */}
          <p style={{ color: '#6a6b99', margin: 0 }}>Please refresh the page to continue.</p> {/* instruction for the user */}
        </div>
      );
    }
    return this.props.children; // no error: render the wrapped child components normally
  }
}

function ProtectedRoute({ children }) { // wrapper that redirects unauthenticated users away from pages that require login
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />; // if a JWT exists render the child page; otherwise redirect to /login and replace history so back-button doesn't loop
}

function AdminRoute({ children }) { // wrapper that restricts a page to admin users only
  const token = localStorage.getItem('token'); // read the JWT from storage to check if the user is logged in at all
  const role = localStorage.getItem('role'); // read the stored role to check if the user has admin privileges
  if (!token) return <Navigate to="/login" replace />; // no token means not logged in → redirect to login
  if (role !== 'admin') return <Navigate to="/" replace />; // logged in but not admin → redirect to the regular home page
  return children; // user is logged in and is an admin → render the protected admin page
}

function NotFound() { // rendered when no route matches the current URL
  return ( // show a centred 404 message
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9a9de0', fontFamily: 'Verdana, sans-serif', gap: '12px' }}>
      {/* full-screen centred flex column */}
      <div style={{ fontSize: '48px', opacity: 0.4 }}>404</div> {/* large faded 404 number */}
      <p style={{ color: '#6a6b99', margin: 0 }}>Page not found.</p> {/* brief message telling the user the URL doesn't exist */}
    </div>
  );
}

export default function App() { // root application component that wires all routes together inside the error boundary
  return (
    <ErrorBoundary> {/* wrap everything so any uncaught render error shows the fallback instead of a blank screen */}
      <Routes> {/* Routes scans its children and renders the first Route whose path matches the current URL */}
        <Route path="/login" element={<Login />} /> {/* /login → show the Login page (publicly accessible) */}
        <Route path="/register" element={<Register />} /> {/* /register → show the Register page (publicly accessible) */}
        <Route
          path="/" // root path → the main flashcard app
          element={
            <ProtectedRoute> {/* redirect to /login if the user is not authenticated */}
              <FlashCardApp /> {/* show the flashcard management page for authenticated regular users */}
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin" // /admin → the admin dashboard
          element={
            <AdminRoute> {/* redirect to /login if not authenticated, or to / if not admin */}
              <AdminApp /> {/* show the admin dashboard only for users with role="admin" */}
            </AdminRoute>
          }
        />
        <Route path="*" element={<NotFound />} /> {/* catch-all: any URL that doesn't match the routes above shows the 404 page */}
      </Routes>
    </ErrorBoundary>
  );
}
