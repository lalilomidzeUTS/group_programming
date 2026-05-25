import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminApp.css';
import { API_URL } from '../config';
import { handleError, logout } from '../utils';

const AVATAR_COLORS = [
  { bg: '#3f4278', color: '#c8caff' },
  { bg: '#2e3a2e', color: '#7ec87e' },
  { bg: '#3a2e4a', color: '#c87ef8' },
  { bg: '#2e3a4a', color: '#7ec8f8' },
  { bg: '#4a3a2e', color: '#f8c87e' },
  { bg: '#4a2e3a', color: '#f87ec8' },
];

// Splits on @ and whitespace to handle email addresses (e.g. "john@example.com" → "JE")
function getInitials(name) {
  return name.split(/[@\s]+/).map((w) => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

// Cycles through AVATAR_COLORS using the user's position in the full list so
// colors stay consistent even when the list is filtered by search
function getAvatarColor(idx) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

export default function AdminApp() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState('flashcards');
  const [userHistory, setUserHistory] = useState([]);
  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimer = useRef(null);

  const [token] = useState(localStorage.getItem('token'));
  const navigate = useNavigate();
  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (selectedUser) {
      setFlashcards([]);
      setUserHistory([]);
      setActiveTab('flashcards');
      setEditingId(null);
      fetchFlashcards(selectedUser);
      fetchUserHistory(selectedUser);
    }
  }, [selectedUser]);

  const showToast = (msg) => {
    setToast({ message: msg, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2400);
  };

  const fetchUserHistory = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/history`, { headers: authHeaders });
      if (res.ok) setUserHistory(await res.json());
      else await handleError(res, navigate, showToast);
    } catch { showToast('Could not reach the server.'); }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${API_URL}/admin/users`, { headers: authHeaders });
      if (res.ok) setUsers(await res.json());
      else await handleError(res, navigate, showToast);
    } catch { showToast('Could not reach the server.'); }
    finally { setLoadingUsers(false); }
  };

  const fetchFlashcards = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/flashcards`, { headers: authHeaders });
      if (res.ok) setFlashcards(await res.json());
      else await handleError(res, navigate, showToast);
    } catch { showToast('Could not reach the server.'); }
  };

  const startEdit = (card) => {
    setEditingId(card.id);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
  };

  const saveEdit = async () => {
    const card = flashcards.find((c) => c.id === editingId);
    try {
      const res = await fetch(`${API_URL}/flashcards/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ...card, question: editQuestion.trim(), answer: editAnswer.trim() }),
      });
      if (res.ok) { fetchFlashcards(selectedUser); setEditingId(null); showToast('Card updated'); }
      else await handleError(res, navigate, showToast);
    } catch { showToast('Could not reach the server.'); }
  };

  const deleteCard = async (id) => {
    const card = flashcards.find((c) => c.id === id);
    if (!window.confirm(`Delete "${card.question}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/flashcards/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) { fetchFlashcards(selectedUser); showToast('Card deleted'); }
      else await handleError(res, navigate, showToast);
    } catch { showToast('Could not reach the server.'); }
  };

  const handleLogout = () => logout(navigate);

  const filteredUsers = userSearch
    ? users.filter((u) => u.toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  // Pre-compute color for the selected user header to avoid calling getAvatarColor twice
  const selectedUserColor = selectedUser ? getAvatarColor(users.indexOf(selectedUser)) : null;

  const editCount = userHistory.filter((h) => h.type === 'edit').length;
  const deleteCount = userHistory.filter((h) => h.type === 'delete').length;

  const renderHistoryTab = () => {
    const events = userHistory.filter((h) => ['create', 'edit', 'delete'].includes(h.type));
    if (events.length === 0) {
      return <div className="empty-state">No history recorded for this user.</div>;
    }
    return events.map((event, i) => {
      if (event.type === 'create') {
        return (
          <div key={i} className="history-item">
            <div className="history-row">
              <div><h4>Card Created</h4><div className="history-date">{new Date(event.date).toLocaleString()}</div></div>
              <span className="hist-badge hb-create">Created</span>
            </div>
            <div className="history-detail det-create">
              <div className="det-row"><span className="field-label q-label">Q</span><span className="det-q">{event.q || ''}</span></div>
              <div className="det-row"><span className="field-label a-label">A</span><span className="det-a">{event.a || ''}</span></div>
            </div>
          </div>
        );
      }
      if (event.type === 'delete') {
        return (
          <div key={i} className="history-item">
            <div className="history-row">
              <div><h4>Card Deleted</h4><div className="history-date">{new Date(event.date).toLocaleString()}</div></div>
              <span className="hist-badge hb-delete">Deleted</span>
            </div>
            <div className="history-detail det-delete">
              <div className="det-row"><span className="field-label q-label">Q</span><span className="det-q">{event.q || ''}</span></div>
              <div className="det-row"><span className="field-label a-label">A</span><span className="det-a">{event.a || ''}</span></div>
            </div>
          </div>
        );
      }
      return (
        <div key={i} className="history-item">
          <div className="history-row">
            <div><h4>Card Edited</h4><div className="history-date">{new Date(event.date).toLocaleString()}</div></div>
            <span className="hist-badge hb-edit">Edited</span>
          </div>
          <div className="history-detail det-edit">
            <div className="det-section-label">Before</div>
            <div className="det-row"><span className="field-label q-label">Q</span><span className="det-q">{event.oldQ || ''}</span></div>
            <div className="det-row"><span className="field-label a-label">A</span><span className="det-a">{event.oldA || ''}</span></div>
            <div className="det-section-label">After</div>
            <div className="det-row"><span className="field-label q-label">Q</span><span className="det-q">{event.newQ || ''}</span></div>
            <div className="det-row"><span className="field-label a-label">A</span><span className="det-a">{event.newA || ''}</span></div>
          </div>
        </div>
      );
    });
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>KL <span>Admin Dashboard</span></h1>
          <p>Manage all registered users and their flashcards</p>
        </div>
        <div className="topbar-right">
          <span className="admin-badge">● ADMIN</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="dashboard">
        <div className="sidebar">
          <div className="sidebar-head">
            <h2>Registered Users</h2>
            <input
              type="text"
              className="user-search"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <div className="user-count">{users.length} user{users.length !== 1 ? 's' : ''} registered</div>
          </div>
          <div className="user-list">
            {loadingUsers ? (
              <div className="no-users-msg">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="no-users-msg">No users registered yet.<br />They appear here once someone uses the app.</div>
            ) : filteredUsers.length === 0 ? (
              <div className="no-users-msg">No users match your search.</div>
            ) : (
              filteredUsers.map((user) => {
                const userIndex = users.indexOf(user);
                const avatarColor = getAvatarColor(userIndex);
                return (
                  <div
                    key={user}
                    className={`user-item${selectedUser === user ? ' active' : ''}`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="user-avatar" style={{ background: avatarColor.bg, color: avatarColor.color }}>
                      {getInitials(user)}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{user}</div>
                      {selectedUser === user && (
                        <div className="user-meta">{flashcards.length} card{flashcards.length !== 1 ? 's' : ''}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="main">
          {!selectedUser ? (
            <div className="no-user">
              <div className="icon">👤</div>
              <p>Select a user to manage their flashcards</p>
            </div>
          ) : (
            <>
              <div className="user-header">
                <div className="user-header-left">
                  <div
                    className="user-header-avatar"
                    style={{ background: selectedUserColor.bg, color: selectedUserColor.color }}
                  >
                    {getInitials(selectedUser)}
                  </div>
                  <div className="user-header-info">
                    <h2>{selectedUser}</h2>
                  </div>
                </div>
                <div className="stats-row">
                  <div className="stat-box"><div className="stat-number">{flashcards.length}</div><div className="stat-label">Cards</div></div>
                  <div className="stat-box"><div className="stat-number">{editCount}</div><div className="stat-label">Edits</div></div>
                  <div className="stat-box"><div className="stat-number">{deleteCount}</div><div className="stat-label">Deleted</div></div>
                </div>
              </div>

              <div className="tabs">
                <button className={`tab-btn${activeTab === 'flashcards' ? ' active' : ''}`} onClick={() => setActiveTab('flashcards')}>Flashcards</button>
                <button className={`tab-btn${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
              </div>

              <div className="content">
                {activeTab === 'flashcards' && (
                  flashcards.length === 0 ? (
                    <div className="empty-state">No flashcards for this user.</div>
                  ) : (
                    flashcards.map((card) => (
                      <div key={card.id} className={`card-item${editingId === card.id ? ' editing' : ''}`}>
                        {editingId === card.id ? (
                          <>
                            <div className="card-texts">
                              <input
                                className="inline-edit-input"
                                value={editQuestion}
                                onChange={(e) => setEditQuestion(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('adminEditAnswer').focus(); }}
                                autoFocus
                              />
                              <input
                                id="adminEditAnswer"
                                className="inline-edit-input"
                                value={editAnswer}
                                onChange={(e) => setEditAnswer(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                              />
                            </div>
                            <div className="card-actions">
                              <button className="btn-save" onClick={saveEdit}>Save</button>
                              <button className="btn-cancel-edit" onClick={() => setEditingId(null)}>✕</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="card-texts">
                              <div className="card-field"><span className="field-label q-label">Q</span><span className="card-q-text">{card.question}</span></div>
                              <div className="card-field"><span className="field-label a-label">A</span><span className="card-a-text">{card.answer}</span></div>
                            </div>
                            <div className="card-actions">
                              <button className="btn-edit" onClick={() => startEdit(card)}>Edit</button>
                              <button className="btn-del" onClick={() => deleteCard(card.id)}>Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )
                )}
                {activeTab === 'history' && renderHistoryTab()}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`toast${toast.visible ? ' show' : ''}`}>{toast.message}</div>
    </>
  );
}
