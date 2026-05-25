import { useState, useEffect, useRef } from 'react'; // useState for local state, useEffect for side effects/lifecycle, useRef for the toast timer
import { useNavigate } from 'react-router-dom'; // useNavigate for redirecting to login when the session expires
import './AdminApp.css'; // import the admin dashboard styles
import { API_URL } from '../config'; // base URL of the FastAPI backend
import { handleError, logout } from '../utils'; // shared error handler and logout utility

const AVATAR_COLORS = [ // array of background/foreground colour pairs used to colour user avatars
  { bg: '#3f4278', color: '#c8caff' }, // purple
  { bg: '#2e3a2e', color: '#7ec87e' }, // green
  { bg: '#3a2e4a', color: '#c87ef8' }, // violet
  { bg: '#2e3a4a', color: '#7ec8f8' }, // blue
  { bg: '#4a3a2e', color: '#f8c87e' }, // orange
  { bg: '#4a2e3a', color: '#f87ec8' }, // pink
];

// Splits on @ and whitespace to handle email addresses (e.g. "john@example.com" → "JE")
function getInitials(name) { // derives a 1-2 character abbreviation from a username for use in the avatar circle
  return name.split(/[@\s]+/).map((w) => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'; // split by @ or whitespace, take first char of each part, uppercase, limit to 2 chars; fallback to '?'
}

// Cycles through AVATAR_COLORS using the user's position in the full list so
// colors stay consistent even when the list is filtered by search
function getAvatarColor(idx) { // returns a colour pair for a user at the given index in the full user list
  return AVATAR_COLORS[idx % AVATAR_COLORS.length]; // wrap around the palette so every index gets a colour
}

export default function AdminApp() { // the admin dashboard component; displays all users and lets admins manage their flashcards
  const [users, setUsers] = useState([]); // full list of registered usernames fetched from the server
  const [loadingUsers, setLoadingUsers] = useState(true); // true while the user list is being fetched
  const [usersFetchFailed, setUsersFetchFailed] = useState(false); // true if the user list request failed (network or server error)
  const [selectedUser, setSelectedUser] = useState(null); // the username currently selected in the sidebar; null means no user selected
  const [flashcards, setFlashcards] = useState([]); // flashcards belonging to the selected user
  const [editingId, setEditingId] = useState(null); // id of the card currently being edited; null means no card is in edit mode
  const [editQuestion, setEditQuestion] = useState(''); // current value of the question input while editing a card
  const [editAnswer, setEditAnswer] = useState(''); // current value of the answer input while editing a card
  const [userSearch, setUserSearch] = useState(''); // text typed in the user search box; used to filter the sidebar list
  const [activeTab, setActiveTab] = useState('flashcards'); // which tab is shown in the main panel: 'flashcards' or 'history'
  const [userHistory, setUserHistory] = useState([]); // history events for the selected user
  const [toast, setToast] = useState({ message: '', visible: false }); // toast notification state: the message text and whether it's visible
  const toastTimer = useRef(null); // ref holding the setTimeout id for auto-hiding the toast, so it can be cleared on re-trigger

  const [token] = useState(localStorage.getItem('token')); // read the JWT once on mount; won't change during the session
  const navigate = useNavigate(); // navigation function for redirecting on session expiry
  const authHeaders = { Authorization: `Bearer ${token}` }; // pre-built auth header object used in every fetch call

  useEffect(() => { fetchUsers(); }, []); // fetch the user list once when the component mounts
  useEffect(() => () => clearTimeout(toastTimer.current), []); // cleanup: clear the toast timer when the component unmounts to prevent memory leaks

  useEffect(() => { // re-run whenever selectedUser changes to load that user's data
    if (selectedUser) { // only act when a user has actually been selected
      setFlashcards([]); // clear previous user's flashcards immediately so stale cards don't flash on screen
      setUserHistory([]); // clear previous user's history
      setActiveTab('flashcards'); // always start on the flashcards tab when switching users
      setEditingId(null); // cancel any in-progress edit from the previous user
      fetchFlashcards(selectedUser); // load the selected user's flashcards
      fetchUserHistory(selectedUser); // load the selected user's history
    }
  }, [selectedUser]); // dependency: re-run whenever selectedUser changes

  const showToast = (msg) => { // displays a temporary toast notification at the bottom of the screen
    setToast({ message: msg, visible: true }); // set the message and make it visible
    clearTimeout(toastTimer.current); // cancel any previous timer so rapidly triggered toasts don't hide prematurely
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2400); // hide the toast after 2.4 seconds
  };

  const fetchUserHistory = async (userId) => { // fetches the activity history for a given user from the admin endpoint
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/history`, { headers: authHeaders }); // GET the user's history; encodeURIComponent handles email addresses with @ symbols
      if (res.ok) setUserHistory(await res.json()); // parse and store the history events
      else await handleError(res, navigate, showToast); // handle 401/other errors
    } catch { showToast('Could not reach the server.'); } // network error
  };

  const fetchUsers = async () => { // fetches the full list of registered users from the admin endpoint
    try {
      setLoadingUsers(true); // show the "Loading users..." state in the sidebar
      setUsersFetchFailed(false); // reset the failure flag before each attempt
      const res = await fetch(`${API_URL}/admin/users`, { headers: authHeaders }); // GET all usernames
      if (res.ok) setUsers(await res.json()); // parse and store the username list
      else { setUsersFetchFailed(true); await handleError(res, navigate, showToast); } // mark failure and handle the error
    } catch { setUsersFetchFailed(true); showToast('Could not reach the server.'); } // network error: mark failure and notify
    finally { setLoadingUsers(false); } // always stop the loading state whether the fetch succeeded or failed
  };

  const fetchFlashcards = async (userId) => { // fetches all flashcards for a specific user from the admin endpoint
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/flashcards`, { headers: authHeaders }); // GET the user's flashcards
      if (res.ok) setFlashcards(await res.json()); // parse and store the flashcard list
      else await handleError(res, navigate, showToast); // handle errors
    } catch { showToast('Could not reach the server.'); } // network error
  };

  const startEdit = (card) => { // puts a card into edit mode by loading its values into the edit inputs
    setEditingId(card.id); // mark this card's id as the one being edited
    setEditQuestion(card.question); // pre-fill the question input with the card's current question
    setEditAnswer(card.answer); // pre-fill the answer input with the card's current answer
  };

  const saveEdit = async () => { // saves the in-progress edit by PUTting the updated card to the backend
    if (!editQuestion.trim() || !editAnswer.trim()) return showToast('Question and answer cannot be empty.'); // validate: both fields must have non-whitespace content
    const card = flashcards.find((c) => c.id === editingId); // find the original card object to preserve its other fields
    try {
      const res = await fetch(`${API_URL}/flashcards/${editingId}`, { // PUT to the flashcard update endpoint
        method: 'PUT', // HTTP PUT replaces the card's content
        headers: { 'Content-Type': 'application/json', ...authHeaders }, // JSON body + auth header
        body: JSON.stringify({ ...card, question: editQuestion.trim(), answer: editAnswer.trim() }), // spread existing card fields, override question and answer with trimmed new values
      });
      if (res.ok) { fetchFlashcards(selectedUser); setEditingId(null); showToast('Card updated'); } // refresh the card list, exit edit mode, notify
      else await handleError(res, navigate, showToast); // handle errors
    } catch { showToast('Could not reach the server.'); } // network error
  };

  const deleteCard = async (id) => { // deletes a flashcard after confirming with the user
    const card = flashcards.find((c) => c.id === id); // find the card to include its question in the confirmation dialog
    if (!window.confirm(`Delete "${card.question}"?`)) return; // ask the admin to confirm before deleting
    try {
      const res = await fetch(`${API_URL}/flashcards/${id}`, { // DELETE request to the flashcard endpoint
        method: 'DELETE', // HTTP DELETE method
        headers: authHeaders, // auth header only; no body needed for DELETE
      });
      if (res.ok) { fetchFlashcards(selectedUser); showToast('Card deleted'); } // refresh the list and notify
      else await handleError(res, navigate, showToast); // handle errors
    } catch { showToast('Could not reach the server.'); } // network error
  };

  const handleLogout = () => logout(navigate); // call the shared logout utility which clears storage and redirects to /login

  const filteredUsers = userSearch // compute the filtered sidebar list based on the search input
    ? users.filter((u) => u.toLowerCase().includes(userSearch.toLowerCase())) // case-insensitive substring match
    : users; // no search query → show all users

  // Pre-compute color for the selected user header to avoid calling getAvatarColor twice
  const selectedUserColor = selectedUser ? getAvatarColor(users.indexOf(selectedUser)) : null; // get the avatar colour for the selected user (null if none selected)

  const editCount = userHistory.filter((h) => h.type === 'edit').length; // count edit events in the selected user's history for the stats bar
  const deleteCount = userHistory.filter((h) => h.type === 'delete').length; // count delete events for the stats bar

  const renderHistoryTab = () => { // builds the list of history event cards for the History tab
    const events = userHistory.filter((h) => ['create', 'edit', 'delete'].includes(h.type)); // filter to only recognised event types
    if (events.length === 0) { // no history events for this user
      return <div className="empty-state">No history recorded for this user.</div>; // show empty state message
    }
    return events.map((event, i) => { // map each event to a history card element
      if (event.type === 'create') { // card creation event
        return (
          <div key={i} className="history-item"> {/* unique key required by React for list items */}
            <div className="history-row"> {/* flex row with event title and badge */}
              <div><h4>Card Created</h4><div className="history-date">{new Date(event.date).toLocaleString()}</div></div> {/* event title and formatted timestamp */}
              <span className="hist-badge hb-create">Created</span> {/* green "Created" badge */}
            </div>
            <div className="history-detail det-create"> {/* card snapshot with green left border */}
              <div className="det-row"><span className="field-label q-label">Q</span><span className="det-q">{event.q || ''}</span></div> {/* question at creation time */}
              <div className="det-row"><span className="field-label a-label">A</span><span className="det-a">{event.a || ''}</span></div> {/* answer at creation time */}
            </div>
          </div>
        );
      }
      if (event.type === 'delete') { // card deletion event
        return (
          <div key={i} className="history-item">
            <div className="history-row">
              <div><h4>Card Deleted</h4><div className="history-date">{new Date(event.date).toLocaleString()}</div></div> {/* deletion event title and timestamp */}
              <span className="hist-badge hb-delete">Deleted</span> {/* red "Deleted" badge */}
            </div>
            <div className="history-detail det-delete"> {/* card snapshot with red left border */}
              <div className="det-row"><span className="field-label q-label">Q</span><span className="det-q">{event.q || ''}</span></div> {/* question of the deleted card */}
              <div className="det-row"><span className="field-label a-label">A</span><span className="det-a">{event.a || ''}</span></div> {/* answer of the deleted card */}
            </div>
          </div>
        );
      }
      return ( // card edit event (default branch)
        <div key={i} className="history-item">
          <div className="history-row">
            <div><h4>Card Edited</h4><div className="history-date">{new Date(event.date).toLocaleString()}</div></div> {/* edit event title and timestamp */}
            <span className="hist-badge hb-edit">Edited</span> {/* purple "Edited" badge */}
          </div>
          <div className="history-detail det-edit"> {/* before/after snapshot with purple left border */}
            <div className="det-section-label">Before</div> {/* section label for the old values */}
            <div className="det-row"><span className="field-label q-label">Q</span><span className="det-q">{event.oldQ || ''}</span></div> {/* old question */}
            <div className="det-row"><span className="field-label a-label">A</span><span className="det-a">{event.oldA || ''}</span></div> {/* old answer */}
            <div className="det-section-label">After</div> {/* section label for the new values */}
            <div className="det-row"><span className="field-label q-label">Q</span><span className="det-q">{event.newQ || ''}</span></div> {/* new question */}
            <div className="det-row"><span className="field-label a-label">A</span><span className="det-a">{event.newA || ''}</span></div> {/* new answer */}
          </div>
        </div>
      );
    });
  };

  return (
    <> {/* React fragment — wraps multiple siblings without adding a DOM element */}
      <div className="topbar"> {/* fixed top navigation bar */}
        <div className="topbar-left"> {/* left side: app title and subtitle */}
          <h1>KL <span>Admin Dashboard</span></h1> {/* page title; "Admin Dashboard" highlighted in purple */}
          <p>Manage all registered users and their flashcards</p> {/* subtitle describing the page purpose */}
        </div>
        <div className="topbar-right"> {/* right side: admin badge and logout button */}
          <span className="admin-badge">● ADMIN</span> {/* pill badge showing the current user is an admin */}
          <button className="logout-btn" onClick={handleLogout}>Logout</button> {/* logout button that clears storage and redirects to login */}
        </div>
      </div>

      <div className="dashboard"> {/* two-column flex layout: sidebar + main content */}
        <div className="sidebar"> {/* left sidebar: user list and search */}
          <div className="sidebar-head"> {/* fixed header at the top of the sidebar */}
            <h2>Registered Users</h2> {/* sidebar section heading */}
            <input
              type="text" // plain text search input
              className="user-search" // styled search box
              placeholder="Search users..." // hint text
              value={userSearch} // controlled input bound to userSearch state
              onChange={(e) => setUserSearch(e.target.value)} // filter the user list on every keystroke
            />
            <div className="user-count">{users.length} user{users.length !== 1 ? 's' : ''} registered</div> {/* total count with correct pluralisation */}
          </div>
          <div className="user-list"> {/* scrollable list of user items */}
            {loadingUsers ? ( // show loading message while the user list is being fetched
              <div className="no-users-msg">Loading users...</div>
            ) : usersFetchFailed ? ( // show error message if the fetch failed
              <div className="no-users-msg">Failed to load users.<br />Check your connection and refresh.</div>
            ) : users.length === 0 ? ( // show empty state if no users are registered
              <div className="no-users-msg">No users registered yet.<br />They appear here once someone uses the app.</div>
            ) : filteredUsers.length === 0 ? ( // show no-match message if the search returns nothing
              <div className="no-users-msg">No users match your search.</div>
            ) : (
              filteredUsers.map((user) => { // render a clickable row for each user that matches the search
                const userIndex = users.indexOf(user); // get the user's position in the full list for consistent avatar colouring
                const avatarColor = getAvatarColor(userIndex); // derive the avatar colour from the full-list index
                return (
                  <div
                    key={user} // React requires a unique key for list items
                    className={`user-item${selectedUser === user ? ' active' : ''}`} // add 'active' class when this user is selected
                    onClick={() => setSelectedUser(user)} // select this user when the row is clicked
                  >
                    <div className="user-avatar" style={{ background: avatarColor.bg, color: avatarColor.color }}> {/* coloured avatar circle with initials */}
                      {getInitials(user)} {/* display the user's derived initials */}
                    </div>
                    <div className="user-info"> {/* text info next to the avatar */}
                      <div className="user-name">{user}</div> {/* show the full username */}
                      {selectedUser === user && ( // only show the card count for the currently selected user
                        <div className="user-meta">{flashcards.length} card{flashcards.length !== 1 ? 's' : ''}</div> // card count with pluralisation
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="main"> {/* main content area to the right of the sidebar */}
          {!selectedUser ? ( // no user selected yet
            <div className="no-user"> {/* empty state placeholder */}
              <div className="icon">👤</div> {/* person icon */}
              <p>Select a user to manage their flashcards</p> {/* instruction */}
            </div>
          ) : (
            <> {/* a user is selected: show their header, tabs, and content */}
              <div className="user-header"> {/* header bar showing the selected user's info and stats */}
                <div className="user-header-left"> {/* left side: avatar and username */}
                  <div
                    className="user-header-avatar"
                    style={{ background: selectedUserColor.bg, color: selectedUserColor.color }} // apply the user's avatar colours
                  >
                    {getInitials(selectedUser)} {/* show the selected user's initials */}
                  </div>
                  <div className="user-header-info">
                    <h2>{selectedUser}</h2> {/* display the selected user's email/username */}
                  </div>
                </div>
                <div className="stats-row"> {/* right side: stat boxes */}
                  <div className="stat-box"><div className="stat-number">{flashcards.length}</div><div className="stat-label">Cards</div></div> {/* total flashcard count */}
                  <div className="stat-box"><div className="stat-number">{editCount}</div><div className="stat-label">Edits</div></div> {/* total edit events in history */}
                  <div className="stat-box"><div className="stat-number">{deleteCount}</div><div className="stat-label">Deleted</div></div> {/* total delete events in history */}
                </div>
              </div>

              <div className="tabs"> {/* tab buttons to switch between Flashcards and History panels */}
                <button className={`tab-btn${activeTab === 'flashcards' ? ' active' : ''}`} onClick={() => setActiveTab('flashcards')}>Flashcards</button> {/* Flashcards tab */}
                <button className={`tab-btn${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>History</button> {/* History tab */}
              </div>

              <div className="content"> {/* scrollable content area below the tabs */}
                {activeTab === 'flashcards' && ( // render flashcards panel when that tab is active
                  flashcards.length === 0 ? ( // no cards for this user
                    <div className="empty-state">No flashcards for this user.</div>
                  ) : (
                    flashcards.map((card) => ( // render each flashcard as a card item
                      <div key={card.id} className={`card-item${editingId === card.id ? ' editing' : ''}`}> {/* add 'editing' class to highlight the card being edited */}
                        {editingId === card.id ? ( // this card is in edit mode
                          <>
                            <div className="card-texts"> {/* inputs replace the read-only text when editing */}
                              <input
                                className="inline-edit-input" // styled inline edit input
                                value={editQuestion} // bound to editQuestion state
                                onChange={(e) => setEditQuestion(e.target.value)} // update question on keystroke
                                onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('adminEditAnswer').focus(); }} // Enter in question field moves focus to answer field
                                autoFocus // focus this input automatically when edit mode starts
                              />
                              <input
                                id="adminEditAnswer" // id used by the question input's Enter handler to move focus here
                                className="inline-edit-input"
                                value={editAnswer} // bound to editAnswer state
                                onChange={(e) => setEditAnswer(e.target.value)} // update answer on keystroke
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }} // Enter saves, Escape cancels
                              />
                            </div>
                            <div className="card-actions"> {/* Save and Cancel buttons for edit mode */}
                              <button className="btn-save" onClick={saveEdit}>Save</button> {/* save the edited card */}
                              <button className="btn-cancel-edit" onClick={() => setEditingId(null)}>✕</button> {/* cancel edit and restore read-only view */}
                            </div>
                          </>
                        ) : ( // card is in read-only view mode
                          <>
                            <div className="card-texts"> {/* display the question and answer */}
                              <div className="card-field"><span className="field-label q-label">Q</span><span className="card-q-text">{card.question}</span></div> {/* question row */}
                              <div className="card-field"><span className="field-label a-label">A</span><span className="card-a-text">{card.answer}</span></div> {/* answer row */}
                            </div>
                            <div className="card-actions"> {/* Edit and Delete action buttons */}
                              <button className="btn-edit" onClick={() => startEdit(card)}>Edit</button> {/* enter edit mode for this card */}
                              <button className="btn-del" onClick={() => deleteCard(card.id)}>Delete</button> {/* delete this card after confirmation */}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )
                )}
                {activeTab === 'history' && renderHistoryTab()} {/* render the history event list when the History tab is active */}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`toast${toast.visible ? ' show' : ''}`}>{toast.message}</div> {/* toast notification: 'show' class makes it visible via CSS opacity transition */}
    </>
  );
}
