import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './FlashCardApp.css';

const API_URL = 'http://localhost:8000';

export default function FlashCardApp() {
  const [token] = useState(localStorage.getItem('token'));
  const [username] = useState(localStorage.getItem('username'));

  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questionInput, setQuestionInput] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState({ open: false, cardId: null, question: '', answer: '' });
  const [toast, setToast] = useState({ message: '', visible: false });

  const toastTimer = useRef(null);
  const navigate = useNavigate();

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchFlashcards();
  }, []);

  useEffect(() => {
    document.title = `Flashcards (${flashcards.length} cards)`;
  }, [flashcards]);

  const showToast = (msg) => {
    setToast({ message: msg, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    navigate('/login', { replace: true });
  };

  const fetchFlashcards = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/flashcards`, { headers: authHeaders });
      if (!res.ok) throw new Error();
      setFlashcards(await res.json());
    } catch {
      setFlashcards([]);
    } finally {
      setLoading(false);
    }
  };

  const addFlashcard = async () => {
    if (!questionInput.trim() || !answerInput.trim()) {
      return showToast('Please fill in both fields.');
    }
    try {
      const res = await fetch(`${API_URL}/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          id: Date.now().toString(),
          question: questionInput.trim(),
          answer: answerInput.trim(),
          isFlipped: false,
        }),
      });
      if (res.ok) {
        setQuestionInput('');
        setAnswerInput('');
        fetchFlashcards();
        showToast('Card added ✓');
      }
    } catch {
      showToast('Failed to add card.');
    }
  };

  const toggleFlip = async (id) => {
    try {
      const res = await fetch(`${API_URL}/flashcards/${id}/flip`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      if (res.ok) {
        const updated = await res.json();
        setFlashcards((cards) => cards.map((c) => c.id === id ? updated : c));
      }
    } catch {
      showToast('Failed to flip card.');
    }
  };

  const deleteFlashcard = async (id, question) => {
    if (!window.confirm(`Delete "${question}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/flashcards/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        fetchFlashcards();
        showToast('Card deleted');
      }
    } catch {
      showToast('Failed to delete card.');
    }
  };

  const openModal = (card) => {
    setModal({ open: true, cardId: card.id, question: card.question, answer: card.answer });
  };

  const closeModal = () => {
    setModal({ open: false, cardId: null, question: '', answer: '' });
  };

  const saveModal = async () => {
    if (!modal.question.trim() || !modal.answer.trim()) {
      return showToast('Please fill in both fields.');
    }
    const card = flashcards.find((c) => c.id === modal.cardId);
    try {
      const res = await fetch(`${API_URL}/flashcards/${modal.cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ...card, question: modal.question.trim(), answer: modal.answer.trim() }),
      });
      if (res.ok) {
        fetchFlashcards();
        closeModal();
        showToast('Card updated ✓');
      }
    } catch {
      showToast('Failed to update card.');
    }
  };

  const filteredCards = flashcards.filter((card) =>
    card.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      <div className="app-wrapper">

        <div className="user-bar">
          <span className="user-bar-name">● {username}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>

        <div className="header">
          <h1>KL <span>Learning App</span></h1>
          <p>Study smarter, remember more</p>
        </div>

        <div className="input-section">
          <input
            type="text"
            placeholder="Question..."
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && document.getElementById('answerInput').focus()}
          />
          <input
            id="answerInput"
            type="text"
            placeholder="Answer..."
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFlashcard()}
          />
          <button onClick={addFlashcard}>+ Add Card</button>
        </div>

        <input
          type="text"
          className="search-box"
          placeholder="Search cards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {loading ? (
          <div className="empty-state">Loading flashcards...</div>
        ) : filteredCards.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? 'No cards match your search.' : 'No flashcards yet. Add one above!'}
          </div>
        ) : (
          <div className="flashcard-list">
            {filteredCards.map((card) => (
              <div key={card.id} className="fc-wrapper">
                <div
                  className={`fc-box ${card.isFlipped ? 'flipped' : ''}`}
                  onClick={() => toggleFlip(card.id)}
                >
                  <div className="fc-inner">
                    <div className="fc-front">
                      <span className="fc-label">Question</span>
                      <span className="fc-text">{card.question}</span>
                    </div>
                    <div className="fc-back">
                      <span className="fc-label">Answer</span>
                      <span className="fc-text">{card.answer}</span>
                      <div className="fc-actions">
                        <button
                          className="fc-edit-btn"
                          onClick={(e) => { e.stopPropagation(); openModal(card); }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="fc-delete-btn"
                          onClick={(e) => { e.stopPropagation(); deleteFlashcard(card.id, card.question); }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {modal.open && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Card</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <label>Question</label>
              <input
                type="text"
                placeholder="Enter question..."
                value={modal.question}
                autoFocus
                onChange={(e) => setModal((m) => ({ ...m, question: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('modalAnswer').focus()}
              />
              <label>Answer</label>
              <input
                id="modalAnswer"
                type="text"
                placeholder="Enter answer..."
                value={modal.answer}
                onChange={(e) => setModal((m) => ({ ...m, answer: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && saveModal()}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn-primary" onClick={saveModal}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`toast ${toast.visible ? 'show' : ''}`}>{toast.message}</div>
    </div>
  );
}
