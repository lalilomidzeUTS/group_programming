import { useState, useEffect, useRef } from 'react'; // useState for local state, useEffect for side-effects/lifecycle, useRef for the toast timer
import { useNavigate } from 'react-router-dom'; // useNavigate for redirecting to login on session expiry
import './FlashCardApp.css'; // import the flashcard app styles
import { API_URL } from '../config'; // base URL of the FastAPI backend
import { handleError, logout } from '../utils'; // shared error handler and logout utility

export default function FlashCardApp() { // main flashcard management page shown to authenticated regular users
  const [token] = useState(localStorage.getItem('token')); // read the JWT once on mount; doesn't change during the session
  const [username] = useState(localStorage.getItem('username')); // read the stored display name for the header avatar

  const [flashcards, setFlashcards] = useState([]); // list of flashcard objects fetched from the server
  const [loading, setLoading] = useState(true); // true while the initial flashcard list is being loaded
  const [activeTab, setActiveTab] = useState('cards'); // which tab is active: 'cards', 'study', or 'history'
  const [history, setHistory] = useState([]); // list of history event objects for the History tab

  const [questionInput, setQuestionInput] = useState(''); // current value of the question text input
  const [answerInput, setAnswerInput] = useState(''); // current value of the answer text input
  const [editingId, setEditingId] = useState(null); // id of the card being edited; null means we're in "Add" mode

  const [searchQuery, setSearchQuery] = useState(''); // text typed in the search box; used to filter the displayed card list

  const [toast, setToast] = useState({ message: '', visible: false }); // toast notification: message text and visibility flag
  const toastTimer = useRef(null); // ref holding the setTimeout id for auto-dismissing the toast

  const [studyPhase, setStudyPhase] = useState('idle'); // study mode phase: 'idle' (not started), 'session' (in progress), 'done' (finished)
  const [studyCards, setStudyCards] = useState([]); // snapshot of flashcards taken at the start of a study session
  const [studyIndex, setStudyIndex] = useState(0); // index of the card currently shown in study mode
  const [studyFlipped, setStudyFlipped] = useState(false); // whether the current study card is showing the answer side
  const [studyReviewed, setStudyReviewed] = useState(0); // how many cards were reviewed when the session ended

  const navigate = useNavigate(); // navigation function for redirecting to login
  const authHeaders = { Authorization: `Bearer ${token}` }; // pre-built auth header used in every API fetch call

  useEffect(() => { fetchFlashcards(); }, []); // fetch the user's flashcards once when the component mounts
  useEffect(() => { document.title = `Flashcards (${flashcards.length} cards)`; }, [flashcards]); // update the browser tab title whenever the card count changes
  useEffect(() => () => clearTimeout(toastTimer.current), []); // cleanup: clear the toast timer on unmount to prevent memory leaks

  const showToast = (msg) => { // displays a toast notification that auto-hides after 2.2 seconds
    setToast({ message: msg, visible: true }); // set the message and show the toast
    clearTimeout(toastTimer.current); // cancel any running timer so a new toast doesn't disappear early
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200); // hide the toast after 2.2 s
  };

  const handleLogout = () => logout(navigate); // delegate to the shared logout utility

  const fetchHistory = async () => { // fetches the current user's activity history from the /history endpoint
    try {
      const res = await fetch(`${API_URL}/history`, { headers: authHeaders }); // GET the user's history
      if (res.ok) setHistory(await res.json()); // parse and store history events
      else await handleError(res, navigate, showToast); // handle errors (e.g. expired token)
    } catch { showToast('Could not reach the server.'); } // network error
  };

  const fetchFlashcards = async () => { // fetches the current user's flashcards from the /flashcards endpoint
    try {
      setLoading(true); // show the loading state while fetching
      const res = await fetch(`${API_URL}/flashcards`, { headers: authHeaders }); // GET all flashcards for this user
      if (res.ok) {
        setFlashcards(await res.json()); // parse and store the flashcard list
      } else {
        setFlashcards([]); // clear cards on error to avoid showing stale data
        await handleError(res, navigate, showToast); // handle API errors
      }
    } catch {
      setFlashcards([]); // clear cards on network error
      showToast('Could not reach the server.'); // notify the user
    } finally {
      setLoading(false); // always stop the loading state
    }
  };

  const addFlashcard = async () => { // handles both adding a new card and saving an edit depending on editingId
    const q = questionInput.trim(); // trim whitespace from the question input
    const a = answerInput.trim(); // trim whitespace from the answer input
    if (!q || !a) return showToast('Please fill in both fields.'); // validate: both fields must have content

    if (editingId !== null) { // we are saving an edit to an existing card
      const card = flashcards.find((c) => c.id === editingId); // find the original card to preserve its other fields
      try {
        const res = await fetch(`${API_URL}/flashcards/${editingId}`, { // PUT to update the existing card
          method: 'PUT', // HTTP PUT replaces the card content
          headers: { 'Content-Type': 'application/json', ...authHeaders }, // JSON body + auth header
          body: JSON.stringify({ ...card, question: q, answer: a }), // spread existing fields, override question and answer
        });
        if (res.ok) { cancelEdit(); fetchFlashcards(); showToast('Card updated'); } // exit edit mode, refresh list, notify
        else await handleError(res, navigate, showToast); // handle errors
      } catch { showToast('Could not reach the server.'); } // network error
    } else { // we are adding a new card
      try {
        // Timestamp string used as a simple unique ID; the backend stores it as-is
        const newId = Date.now().toString(); // generate a unique ID using the current timestamp
        const res = await fetch(`${API_URL}/flashcards`, { // POST to create a new card
          method: 'POST', // HTTP POST creates a new resource
          headers: { 'Content-Type': 'application/json', ...authHeaders }, // JSON body + auth header
          body: JSON.stringify({ id: newId, question: q, answer: a, isFlipped: false }), // new card payload with generated id
        });
        if (res.ok) { setQuestionInput(''); setAnswerInput(''); fetchFlashcards(); showToast('Card added'); } // clear inputs, refresh list, notify
        else await handleError(res, navigate, showToast); // handle errors
      } catch { showToast('Could not reach the server.'); } // network error
    }
  };

  const beginEdit = (card) => { // puts a card into edit mode: populates the inputs and scrolls to the top
    setEditingId(card.id); // mark this card's id as the one being edited so the input section shows edit-mode styles
    setQuestionInput(card.question); // pre-fill the question input with the card's current question
    setAnswerInput(card.answer); // pre-fill the answer input with the card's current answer
    window.scrollTo({ top: 0, behavior: 'smooth' }); // scroll to the input section so the user can see the edit form
  };

  const cancelEdit = () => { // exits edit mode and clears the input fields
    setEditingId(null); // back to "Add" mode
    setQuestionInput(''); // clear the question input
    setAnswerInput(''); // clear the answer input
  };

  const deleteFlashcard = async (id) => { // deletes a card after confirming with the user
    const card = flashcards.find((c) => c.id === id); // find the card to show its question in the confirmation dialog
    if (!window.confirm(`Delete "${card.question}"?`)) return; // ask the user to confirm before deleting
    if (editingId === id) cancelEdit(); // if this card was being edited, exit edit mode first
    try {
      const res = await fetch(`${API_URL}/flashcards/${id}`, { // DELETE request
        method: 'DELETE', // HTTP DELETE method
        headers: authHeaders, // auth header; no body needed
      });
      if (res.ok) { fetchFlashcards(); showToast('Card deleted'); } // refresh the list and notify
      else await handleError(res, navigate, showToast); // handle errors
    } catch { showToast('Could not reach the server.'); } // network error
  };

  const filteredCards = flashcards.filter((card) => { // compute the visible subset of cards based on the search query
    const query = searchQuery.toLowerCase(); // normalise the query to lowercase for case-insensitive matching
    return card.question.toLowerCase().includes(query) || card.answer.toLowerCase().includes(query); // include the card if either the question or answer contains the query string
  });

  // Study mode progresses through three phases: idle → session → done
  const startStudy = () => { // begins a new study session using a snapshot of the current flashcard list
    if (flashcards.length === 0) return; // can't start a session with no cards
    setStudyCards([...flashcards]); // take a snapshot so editing cards mid-session doesn't affect the deck
    setStudyIndex(0); // start at the first card
    setStudyFlipped(false); // start with the question side showing
    setStudyPhase('session'); // switch to the session phase
  };

  const endStudy = () => { // finishes the study session and shows the summary screen
    setStudyReviewed(studyIndex + 1); // record how many cards were reviewed (current index + 1 because index is 0-based)
    setStudyPhase('done'); // switch to the done phase
    showToast('Session complete'); // brief notification
  };

  // History render
  const renderHistory = () => { // builds the list of history event cards for the History tab
    const events = history.filter((h) => ['create', 'edit', 'delete'].includes(h.type)); // filter to only the three known event types

    if (events.length === 0) { // user has no recorded activity
      return <div className="empty-state">No activity yet.</div>; // empty state message
    }

    return events.map((event, i) => { // map each event to a JSX card element
      if (event.type === 'create') { // card creation event
        return (
          <div key={i} className="history-item"> {/* keyed by index since events have no stable id */}
            <div className="history-item-row"> {/* flex row with title/date on the left and badge on the right */}
              <div><h4>Card Created by User</h4><p className="history-date">{new Date(event.date).toLocaleString()}</p></div> {/* event title and formatted date */}
              <span className="history-badge badge-create">Created</span> {/* green badge */}
            </div>
            <div className="history-card-detail detail-create"> {/* card snapshot with green left border */}
              <div className="detail-q"><span className="detail-label q-label">Q</span>{event.q}</div> {/* question at creation time */}
              <div className="detail-a"><span className="detail-label a-label">A</span>{event.a}</div> {/* answer at creation time */}
            </div>
          </div>
        );
      }
      if (event.type === 'delete') { // card deletion event
        const deletedByAdmin = event.performed_by && event.performed_by !== event.user_id; // true when an admin (not the card owner) deleted this card
        return (
          <div key={i} className="history-item">
            <div className="history-item-row">
              <div>
                <h4>{deletedByAdmin ? 'Card Deleted by Admin' : 'Card Deleted by User'}</h4> {/* title reflects who performed the action */}
                <p className="history-date">{new Date(event.date).toLocaleString()}</p> {/* deletion event date */}
                {deletedByAdmin && ( // show the admin's email so the user knows exactly who deleted the card
                  <p className="admin-action-note">{event.performed_by}</p>
                )}
              </div>
              <span className="history-badge badge-delete">Deleted</span> {/* red badge */}
            </div>
            <div className="history-card-detail detail-delete"> {/* deleted card snapshot with red left border */}
              <div className="detail-q"><span className="detail-label q-label">Q</span>{event.q}</div> {/* question of the deleted card */}
              <div className="detail-a"><span className="detail-label a-label">A</span>{event.a}</div> {/* answer of the deleted card */}
            </div>
          </div>
        );
      }
      if (event.type === 'edit') { // card edit event
        const editedByAdmin = event.performed_by && event.performed_by !== event.user_id; // true when an admin (not the card owner) edited this card
        return (
          <div key={i} className="history-item">
            <div className="history-item-row">
              <div>
                <h4>{editedByAdmin ? 'Card Edited by Admin' : 'Card Edited by User'}</h4> {/* title reflects who performed the action */}
                <p className="history-date">{new Date(event.date).toLocaleString()}</p> {/* edit event date */}
                {editedByAdmin && ( // show the admin's email so the user knows exactly who edited the card
                  <p className="admin-action-note">{event.performed_by}</p>
                )}
              </div>
              <span className="history-badge badge-edit">Edited</span> {/* purple badge */}
            </div>
            <div className="history-card-detail detail-edit"> {/* before/after snapshot with purple left border */}
              <div className="detail-section-label">Before</div> {/* section label for old values */}
              <div className="detail-q"><span className="detail-label q-label">Q</span>{event.oldQ}</div> {/* old question */}
              <div className="detail-a"><span className="detail-label a-label">A</span>{event.oldA}</div> {/* old answer */}
              <div className="detail-section-label">After</div> {/* section label for new values */}
              <div className="detail-q"><span className="detail-label q-label">Q</span>{event.newQ}</div> {/* new question */}
              <div className="detail-a"><span className="detail-label a-label">A</span>{event.newA}</div> {/* new answer */}
            </div>
          </div>
        );
      }
      return null; // unknown event type: render nothing
    });
  };

  return (
    <div className="app-container"> {/* outer page container that centres the content */}
      <div className="app-wrapper"> {/* inner constrained-width wrapper for the page content */}

        <div className="header"> {/* page header with user avatar and app title */}
          <div className="header-user"> {/* fixed top-right user info: avatar, username, logout */}
            <div className="header-avatar">{username ? username[0].toUpperCase() : '?'}</div> {/* avatar circle showing the first letter of the username */}
            <span className="header-username">{username}</span> {/* display the full username */}
            <button className="logout-btn" onClick={handleLogout}>Logout</button> {/* logout button */}
          </div>
          <div className="header-title"> {/* centred app title and tagline */}
            <h1>KL <span>Learning App</span></h1> {/* app name; "Learning App" in purple */}
            <p>Study smarter, remember more</p> {/* tagline */}
          </div>
        </div>

        <div className="tabs"> {/* tab bar for switching between My Cards, Study, and History */}
          <button className={`tab-btn${activeTab === 'cards' ? ' active' : ''}`} onClick={() => setActiveTab('cards')}>My Cards</button> {/* My Cards tab */}
          <button className={`tab-btn${activeTab === 'study' ? ' active' : ''}`} onClick={() => { setActiveTab('study'); setStudyPhase('idle'); }}>Study</button> {/* Study tab; resets to idle phase each time it is opened */}
          <button className={`tab-btn${activeTab === 'history' ? ' active' : ''}`} onClick={() => { setActiveTab('history'); fetchHistory(); }}>History</button> {/* History tab; fetches latest history each time it is opened */}
        </div>

        {/* ── My Cards tab ── */}
        {activeTab === 'cards' && ( // only render this section when the My Cards tab is active
          <div>
            <div className={`edit-label${editingId ? ' visible' : ''}`}>Editing card</div> {/* "Editing card" label shown above the input section only when a card is being edited */}

            <div className={`input-section${editingId ? ' edit-mode' : ''}`}> {/* input row with add/edit form; gets a highlighted border in edit mode */}
              <input
                type="text" // single-line text input for the card question
                placeholder="Question..." // hint text
                value={questionInput} // controlled input bound to questionInput state
                onChange={(e) => setQuestionInput(e.target.value)} // update questionInput on every keystroke
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('answerInput').focus()} // pressing Enter in the question field moves focus to the answer field
              />
              <input
                id="answerInput" // id used by the question input's Enter handler to move focus here
                type="text" // single-line text input for the card answer
                placeholder="Answer..." // hint text
                value={answerInput} // controlled input bound to answerInput state
                onChange={(e) => setAnswerInput(e.target.value)} // update answerInput on every keystroke
                onKeyDown={(e) => e.key === 'Enter' && addFlashcard()} // pressing Enter in the answer field submits the form
              />
              <button onClick={addFlashcard}>{editingId ? 'Save' : '+ Add'}</button> {/* button label changes to "Save" when editing an existing card */}
              {editingId && <button className="btn-cancel" onClick={cancelEdit}>✕</button>} {/* cancel button only shown when in edit mode */}
            </div>

            <input
              type="text" // search box for filtering the card list
              className="search-box" // search box style
              placeholder="Search cards..." // hint text
              value={searchQuery} // controlled input bound to searchQuery state
              onChange={(e) => setSearchQuery(e.target.value)} // filter the card list on every keystroke
            />

            <div> {/* card list container */}
              {loading ? ( // show loading state while the initial fetch is in progress
                <div className="empty-state">Loading flashcards...</div>
              ) : filteredCards.length === 0 ? ( // no cards match the current state
                <div className="empty-state">
                  {searchQuery ? 'No cards match your search.' : 'No flashcards yet. Add one above!'} {/* different message depending on whether the user is searching or has no cards at all */}
                </div>
              ) : (
                filteredCards.map((card) => ( // render each visible flashcard as a card item
                  <div key={card.id} className={`card-item${editingId === card.id ? ' editing' : ''}`}> {/* 'editing' class highlights the card being edited */}
                    <div className="card-view"> {/* flex row with card text on the left and action buttons on the right */}
                      <div className="card-texts"> {/* question and answer text block */}
                        <div className="card-field"> {/* question row */}
                          <span className="field-label q-label">Q</span> {/* purple "Q" label badge */}
                          <p className="card-question">{card.question}</p> {/* the card's question text */}
                        </div>
                        <div className="card-field"> {/* answer row */}
                          <span className="field-label a-label">A</span> {/* green "A" label badge */}
                          <p className="card-answer">{card.answer}</p> {/* the card's answer text in muted purple */}
                        </div>
                      </div>
                      <div className="card-actions"> {/* Edit and Delete buttons */}
                        <button className="text-btn edit" onClick={() => beginEdit(card)}>Edit</button> {/* enter edit mode for this card */}
                        <button className="text-btn delete" onClick={() => deleteFlashcard(card.id)}>Delete</button> {/* delete this card after confirmation */}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="stats"> {/* card count summary below the list */}
              {!loading && flashcards.length > 0 && ( // only show stats once loaded and when there are cards
                flashcards.length === 1 ? '1 card total' : `${flashcards.length} cards total` // correct singular/plural
              )}
            </div>
          </div>
        )}

        {/* ── Study tab ── */}
        {activeTab === 'study' && ( // only render when the Study tab is active
          <div>
            {studyPhase === 'idle' && ( // idle phase: show card count and "Start Studying" button
              <div>
                <div className="study-idle-header">
                  You have <strong>{flashcards.length}</strong> card{flashcards.length !== 1 ? 's' : ''} ready to study. {/* card count with correct pluralisation */}
                </div>
                <div className="center-btn"> {/* centred button container */}
                  <button className="btn-primary" onClick={startStudy} disabled={flashcards.length === 0}> {/* disabled when there are no cards to study */}
                    Start Studying
                  </button>
                </div>
                {flashcards.length === 0 && <div className="empty-state">Add some cards first!</div>} {/* prompt to add cards when the deck is empty */}
              </div>
            )}

            {studyPhase === 'session' && studyCards.length > 0 && ( // session phase: show the interactive flashcard
              <div>
                <p id="progressLabel">Card {studyIndex + 1} of {studyCards.length}</p> {/* "Card X of Y" progress label */}
                <div className="progress-bg"> {/* grey progress bar track */}
                  <div id="progressFill" className="progress-fill" style={{ width: `${((studyIndex + 1) / studyCards.length) * 100}%` }} /> {/* purple fill sized proportionally to progress */}
                </div>

                <div
                  id="flashcardBox"
                  className={`flashcard-box${studyFlipped ? ' flipped' : ''}`} // 'flipped' triggers the CSS 3-D rotation to show the answer side
                  onClick={() => setStudyFlipped((f) => !f)} // clicking anywhere on the card toggles the flip state
                >
                  <div className="flashcard-inner"> {/* inner element that rotates in 3-D; both faces are positioned inside this */}
                    <div className="flashcard-front"> {/* question side of the card (visible when not flipped) */}
                      <span className="card-side-badge">Question</span> {/* "Question" label badge at the top of the card */}
                      <span className="card-main-text">{studyCards[studyIndex].question}</span> {/* question text of the current card */}
                    </div>
                    <div className="flashcard-back"> {/* answer side of the card (visible when flipped) */}
                      <span className="card-side-badge">Answer</span> {/* "Answer" label badge */}
                      <span className="card-main-text">{studyCards[studyIndex].answer}</span> {/* answer text of the current card */}
                    </div>
                  </div>
                </div>

                <p className="flip-hint">Click card to flip</p> {/* instruction hint below the card */}

                <div className="study-controls"> {/* navigation and flip buttons below the card */}
                  <button className="btn-secondary" onClick={() => { setStudyIndex((i) => i - 1); setStudyFlipped(false); }} disabled={studyIndex === 0}>← Prev</button> {/* go to previous card; disabled on the first card */}
                  <button className="btn-primary" onClick={() => setStudyFlipped((f) => !f)}>Flip</button> {/* flip the card programmatically */}
                  <button className="btn-secondary" onClick={() => { setStudyIndex((i) => i + 1); setStudyFlipped(false); }} disabled={studyIndex === studyCards.length - 1}>Next →</button> {/* go to next card; disabled on the last card */}
                </div>
                <div className="center-btn"> {/* centred "End Session" button below controls */}
                  <button className="btn-ghost" onClick={endStudy}>End Session</button> {/* end the session early and show the summary screen */}
                </div>
              </div>
            )}

            {studyPhase === 'done' && ( // done phase: show the session summary
              <div className="session-done">
                <h2>Session Complete!</h2> {/* congratulatory heading */}
                <p>You reviewed {studyReviewed} of {studyCards.length} cards.</p> {/* how many cards were seen */}
                <button className="btn-primary" onClick={startStudy}>Study Again</button> {/* restart a new session with the same deck */}
              </div>
            )}
          </div>
        )}

        {/* ── History tab ── */}
        {activeTab === 'history' && ( // only render when the History tab is active
          <div>{renderHistory()}</div> // render the list of history event cards
        )}

      </div>

      <div id="toast" className={`toast${toast.visible ? ' show' : ''}`}>{toast.message}</div> {/* fixed toast notification at the bottom; 'show' class fades it in via CSS */}
    </div>
  );
}
