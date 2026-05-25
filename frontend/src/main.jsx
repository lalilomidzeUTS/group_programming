import { StrictMode } from 'react' // StrictMode activates additional runtime warnings and double-invokes renders in development to expose side-effect bugs
import { createRoot } from 'react-dom/client' // createRoot is the React 18 API for attaching the React tree to a real DOM node
import { BrowserRouter } from 'react-router-dom' // BrowserRouter provides HTML5 history-based routing context so any component in the tree can use navigation hooks
import './index.css' // import the global CSS reset and base body styles that apply to the entire app
import App from './App.jsx' // the root component that defines all page routes and wraps them with shared providers

createRoot(document.getElementById('root')).render( // find the <div id="root"> in index.html, create a React root on it, and start rendering
  <StrictMode> {/* wrap the whole app in strict mode to surface deprecated API usage and accidental side-effects during development */}
    <BrowserRouter> {/* provide the routing context so <Routes>, <Link>, useNavigate, and useLocation all work throughout the app */}
      <App /> {/* render the top-level App component which contains all route definitions */}
    </BrowserRouter>
  </StrictMode>,
)
