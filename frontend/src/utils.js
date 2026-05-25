// Reads the error detail from a non-ok fetch response.
// Returns a user-friendly string for known status codes.
export async function getErrorMessage(res) {
  if (res.status === 503) return 'Database unavailable. Please try again later.';
  try {
    const data = await res.json();
    return data.detail || 'Something went wrong.';
  } catch {
    return 'Something went wrong.';
  }
}

// Clears all auth state from localStorage and redirects to login.
// Accepts navigate from react-router-dom since hooks can't be called outside components.
export function logout(navigate) {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  navigate('/login', { replace: true });
}
