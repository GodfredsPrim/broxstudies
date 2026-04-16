import { useEffect, useRef, useState, useCallback } from 'react';
import { questionsAPI, tutorAPI, type TutorResponse } from '../services/api';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  response?: TutorResponse;
  suggestions?: string[];
}

interface StudyCoachProps {
  isAuthenticated: boolean;
  guestChatsRemaining: number;
  guestChatLimit: number;
  onRequireAuth: () => void;
  onConsumeGuestChat: () => boolean;
  userId: number | null;
}

const STARTERS = [
  { icon: '📐', text: 'Solve 3x + 7 = 25 step by step' },
  { icon: '🌿', text: 'Explain photosynthesis in simple SHS language' },
  { icon: '📈', text: 'WASSCE-style explanation of demand and supply' },
  { icon: '🖼️', text: 'Interpret an image and show the working' },
];

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return window.btoa(binary);
}

function AIMessage({ response }: { response: TutorResponse }) {
  const isDefinition = response.mode === 'core_concept';

  return (
    <div className={`ai-response ${isDefinition ? 'ai-response--definition' : ''}`}>
      <p className="ai-response__main">{response.explanation}</p>

      {!isDefinition && response.extracted_text && (
        <div className="ai-response__block">
          <span className="ai-response__label">Extracted question</span>
          <p>{response.extracted_text}</p>
        </div>
      )}

      {!isDefinition && response.steps && response.steps.length > 0 && (
        <div className="ai-response__block">
          <span className="ai-response__label">Step-by-step</span>
          <ol className="ai-response__steps">
            {response.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      {!isDefinition && response.study_tips && response.study_tips.length > 0 && (
        <div className="ai-response__block">
          <span className="ai-response__label">Study tips</span>
          <ul className="ai-response__tips">
            {response.study_tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {response.confidence_note && (
        <p className="ai-response__note">{response.confidence_note}</p>
      )}
    </div>
  );
}

export function StudyCoach({
  isAuthenticated,
  guestChatsRemaining,
  onRequireAuth,
  onConsumeGuestChat,
  userId,
}: StudyCoachProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('General');
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string; year: string }>>([]);
  const [image, setImage] = useState<File | null>(null);
  const [historyItems, setHistoryItems] = useState<Array<{ id: number; content: string; created_at: string }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMainConceptOnly, setIsMainConceptOnly] = useState(true);
  const [allHistoryMessages, setAllHistoryMessages] = useState<any[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    questionsAPI.getSubjects()
      .then(d => setSubjects(d.subjects || []))
      .catch(() => {});
  }, []);

  // Load history for authenticated users
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    tutorAPI.getHistory(60)
      .then(d => {
        const msgs = d.messages || [];
        setAllHistoryMessages(msgs);
        setHistoryItems(msgs.filter(m => m.role === 'user').slice(-30).reverse());
      })
      .catch(() => {});
  }, [isAuthenticated, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [input]);

  const newChat = useCallback(() => {
    setMessages([]);
    setInput('');
    setImage(null);
    setSidebarOpen(false);
  }, []);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if ((!text && !image) || loading) return;

    if (!isAuthenticated && !onConsumeGuestChat()) return;

    const userText = image ? `${text || 'Interpret this image.'}\n[Image: ${image.name}]` : text;

    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    const history = messages.slice(-6).map(m => ({
      role: m.sender === 'user' ? 'user' : 'ai',
      content: m.text
    }));

    try {
      const res = image
        ? await tutorAPI.interpretImage({
            image_base64: await fileToBase64(image),
            question: text || 'Interpret this image.',
            subject: subject,
            filename: image.name,
            content_type: image.type,
            is_main_concept_only: isMainConceptOnly,
            history: history
          })
        : await tutorAPI.ask({
            question: text,
            subject: subject,
            is_main_concept_only: isMainConceptOnly,
            history: history
          });

      setMessages(prev => [...prev, {
        id: Date.now() + '-ai',
        sender: 'ai',
        text: res.explanation,
        response: res,
        suggestions: res.related_questions?.slice(0, 3) ?? [],
      }]);
      setImage(null);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + '-err',
        sender: 'ai',
        text: '',
        response: { explanation: "Sorry, something went wrong. Please try again." },
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryClick = (clickedMsg: any) => {
    // Find messages in the same conversation "thread"
    // Heuristic: group by subject and proximity in time (e.g., within 30 mins)
    const clickedTime = new Date(clickedMsg.created_at).getTime();
    
    // Simplest: load all history in chronological order that leads up to and follows this message
    // but filtered by the same subject if available.
    const thread = allHistoryMessages.filter(m => {
        if (clickedMsg.subject && m.subject !== clickedMsg.subject) return false;
        const mTime = new Date(m.created_at).getTime();
        return Math.abs(clickedTime - mTime) < 1000 * 60 * 60 * 2; // 2 hour window
    });

    const mapped = thread.map(m => ({
        id: m.id.toString(),
        sender: m.role === 'user' ? 'user' : 'ai' as 'user' | 'ai',
        text: m.content,
        // We don't have the full response object in history but we can show the text
        response: m.role === 'ai' ? { explanation: m.content } : undefined
    }));

    setMessages(mapped);
    if (clickedMsg.subject) setSubject(clickedMsg.subject);
  };

  return (
    <div className="gemini-shell">

      {/* ── Thin history sidebar ──────────────────────────────── */}
      {sidebarOpen && (
        <aside className="gemini-sidebar">
          <div className="gemini-sidebar__head">
            <span>Chat history</span>
            <button className="gemini-sidebar__close" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
          <button className="gemini-sidebar__new" onClick={newChat}>+ New chat</button>
          {historyItems.length === 0 && (
            <p className="gemini-sidebar__empty">No history yet.</p>
          )}
          {historyItems.map(m => (
            <button 
              key={m.id} 
              className="gemini-sidebar__item" 
              onClick={() => { handleHistoryClick(m); setSidebarOpen(false); }}
            >
              {m.content.slice(0, 48)}{m.content.length > 48 ? '…' : ''}
            </button>
          ))}
        </aside>
      )}

      {/* ── Main chat area ───────────────────────────────────── */}
      <div className="gemini-main">

        {/* Top-left controls */}
        <div className="gemini-toprow">
          <div className="gemini-toprow__left">
            {isAuthenticated && (
              <button className="gemini-icon-btn" onClick={() => setSidebarOpen(v => !v)} title="Chat history">
                <HistoryIcon />
              </button>
            )}
            {hasMessages && (
              <button className="gemini-icon-btn" onClick={newChat} title="New chat">
                <NewChatIcon />
              </button>
            )}
          </div>
          <div className="gemini-toprow__right">
            <label className="gemini-toggle" title="Focus on core concept only (shorter answers)">
              <input 
                type="checkbox" 
                checked={isMainConceptOnly} 
                onChange={(e) => setIsMainConceptOnly(e.target.checked)} 
              />
              <span className="gemini-toggle__slider"></span>
              <span className="gemini-toggle__label">Main Concept Only</span>
            </label>
            {!isAuthenticated && (
              <span className="gemini-guest-chip" onClick={onRequireAuth}>
                {guestChatsRemaining} free {guestChatsRemaining === 1 ? 'chat' : 'chats'} left · Sign up
              </span>
            )}
          </div>
        </div>

        {/* Welcome screen — shown when no messages */}
        {!hasMessages && (
          <div className="gemini-welcome">
            <div className="gemini-welcome__logo">
              <div className="gemini-welcome__mark">B</div>
            </div>
            <h1 className="gemini-welcome__title">How can I help you study?</h1>
            <p className="gemini-welcome__sub">Ask a question, upload an image, or pick a starter below.</p>

            <div className="gemini-starters">
              {STARTERS.map(s => (
                <button key={s.text} className="gemini-starter" onClick={() => send(s.text)}>
                  <span className="gemini-starter__icon">{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {hasMessages && (
          <div className="gemini-messages">
            {messages.map(m => (
              <div key={m.id} className={`gemini-msg gemini-msg--${m.sender}`}>
                {m.sender === 'ai' && (
                  <div className="gemini-msg__avatar">B</div>
                )}
                <div className="gemini-msg__body">
                  {m.sender === 'ai' && m.response
                    ? <AIMessage response={m.response} />
                    : <p className="gemini-msg__text">{m.text}</p>
                  }
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="gemini-follow">
                      {m.suggestions.map((s, i) => (
                        <button key={i} className="gemini-follow__chip" onClick={() => send(s)}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="gemini-msg gemini-msg--ai">
                <div className="gemini-msg__avatar">B</div>
                <div className="gemini-thinking">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input bar */}
        <div className="gemini-input-wrap">
          {image && (
            <div className="gemini-image-chip">
              <span>📎 {image.name}</span>
              <button onClick={() => setImage(null)}>✕</button>
            </div>
          )}

          <div className="gemini-input-bar">
            {/* Subject pill */}
            <select
              className="gemini-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              title="Choose subject"
            >
              <option value="General">General</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <textarea
              ref={textareaRef}
              className="gemini-textarea"
              placeholder="Ask BisaME Tutor anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />

            {/* Image attach */}
            <button
              className="gemini-icon-btn gemini-attach"
              onClick={() => fileRef.current?.click()}
              title="Attach image"
            >
              <AttachIcon />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => setImage(e.target.files?.[0] ?? null)}
            />

            {/* Send */}
            <button
              className={`gemini-send ${(input.trim() || image) ? 'gemini-send--active' : ''}`}
              onClick={() => send()}
              disabled={loading || (!input.trim() && !image)}
            >
              <SendIcon />
            </button>
          </div>

          <p className="gemini-disclaimer">BisaME can make mistakes. Verify important answers.</p>
        </div>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14" />
      <path d="M3.05 11a9 9 0 1 0 .5-4.1" />
      <polyline points="3 7 3 11 7 11" />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export default StudyCoach;
