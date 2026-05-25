import { useState } from 'react'; // useState hook for managing local component state
import { useNavigate, Link } from 'react-router-dom'; // useNavigate for programmatic redirects after login, Link for the "Create account" anchor
import './Login.css'; // import the shared login/register styles
import { API_URL } from '../config'; // base URL of the FastAPI backend used in the fetch call

const Login = () => { // Login is a function component that renders the sign-in form
  const [credentials, setCredentials] = useState({ username: '', password: '' }); // stores the values typed into the email and password inputs
  const [showPassword, setShowPassword] = useState(false); // controls whether the password field shows plain text or bullets
  const [errors, setErrors] = useState({ email: false, password: false }); // tracks which fields have client-side validation errors
  const [serverError, setServerError] = useState(''); // stores an error message returned by the backend (wrong credentials, etc.)
  const [loading, setLoading] = useState(false); // true while the login request is in-flight; disables the submit button to prevent double submission

  const navigate = useNavigate(); // get the navigation function for redirecting after a successful login

  const handleLogin = async (e) => { // called when the form is submitted; validates inputs then calls the /token endpoint
    e.preventDefault(); // stop the browser from reloading the page on form submit

    const emailInvalid = credentials.username === '' || !credentials.username.includes('@'); // email is invalid if empty or missing the @ character
    const passwordInvalid = credentials.password.length < 6; // password is invalid if shorter than 6 characters
    setErrors({ email: emailInvalid, password: passwordInvalid }); // update the error state so validation messages appear under the relevant fields
    if (emailInvalid || passwordInvalid) return; // stop here if any field is invalid; don't send the request

    setServerError(''); // clear any previous server error before the new request
    setLoading(true); // show the "Signing in…" state and disable the button
    try {
      const formData = new FormData(); // create a FormData object because FastAPI's OAuth2PasswordRequestForm expects multipart/form-data
      formData.append('username', credentials.username); // add the email as the "username" field (OAuth2 spec uses "username")
      formData.append('password', credentials.password); // add the password field

      const response = await fetch(`${API_URL}/token`, { method: 'POST', body: formData }); // POST the credentials to the /token endpoint
      const data = await response.json(); // parse the JSON response body

      if (response.ok) { // HTTP 200 means the credentials were correct and a token was issued
        localStorage.setItem('token', data.access_token); // store the JWT so all subsequent API calls can include it
        localStorage.setItem('username', data.username); // store the username for display in the app header
        localStorage.setItem('role', data.role); // store the role so the app can show/hide admin features
        navigate(data.role === 'admin' ? '/admin' : '/'); // redirect admins to the admin dashboard, regular users to the flashcard page
      } else {
        setServerError(data.detail || 'Login failed. Please check your credentials.'); // show the error message returned by the API
      }
    } catch {
      setServerError('Server connection error.'); // network failure or the server is unreachable
    } finally {
      setLoading(false); // re-enable the submit button regardless of success or failure
    }
  };

  return (
    <div className="login-page"> {/* full-page centered container */}
      <div className="site-title">KL <span>Learning App</span></div> {/* app name shown above the card; "Learning App" is styled in purple */}

      <div className="card"> {/* white-ish card panel that holds the login form */}
        <div className="card-top"> {/* top section with the icon, heading, and subtitle */}
          <div className="icon-circle">🔒</div> {/* purple circular icon above the heading */}
          <h1>Welcome Back</h1> {/* main heading of the login card */}
          <p>Sign in to your account</p> {/* subtitle below the heading */}
        </div>

        <hr className="divider" /> {/* horizontal line separating the heading section from the form */}

        <form onSubmit={handleLogin}> {/* form element; onSubmit calls handleLogin which prevents default browser behaviour */}
          <label htmlFor="email">Email Address</label> {/* accessible label linked to the email input by htmlFor */}
          <input
            type="email" // HTML5 email type gives basic browser validation
            id="email" // id matches the label's htmlFor for accessibility
            placeholder="you@example.com" // hint text inside the input
            value={credentials.username} // controlled input bound to the username field in state
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} // update username in state on every keystroke
          />
          {errors.email && <p className="error" style={{ display: 'block' }}>Please enter a valid email address.</p>} {/* show email validation error only when errors.email is true */}

          <label htmlFor="password">Password</label> {/* accessible label for the password field */}
          <div className="password-row"> {/* flex row that holds the password input and the show/hide toggle button side by side */}
            <input
              type={showPassword ? 'text' : 'password'} // toggle between visible text and masked bullets based on showPassword state
              id="password" // id matches the label's htmlFor
              placeholder="Enter your password" // hint text inside the input
              value={credentials.password} // controlled input bound to the password field in state
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} // update password in state on every keystroke
            />
            <button type="button" className="show-hide-btn" onClick={() => setShowPassword(!showPassword)}> {/* type="button" prevents accidental form submission when clicked */}
              {showPassword ? 'Hide' : 'Show'} {/* toggle the button label to match the current visibility state */}
            </button>
          </div>
          {errors.password && <p className="error" style={{ display: 'block' }}>Password must be at least 6 characters.</p>} {/* show password validation error only when errors.password is true */}

          {serverError && <p className="error" style={{ display: 'block' }}>{serverError}</p>} {/* show the server error message if one exists */}
          <button type="submit" className="submit-btn" disabled={loading}> {/* submit button; disabled while the request is in-flight to prevent double submission */}
            {loading ? 'Signing in…' : 'Sign In'} {/* show a loading label while waiting for the API response */}
          </button>
        </form>

        <div className="bottom-text"> {/* footer section below the form */}
          <p>Don't have an account? <Link to="/register">Create one</Link></p> {/* link to the registration page for new users */}
        </div>
      </div>
    </div>
  );
};

export default Login; // export the component so it can be imported in App.jsx
