import { useState } from 'react'; // useState hook for managing all local form state
import { useNavigate, Link } from 'react-router-dom'; // useNavigate for redirecting to login after registration, Link for the "Sign in" anchor
import './Login.css'; // reuse the shared login/register stylesheet
import { API_URL } from '../config'; // base URL of the FastAPI backend used in the fetch call

const Register = () => { // Register is a function component that renders the account creation form
  const [form, setForm] = useState({ fullname: '', email: '', password: '', confirmPassword: '' }); // stores all four field values in a single state object
  const [showPassword, setShowPassword] = useState(false); // controls visibility of the password field (plain text vs bullets)
  const [showConfirm, setShowConfirm] = useState(false); // controls visibility of the confirm-password field
  const [errors, setErrors] = useState({ name: false, email: false, password: false, confirm: false }); // tracks which fields have client-side validation errors
  const [serverError, setServerError] = useState(''); // stores error messages returned by the backend (e.g. email already taken)
  const [loading, setLoading] = useState(false); // true while the registration request is in-flight; disables the submit button

  const navigate = useNavigate(); // get the navigation function for redirecting to /login after successful registration

  const handleSubmit = async (e) => { // called when the form is submitted; validates all fields then calls /register
    e.preventDefault(); // prevent the browser from performing a full-page form submission

    const nameInvalid = form.fullname.trim() === ''; // full name is invalid if it is empty or only whitespace
    const emailInvalid = form.email === '' || !form.email.includes('@'); // email is invalid if empty or missing the @ character
    const passwordInvalid = form.password.length < 6; // password is invalid if fewer than 6 characters
    const confirmInvalid = form.password !== form.confirmPassword; // confirm field is invalid if it doesn't match the password

    setErrors({ name: nameInvalid, email: emailInvalid, password: passwordInvalid, confirm: confirmInvalid }); // update all error states at once so the correct messages appear
    if (nameInvalid || emailInvalid || passwordInvalid || confirmInvalid) return; // stop here if any field is invalid; don't send the request

    setServerError(''); // clear any previous server error before the new attempt
    setLoading(true); // show "Creating account…" and disable the button
    try {
      const response = await fetch(`${API_URL}/register`, { // POST to the public registration endpoint
        method: 'POST', // HTTP POST method
        headers: { 'Content-Type': 'application/json' }, // tell the server the body is JSON
        body: JSON.stringify({ fullname: form.fullname, username: form.email, password: form.password }), // send fullname, email as username, and password; omit confirmPassword as the backend doesn't need it
      });
      const data = await response.json(); // parse the JSON response

      if (response.ok) { // HTTP 201 means the account was created successfully
        navigate('/login'); // redirect to the login page so the user can sign in with their new account
      } else {
        setServerError(data.detail || 'Registration failed.'); // show the backend's error message (e.g. "Email already registered")
      }
    } catch {
      setServerError('Server connection error.'); // network failure or the server is unreachable
    } finally {
      setLoading(false); // re-enable the submit button regardless of outcome
    }
  };

  return (
    <div className="login-page"> {/* full-page centered container shared with the Login page */}
      <div className="site-title">KL <span>Learning App</span></div> {/* app branding above the card */}

      <div className="card"> {/* card panel containing the registration form */}
        <div className="card-top"> {/* header area with icon, heading, and subtitle */}
          <div className="icon-circle">👤</div> {/* person emoji in a purple circle */}
          <h1>Create Account</h1> {/* main heading */}
          <p>Fill in the details to get started</p> {/* subtitle */}
        </div>

        <hr className="divider" /> {/* horizontal separator between heading and form */}

        <form onSubmit={handleSubmit}> {/* form element; submission triggers handleSubmit */}
          <label htmlFor="fullname">Full Name</label> {/* label linked to the fullname input */}
          <input
            type="text" // plain text input for the user's display name
            id="fullname" // id matches the label's htmlFor
            placeholder="Enter your full name" // hint text
            value={form.fullname} // controlled input bound to fullname in state
            onChange={(e) => setForm({ ...form, fullname: e.target.value })} // update fullname on every keystroke
          />
          {errors.name && <p className="error" style={{ display: 'block' }}>Please enter your full name.</p>} {/* show name validation error when errors.name is true */}

          <label htmlFor="email">Email Address</label> {/* label linked to the email input */}
          <input
            type="email" // HTML5 email type
            id="email" // id matches the label's htmlFor
            placeholder="you@example.com" // hint text
            value={form.email} // controlled input bound to email in state
            onChange={(e) => setForm({ ...form, email: e.target.value })} // update email on every keystroke
          />
          {errors.email && <p className="error" style={{ display: 'block' }}>Please enter a valid email address.</p>} {/* show email validation error when errors.email is true */}

          <label htmlFor="password">Password</label> {/* label for the password field */}
          <div className="password-row"> {/* flex row with the password input and show/hide toggle */}
            <input
              type={showPassword ? 'text' : 'password'} // toggle between visible and masked based on showPassword state
              id="password" // id matches the label's htmlFor
              placeholder="Create a password" // hint text
              value={form.password} // controlled input bound to password in state
              onChange={(e) => setForm({ ...form, password: e.target.value })} // update password on every keystroke
            />
            <button type="button" className="show-hide-btn" onClick={() => setShowPassword(!showPassword)}> {/* type="button" prevents form submission */}
              {showPassword ? 'Hide' : 'Show'} {/* toggle the label to match current visibility */}
            </button>
          </div>
          {errors.password && <p className="error" style={{ display: 'block' }}>Password must be at least 6 characters.</p>} {/* show password validation error when errors.password is true */}

          <label htmlFor="confirmPassword">Confirm Password</label> {/* label for the confirmation field */}
          <div className="password-row"> {/* flex row with the confirm input and show/hide toggle */}
            <input
              type={showConfirm ? 'text' : 'password'} // toggle between visible and masked based on showConfirm state
              id="confirmPassword" // id matches the label's htmlFor
              placeholder="Repeat your password" // hint text
              value={form.confirmPassword} // controlled input bound to confirmPassword in state
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} // update confirmPassword on every keystroke
            />
            <button type="button" className="show-hide-btn" onClick={() => setShowConfirm(!showConfirm)}> {/* type="button" prevents form submission */}
              {showConfirm ? 'Hide' : 'Show'} {/* toggle the label */}
            </button>
          </div>
          {errors.confirm && <p className="error" style={{ display: 'block' }}>Passwords do not match.</p>} {/* show mismatch error when errors.confirm is true */}

          {serverError && <p className="error" style={{ display: 'block' }}>{serverError}</p>} {/* show server-side error (e.g. duplicate email) if present */}
          <button type="submit" className="submit-btn" disabled={loading}> {/* submit button disabled while the request is in-flight */}
            {loading ? 'Creating account…' : 'Create Account'} {/* show loading text while waiting for the API */}
          </button>
        </form>

        <div className="bottom-text"> {/* footer below the form */}
          <p>Already have an account? <Link to="/login">Sign in</Link></p> {/* link back to the login page for returning users */}
        </div>
      </div>
    </div>
  );
};

export default Register; // export the component so it can be imported in App.jsx
