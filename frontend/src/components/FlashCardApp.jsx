import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './FlashCardApp.css';

const API_URL = 'http://localhost:8000';

export default function FlashCardApp() {
  const [token] = useState(localStorage.getItem('token'));
  const [username] = useState(localStorage.getItem('username'));

  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cards');

  // Add/Edit form
  const [questionInput, setQuestionInput] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingOldCard, setEditingOldCard] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Toast
  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimer = useRef(null);

  // Study mode
  const [studyPhase, setStudyPhase] = useState('idle'); // 'idle' | 'session' | 'done'
  const [studyCards, setStudyCards] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);
  const [studyReviewed, setStudyReviewed] = useState(0);

  const navigate = useNavigate();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [history, setHistory] = useState([]);

  useEffect(() => { fetchFlashcards(); }, []);
  useEffect(() => { document.title = `Flashcards (${flashcards.length} cards)`; }, [flashcards]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`, { headers: authHeaders });
      if (res.ok) setHistory(await res.json());
    } catch { /* silently ignore */ }
  };

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
    const q = questionInput.trim();
    const a = answerInput.trim();
    if (!q || !a) return showToast('Please fill in both fields.');

    if (editingId !== null) {
      const card = flashcards.find((c) => c.id === editingId);
      try {
        const res = await fetch(`${API_URL}/flashcards/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ ...card, question: q, answer: a }),
        });
        if (res.ok) {
          cancelEdit();
          fetchFlashcards();
          showToast('Card updated');
        }
      } catch { showToast('Failed to update card.'); }
    } else {
      try {
        const newId = Date.now().toString();
        const res = await fetch(`${API_URL}/flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ id: newId, question: q, answer: a, isFlipped: false }),
        });
        if (res.ok) {
          setQuestionInput('');
          setAnswerInput('');
          fetchFlashcards();
          showToast('Card added');
        }
      } catch { showToast('Failed to add card.'); }
    }
  };

  const beginEdit = (card) => {
    setEditingId(card.id);
    setEditingOldCard(card);
    setQuestionInput(card.question);
    setAnswerInput(card.answer);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingOldCard(null);
    setQuestionInput('');
    setAnswerInput('');
  };

  const deleteFlashcard = async (id) => {
    const card = flashcards.find((c) => c.id === id);
    if (editingId === id) cancelEdit();
    try {
      const res = await fetch(`${API_URL}/flashcards/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        fetchFlashcards();
        showToast('Card deleted');
      }
    } catch { showToast('Failed to delete card.'); }
  };

  const filteredCards = flashcards.filter((card) => {
    const s = searchQuery.toLowerCase();
    return card.question.toLowerCase().includes(s) || card.answer.toLowerCase().includes(s);
  });

  // Study mode
  const startStudy = () => {
    if (flashcards.length === 0) return;
    setStudyCards([...flashcards]);
    setStudyIndex(0);
    setStudyFlipped(false);
    setStudyPhase('session');
  };

  const endStudy = () => {
    setStudyReviewed(studyIndex + 1);
    setStudyPhase('done');
    showToast('Session complete');
  };

  // History render
  const renderHistory = () => {
    const events = history.filter((h) => ['create', 'edit', 'delete'].includes(h.type));

    if (events.length === 0) {
      return <div className="empty-state">No activity yet.</div>;
    }

    return events.map((h, i) => {
      if (h.type === 'create') {
        return (
          <div key={i} className="history-item">
            <div className="history-item-row">
              <div><h4>Card Created</h4><p className="history-date">{new Date(h.date).toLocaleString()}</p></div>
              <span className="history-badge badge-create">Created</span>
            </div>
            <div className="history-card-detail detail-create">
              <div className="detail-q"><span className="detail-label ql">Q</span>{h.q}</div>
              <div className="detail-a"><span className="detail-label al">A</span>{h.a}</div>
            </div>
          </div>
        );
      }
      if (h.type === 'delete') {
        return (
          <div key={i} className="history-item">
            <div className="history-item-row">
              <div><h4>Card Deleted</h4><p className="history-date">{new Date(h.date).toLocaleString()}</p></div>
              <span className="history-badge badge-delete">Deleted</span>
            </div>
            <div className="history-card-detail detail-delete">
              <div className="detail-q"><span className="detail-label ql">Q</span>{h.q}</div>
              <div className="detail-a"><span className="detail-label al">A</span>{h.a}</div>
            </div>
          </div>
        );
      }
      if (h.type === 'edit') {
        return (
          <div key={i} className="history-item">
            <div className="history-item-row">
              <div><h4>Card Edited</h4><p className="history-date">{new Date(h.date).toLocaleString()}</p></div>
              <span className="history-badge badge-edit">Edited</span>
            </div>
            <div className="history-card-detail detail-edit">
              <div style={{ fontSize: '11px', color: '#6a6b99', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Before</div>
              <div className="detail-q"><span className="detail-label ql">Q</span>{h.oldQ}</div>
              <div className="detail-a"><span className="detail-label al">A</span>{h.oldA}</div>
              <div style={{ fontSize: '11px', color: '#6a6b99', margin: '7px 0 5px', textTransform: 'uppercase', letterSpacing: '1px' }}>After</div>
              <div className="detail-q"><span className="detail-label ql">Q</span>{h.newQ}</div>
              <div className="detail-a"><span className="detail-label al">A</span>{h.newA}</div>
            </div>
          </div>
        );
      }
      return null;
    });
  };

  return (
    <div className="app-container">
      <div className="app-wrapper">

        <div className="header">
          <div className="header-user">
            <div className="header-avatar">{username ? username[0].toUpperCase() : '?'}</div>
            <span className="header-username">{username}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
          <div className="header-title">
            <h1>KL <span>Learning App</span></h1>
            <p>Study smarter, remember more</p>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab-btn${activeTab === 'cards' ? ' active' : ''}`} onClick={() => setActiveTab('cards')}>My Cards</button>
          <button className={`tab-btn${activeTab === 'study' ? ' active' : ''}`} onClick={() => { setActiveTab('study'); setStudyPhase('idle'); }}>Study</button>
          <button className={`tab-btn${activeTab === 'history' ? ' active' : ''}`} onClick={() => { setActiveTab('history'); fetchHistory(); }}>History</button>
        </div>

        {/* ── My Cards tab ── */}
        {activeTab === 'cards' && (
          <div>
            <div className={`edit-label${editingId ? ' visible' : ''}`}>Editing card</div>

            <div className={`input-section${editingId ? ' edit-mode' : ''}`}>
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
              <button onClick={addFlashcard}>{editingId ? 'Save' : '+ Add'}</button>
              {editingId && <button className="btn-cancel" onClick={cancelEdit}>✕</button>}
            </div>

            <input
              type="text"
              className="search-box"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div>
              {loading ? (
                <div className="empty-state">Loading flashcards...</div>
              ) : filteredCards.length === 0 ? (
                <div className="empty-state">
                  {searchQuery ? 'No cards match your search.' : 'No flashcards yet. Add one above!'}
                </div>
              ) : (
                filteredCards.map((card) => (
                  <div key={card.id} className={`card-item${editingId === card.id ? ' editing' : ''}`}>
                    <div className="card-view">
                      <div className="card-texts">
                        <div className="card-field">
                          <span className="field-label q-label">Q</span>
                          <p className="card-question">{card.question}</p>
                        </div>
                        <div className="card-field">
                          <span className="field-label a-label">A</span>
                          <p className="card-answer">{card.answer}</p>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button className="text-btn edit" onClick={() => beginEdit(card)}>Edit</button>
                        <button className="text-btn delete" onClick={() => deleteFlashcard(card.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="stats">
              {!loading && flashcards.length > 0 && (
                flashcards.length === 1 ? '1 card total' : `${flashcards.length} cards total`
              )}
            </div>
          </div>
        )}

        {/* ── Study tab ── */}
        {activeTab === 'study' && (
          <div>
            {studyPhase === 'idle' && (
              <div>
                <div className="study-idle-header">
                  You have <strong>{flashcards.length}</strong> card{flashcards.length !== 1 ? 's' : ''} ready to study.
                </div>
                <div className="center-btn">
                  <button className="btn-primary" onClick={startStudy} disabled={flashcards.length === 0}>
                    Start Studying
                  </button>
                </div>
                {flashcards.length === 0 && <div className="empty-state">Add some cards first!</div>}
              </div>
            )}

            {studyPhase === 'session' && studyCards.length > 0 && (
              <div>
                <p id="progressLabel">Card {studyIndex + 1} of {studyCards.length}</p>
                <div className="progress-bg">
                  <div id="progressFill" className="progress-fill" style={{ width: `${((studyIndex + 1) / studyCards.length) * 100}%` }} />
                </div>

                <div
                  id="flashcardBox"
                  className={`flashcard-box${studyFlipped ? ' flipped' : ''}`}
                  onClick={() => setStudyFlipped((f) => !f)}
                >
                  <div className="flashcard-inner">
                    <div className="flashcard-front">
                      <span className="card-side-badge">Question</span>
                      <span className="card-main-text">{studyCards[studyIndex].question}</span>
                    </div>
                    <div className="flashcard-back">
                      <span className="card-side-badge">Answer</span>
                      <span className="card-main-text">{studyCards[studyIndex].answer}</span>
                    </div>
                  </div>
                </div>

                {!studyFlipped && <p className="flip-hint">Click card to flip</p>}

                <div className="study-controls">
                  <button className="btn-secondary" onClick={() => { setStudyIndex((i) => i - 1); setStudyFlipped(false); }} disabled={studyIndex === 0}>← Prev</button>
                  <button className="btn-primary" onClick={() => setStudyFlipped((f) => !f)}>Flip</button>
                  <button className="btn-secondary" onClick={() => { setStudyIndex((i) => i + 1); setStudyFlipped(false); }} disabled={studyIndex === studyCards.length - 1}>Next →</button>
                </div>
                <div className="center-btn">
                  <button className="btn-ghost" onClick={endStudy}>End Session</button>
                </div>
              </div>
            )}

            {studyPhase === 'done' && (
              <div className="session-done">
                <h2>Session Complete!</h2>
                <p>You reviewed {studyReviewed} of {studyCards.length} cards.</p>
                <button className="btn-primary" onClick={startStudy}>Study Again</button>
              </div>
            )}
          </div>
        )}

        {/* ── History tab ── */}
        {activeTab === 'history' && (
          <div>{renderHistory()}</div>
        )}

      </div>

      <div id="toast" className={`toast${toast.visible ? ' show' : ''}`}>{toast.message}</div>
    </div>
  );
}
