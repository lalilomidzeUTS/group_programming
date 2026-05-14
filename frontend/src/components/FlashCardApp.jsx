import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Check, X, Edit2 } from 'lucide-react';
import './FlashCardApp.css';

const API_URL = 'http://localhost:8000';

export default function FlashCardApp() {
  // --- AUTHENTICATION STATE ---
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

  const navigate = useNavigate();

  // --- STATE INITIALIZATION ---
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [inputAnswer, setInputAnswer] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  // --- REFS FOR User Experience ---
  const inputRef = useRef(null);

  // --- LOGOUT ---
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setToken('');
    setUsername('');
    setFlashcards([]);
    navigate('/login', { replace: true });
  };

  // --- EFFECTS ---
  // Fetch flashcards from server on initial mount
  useEffect(() => {
    if (token) {
      fetchFlashcards();
      inputRef.current?.focus();
    }
  }, [token]);

  // Update browser tab title when flashcards change
  useEffect(() => {
    const title = `Flashcards (${flashcards.length} cards)`;
    document.title = title;
  }, [flashcards]);

  // --- API FUNCTIONS ---
  const fetchFlashcards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/flashcards`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch flashcards');
      const data = await response.json();
      setFlashcards(data);
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      setFlashcards([]);
    } finally {
      setLoading(false);
    }
  };

  const addFlashcard = async () => {
  if (input.trim() && inputAnswer.trim()) {
    const newCard = {
      id: Date.now().toString(),
      question: input.trim(),
      answer: inputAnswer.trim(),
      isFlipped: false
    };

    try {
      const response = await fetch(`${API_URL}/flashcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newCard),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Full server error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Server error: ${JSON.stringify(errorData)}`);
      }
      
      const createdCard = await response.json();
      setFlashcards([...flashcards, createdCard]);
      setInput('');
      setInputAnswer('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error adding flashcard:', error);
      alert(`Failed to add flashcard: ${error.message}`);
    }
  }
};

  const toggleFlip = async (id) => {
    try {
      const response = await fetch(`${API_URL}/flashcards/${id}/flip`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to flip flashcard');
      const updatedCard = await response.json();
      setFlashcards(flashcards.map(card =>
        card.id === id ? updatedCard : card
      ));
    } catch (error) {
      console.error('Error flipping flashcard:', error);
      alert('Failed to flip flashcard. Please try again.');
    }
  };

  const deleteFlashcard = async (id) => {
    const cardToDelete = flashcards.find(card => card.id === id);
    if (window.confirm(`Are you sure you want to delete this flashcard?`)) {
      try {
        const response = await fetch(`${API_URL}/flashcards/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to delete flashcard');
        setFlashcards(flashcards.filter(card => card.id !== id));
      } catch (error) {
        console.error('Error deleting flashcard:', error);
        alert('Failed to delete flashcard. Please try again.');
      }
    }
  };

  const startEdit = (card) => {
    setEditingId(card.id);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
  };

  const saveEdit = async () => {
    if (editQuestion.trim() && editAnswer.trim()) {
      const updatedCard = {
        id: editingId,
        question: editQuestion.trim(),
        answer: editAnswer.trim(),
        isFlipped: flashcards.find(c => c.id === editingId)?.isFlipped || false
      };

      try {
        const response = await fetch(`${API_URL}/flashcards/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(updatedCard),
        });

        if (!response.ok) throw new Error('Failed to update flashcard');
        const updated = await response.json();
        setFlashcards(flashcards.map(card =>
          card.id === editingId ? updated : card
        ));
        setEditingId(null);
        setEditQuestion('');
        setEditAnswer('');
      } catch (error) {
        console.error('Error updating flashcard:', error);
        alert('Failed to update flashcard. Please try again.');
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQuestion('');
    setEditAnswer('');
  };

  return (
    <div className="app-container">
      <div className="app-wrapper">
        <div className="header">
          <h1 className="header-title">My Flashcards</h1>
          <span className={`status-badge ${token ? 'online' : 'offline'}`}>
            {token ? `● Connected as ${username}` : '● Offline'}
          </span>
        </div>

        {loading ? (
          <div className="loading-state">
            <p>Loading flashcards...</p>
          </div>
        ) : (
          <>
            <div className="input-section">
              <div className="input-group">
                <input
                  type="text"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addFlashcard()}
                  placeholder="Enter question..."
                  className="todo-input"
                  disabled={editingId !== null}
                />
                <input
                  type="text"
                  value={inputAnswer}
                  onChange={(e) => setInputAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addFlashcard()}
                  placeholder="Enter answer..."
                  className="todo-input"
                  disabled={editingId !== null}
                />
              </div>
              <button onClick={addFlashcard} className="add-button" disabled={editingId !== null}>
                <Plus size={20} />
                Add
              </button>
              <button className="cancel-button" onClick={handleLogout}>Logout</button>
            </div>

            <div className="todo-list">
              {flashcards.length === 0 ? (
                <div className="empty-state">
                  <p>No flashcards yet. Add one above!</p>
                </div>
              ) : (
                <ul className="todo-items">
                  {flashcards.map((card) => (
                    <li key={card.id} className="todo-item">
                      {editingId === card.id ? (
                        <div className="edit-mode">
                          <div className="edit-mode-inputs">
                            <input
                              type="text"
                              value={editQuestion}
                              onChange={(e) => setEditQuestion(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              placeholder="Question"
                              className="edit-input"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={editAnswer}
                              onChange={(e) => setEditAnswer(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              placeholder="Answer"
                              className="edit-input"
                            />
                          </div>
                          <button onClick={saveEdit} className="save-button">
                            <Check size={18} />
                          </button>
                          <button onClick={cancelEdit} className="cancel-button">
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            onClick={() => toggleFlip(card.id)}
                            className="flashcard-flip"
                          >
                            <div className={`flashcard-content ${card.isFlipped ? 'flipped' : ''}`}>
                              <div className="flashcard-inner">
                                <div className="flashcard-front">
                                  <p className="flashcard-label">Question</p>
                                  <p className="flashcard-text">{card.question}</p>
                                </div>
                                <div className="flashcard-back">
                                  <p className="flashcard-label">Answer</p>
                                  <p className="flashcard-text">{card.answer}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => startEdit(card)}
                            className="edit-button"
                            disabled={editingId !== null}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteFlashcard(card.id)}
                            className="delete-button"
                            disabled={editingId !== null}
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {flashcards.length > 0 && (
              <div className="stats">
                <span>{flashcards.length} flashcards in deck</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}