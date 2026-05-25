// Clears all auth state from localStorage and redirects to login.
// Accepts navigate from react-router-dom since hooks can't be called outside components.
export function logout(navigate) {  // removes every stored credential and sends the browser to the login page
  localStorage.removeItem('token');  // delete the JWT so future API requests won't include an Authorization header
  localStorage.removeItem('username');  // delete the stored display name so the UI stops showing the user as logged in
  localStorage.removeItem('role');  // delete the stored role so admin-only UI sections are no longer accessible
  navigate('/login', { replace: true });  // redirect to /login and replace the current history entry so the back button won't return to a protected page
}

// Reads the error detail from a non-ok fetch response.
// Returns a user-friendly string for known status codes.
async function getErrorMessage(res) {  // extracts a readable error message from any failed API response object
  if (res.status === 503) return 'Database unavailable. Please try again later.';  // give a clear message for the specific 503 "database down" response the backend returns
  try {
    const data = await res.json();  // attempt to parse the response body as JSON to read FastAPI's "detail" field
    return data.detail || 'Something went wrong.';  // return the "detail" string if present, otherwise fall back to a generic message
  } catch {
    return 'Something went wrong.';  // JSON parsing failed (non-JSON body), so return the generic fallback string
  }
}

// Handles a non-ok fetch response: redirects to login on 401, shows a toast for all others.
// Returns true if the response was ok, false otherwise.
export async function handleError(res, navigate, showToast) {  // centralised error handler called after every non-ok fetch response in the app
  if (res.status === 401) {  // 401 Unauthorized means the JWT has expired or is invalid
    logout(navigate);  // clear stored credentials and redirect to the login page
    return false;  // signal to the caller that the operation failed
  }
  showToast(await getErrorMessage(res));  // for any other error status, extract the message and display it as a toast notification
  return false;  // signal to the caller that the operation failed
}
