import { useEffect, useRef, useState, useCallback } from 'react';
import { tutorAPI, type TutorResponse } from '../services/api';
import MathRenderer from './MathRenderer';
import { Send, Image as ImageIcon, History, PlusCircle, Brain } from 'lucide-react';

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

export function StudyCoach({
  isAuthenticated,
  guestChatsRemaining: _guestChatsRemaining,
  onRequireAuth: _onRequireAuth,
  onConsumeGuestChat,
  userId,
}: StudyCoachProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [historyItems, setHistoryItems] = useState<Array<{ id: number; content: string; created_at: string }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMainConceptOnly, setIsMainConceptOnly] = useState(true);
  const [allHistoryMessages, setAllHistoryMessages] = useState<any[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;

  // Load history
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
            subject: 'General',
            filename: image.name,
            content_type: image.type,
            is_main_concept_only: isMainConceptOnly,
            history: history
          })
        : await tutorAPI.ask({
            question: text,
            subject: 'General',
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
        text: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryClick = (clickedMsg: any) => {
    const clickedTime = new Date(clickedMsg.created_at).getTime();
    const thread = allHistoryMessages.filter(m => {
        const mTime = new Date(m.created_at).getTime();
        return Math.abs(clickedTime - mTime) < 1000 * 60 * 60 * 2;
    });

    const mapped = thread.map(m => ({
        id: m.id.toString(),
        sender: m.role === 'user' ? 'user' : 'ai' as 'user' | 'ai',
        text: m.content,
        response: m.role === 'ai' ? { explanation: m.content } : undefined
    }));

    setMessages(mapped);
  };

  return (
    <div className="gemini-shell">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="gemini-sidebar">
          <div style={{ padding: 24 }}>
            <button className="btn-premium btn-premium--primary w-full" onClick={newChat}>
              <PlusCircle size={18} /> New Chat
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
            {historyItems.map(m => (
              <button 
                key={m.id} 
                className="topbar__nav-btn w-full" 
                style={{ justifyContent: 'flex-start', textAlign: 'left', marginBottom: 4 }}
                onClick={() => { handleHistoryClick(m); setSidebarOpen(false); }}
              >
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.content}
                </div>
              </button>
            ))}
          </div>
        </aside>
      )}

      <div className="gemini-main">
        {/* Topbar inside chat */}
        <div className="gemini-toprow">
           <button className="topbar__nav-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
             <History size={18} /> History
           </button>
           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
                <input type="checkbox" checked={isMainConceptOnly} onChange={e => setIsMainConceptOnly(e.target.checked)} />
                Main Concept Only
             </label>
           </div>
        </div>

        <div className="gemini-messages">
          {!hasMessages && (
            <div className="gemini-welcome" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
              <div className="brand-mark" style={{ width: 80, height: 80, fontSize: '2.5rem', marginBottom: 30 }}>B</div>
              <h1 className="generator-title" style={{ fontSize: '3.5rem', marginBottom: 15 }}>Master Your Subjects</h1>
              <p className="generator-subtitle" style={{ fontSize: '1.4rem', maxWidth: 600, margin: '0 auto 40px auto' }}>Your AI-powered study companion is ready to help you excel.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, width: '100%', maxWidth: 700 }}>
                {STARTERS.map(s => (
                  <button key={s.text} className="glass-card" style={{ padding: 20, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 15, cursor: 'pointer' }} onClick={() => send(s.text)}>
                    <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
                    <span style={{ fontWeight: 600 }}>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`gemini-msg gemini-msg--${m.sender}`}>
              <div className="gemini-msg__avatar">
                {m.sender === 'ai' ? <Brain size={20} /> : <div style={{ fontSize: '0.8rem' }}>ME</div>}
              </div>
              <div className="gemini-msg__body">
                <div className={m.sender === 'user' ? 'gemini-msg__text' : ''}>
                  <MathRenderer text={m.text} />
                </div>
                {m.suggestions && m.suggestions.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    {m.suggestions.map((s, i) => (
                      <button key={i} className="topbar__nav-btn" style={{ fontSize: '0.75rem' }} onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
             <div className="gemini-msg gemini-msg--ai">
                <div className="gemini-msg__avatar">
                   <div className="gemini-thinking-blob" style={{ width: '100%', height: '100%', borderRadius: 'inherit', background: '#0f172a' }} />
                </div>
                <div className="gemini-thinking">
                   <span></span><span></span><span></span>
                </div>
             </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="gemini-input-wrap">
          <div className="gemini-input-bar">
            <button className="gemini-icon-btn" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={20} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setImage(e.target.files?.[0] ?? null)} />
            
            <textarea
              ref={textareaRef}
              className="gemini-textarea"
              placeholder="Ask anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <button 
              className={`gemini-send ${input.trim() || image ? 'gemini-send--active' : ''}`}
              onClick={() => send()}
              disabled={loading || (!input.trim() && !image)}
            >
              <Send size={20} />
            </button>
          </div>
          {image && (
             <div style={{ marginTop: 12, padding: '8px 16px', background: '#f1f5f9', borderRadius: 12, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                📎 {image.name}
                <button onClick={() => setImage(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
             </div>
          )}
          <p className="gemini-disclaimer">BroxStudies AI can make mistakes. Verify important info.</p>
        </div>
      </div>
    </div>
  );
}

export default StudyCoach;
