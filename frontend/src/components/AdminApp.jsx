import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Check, X, Edit2 } from 'lucide-react';
import './AdminApp.css';

const API_URL = 'http://localhost:8000';

export default function AdminApp() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const navigate = useNavigate();

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) fetchFlashcards(selectedUser);
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, { headers: authHeaders });
      const data = await res.json();
      setUsers(data);
    } catch {
      alert('Failed to load users.');
    }
  };

  const fetchFlashcards = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/flashcards`, { headers: authHeaders });
      const data = await res.json();
      setFlashcards(data);
    } catch {
      alert('Failed to load flashcards.');
    }
  };

  const flipCard = async (id) => {
    try {
      const res = await fetch(`${API_URL}/flashcards/${id}/flip`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      if (res.ok) fetchFlashcards(selectedUser);
    } catch {
      alert('Failed to flip card.');
    }
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
      if (res.ok) {
        fetchFlashcards(selectedUser);
        setEditingId(null);
      }
    } catch {
      alert('Failed to save edit.');
    }
  };

  const deleteCard = async (id) => {
    const card = flashcards.find((c) => c.id === id);
    if (!window.confirm(`Delete "${card.question}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/flashcards/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) fetchFlashcards(selectedUser);
    } catch {
      alert('Failed to delete card.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-container">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2 className="admin-sidebar-title">Users</h2>
          <button className="admin-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
        <ul className="admin-user-list">
          {users.map((user) => (
            <li
              key={user}
              className={`admin-user-item ${selectedUser === user ? 'active' : ''}`}
              onClick={() => { setSelectedUser(user); setEditingId(null); }}
            >
              <span className="admin-user-name">{user}</span>
              {user === username && <span className="admin-you-badge">you</span>}
            </li>
          ))}
        </ul>
      </aside>

      <main className="admin-main">
        {!selectedUser ? (
          <div className="admin-empty">
            <p>Select a user from the sidebar to view their flashcards.</p>
          </div>
        ) : (
          <>
            <div className="admin-main-header">
              <h2 className="admin-main-title">{selectedUser}</h2>
              <span className="admin-card-count">{flashcards.length} card{flashcards.length !== 1 ? 's' : ''}</span>
            </div>

            {flashcards.length === 0 ? (
              <div className="admin-empty">
                <p>This user has no flashcards yet.</p>
              </div>
            ) : (
              <ul className="admin-card-list">
                {flashcards.map((card) => (
                  <li key={card.id} className="admin-card-item">
                    {editingId === card.id ? (
                      <div className="admin-edit-mode">
                        <div className="admin-edit-inputs">
                          <input
                            type="text"
                            value={editQuestion}
                            onChange={(e) => setEditQuestion(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            placeholder="Question"
                            className="admin-edit-input"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editAnswer}
                            onChange={(e) => setEditAnswer(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            placeholder="Answer"
                            className="admin-edit-input"
                          />
                        </div>
                        <button onClick={saveEdit} className="admin-icon-btn save"><Check size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="admin-icon-btn cancel"><X size={18} /></button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="admin-flashcard"
                          onClick={() => flipCard(card.id)}
                        >
                          {card.isFlipped ? (
                            <div className="admin-flashcard-back">
                              <span className="admin-flashcard-label">Answer</span>
                              <p className="admin-flashcard-text">{card.answer}</p>
                            </div>
                          ) : (
                            <div className="admin-flashcard-front">
                              <span className="admin-flashcard-label">Question</span>
                              <p className="admin-flashcard-text">{card.question}</p>
                            </div>
                          )}
                        </div>
                        <div className="admin-card-actions">
                          <button
                            onClick={() => startEdit(card)}
                            className="admin-icon-btn edit"
                            disabled={editingId !== null}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteCard(card.id)}
                            className="admin-icon-btn delete"
                            disabled={editingId !== null}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
