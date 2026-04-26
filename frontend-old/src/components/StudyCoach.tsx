import { useEffect, useRef, useState, useCallback } from 'react';
import { tutorAPI, type TutorResponse } from '../services/api';
import MathRenderer from './MathRenderer';
import { Send, Image as ImageIcon, History, PlusCircle, X, Calculator, Leaf, TrendingUp, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NyansapoIcon, AdinkraWatermark } from '@/components/ui/adinkra';

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
  { Icon: Calculator,   text: 'Solve 3x + 7 = 25 step by step' },
  { Icon: Leaf,         text: 'Explain photosynthesis in simple SHS language' },
  { Icon: TrendingUp,   text: 'WASSCE-style explanation of demand and supply' },
  { Icon: ImagePlus,    text: 'Interpret an image and show the working' },
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
      {/* Sidebar — docked on ≥900px, overlay drawer on mobile */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-[1400] bg-gh-ink/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="gemini-sidebar fixed left-0 top-0 z-[1450] h-dvh w-[85vw] max-w-[320px] lg:static lg:h-auto lg:w-[320px]"
            aria-label="Chat history"
          >
            <div className="flex items-center justify-between p-4 lg:hidden">
              <span className="text-sm font-bold tracking-tight text-gh-ink dark:text-gh-cream">
                Chat history
              </span>
              <Button
                onClick={() => setSidebarOpen(false)}
                variant="ghost"
                size="icon"
                aria-label="Close history"
              >
                <X size={18} />
              </Button>
            </div>
            <div className="px-4 pb-4 pt-0 lg:p-6">
              <Button onClick={newChat} className="w-full gap-2">
                <PlusCircle size={18} /> New Chat
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              {historyItems.length === 0 ? (
                <p className="px-3 text-xs text-gh-ink-40 dark:text-gh-chalk">
                  Your past chats will appear here once you send a few messages.
                </p>
              ) : (
                historyItems.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { handleHistoryClick(m); setSidebarOpen(false); }}
                    className="mb-1 block w-full truncate rounded-lg px-3 py-2.5 text-left text-sm text-gh-ink-60 transition-colors hover:bg-gh-ink-blue-50 hover:text-gh-ink-blue dark:text-gh-chalk dark:hover:bg-white/5 dark:hover:text-gh-cream"
                    title={m.content}
                  >
                    {m.content}
                  </button>
                ))
              )}
            </div>
          </aside>
        </>
      )}

      <div className="gemini-main">
        {/* Topbar inside chat */}
        <div className="gemini-toprow">
          <Button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            variant="ghost"
            size="sm"
            className="gap-2"
          >
            <History size={16} /> History
          </Button>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-gh-ink-60 dark:text-gh-chalk sm:text-sm">
            <input
              type="checkbox"
              checked={isMainConceptOnly}
              onChange={e => setIsMainConceptOnly(e.target.checked)}
              className="h-4 w-4 accent-gh-ink-blue dark:accent-gh-gold-glow"
            />
            Main Concept Only
          </label>
        </div>

        <div className="gemini-messages">
          {!hasMessages && (
            <div className="relative flex h-full flex-col items-center justify-center px-4 text-center">
              <AdinkraWatermark
                symbol={NyansapoIcon}
                className="text-gh-ink-blue dark:text-gh-gold-glow"
                opacity={0.04}
              />
              <div className="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gh-ink-blue text-gh-gold-glow shadow-brand-md sm:mb-8 sm:h-20 sm:w-20">
                <NyansapoIcon size={38} />
              </div>
              <div className="study-empty-eyebrow relative z-10">
                SHS Revision • WASSCE Prep • Homework Help
              </div>
              <h1 className="relative z-10 mb-3 text-3xl font-extrabold tracking-tight text-gh-ink dark:text-gh-cream sm:text-4xl lg:text-5xl">
                Study Smarter, One Topic at a Time
              </h1>
              <p className="relative z-10 mb-8 max-w-xl text-base leading-relaxed text-gh-ink-60 dark:text-gh-chalk sm:mb-10 sm:text-lg">
                Ask for clear explanations, worked examples, quiz practice, and simple student-friendly breakdowns for your subjects.
              </p>

              <div className="relative z-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {STARTERS.map(({ Icon, text }) => (
                  <button
                    key={text}
                    onClick={() => send(text)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gh-chalk bg-gh-paper p-4 text-left shadow-brand-sm transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:border-gh-ink-blue/20 hover:shadow-brand-md dark:border-white/10 dark:bg-gh-night-raised sm:gap-4 sm:p-5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gh-ink-blue-50 text-gh-ink-blue dark:bg-white/5 dark:text-gh-gold-glow">
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    <span className="text-sm font-semibold text-gh-ink dark:text-gh-cream sm:text-base">
                      {text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`gemini-msg gemini-msg--${m.sender}`}>
              <div className="gemini-msg__avatar">
                {m.sender === 'ai' ? <NyansapoIcon size={20} /> : <div style={{ fontSize: '0.8rem' }}>ME</div>}
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
              <div className="gemini-msg__avatar bg-gh-ink-blue text-gh-gold-glow dark:bg-gh-gold-glow dark:text-gh-ink">
                <NyansapoIcon size={22} />
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
              placeholder="Ask a topic, homework question, or WASSCE concept..."
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
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-gh-ink-blue-50 px-3 py-1.5 text-xs font-semibold text-gh-ink-blue dark:bg-white/5 dark:text-gh-ink-blue-50">
              <ImageIcon size={14} />
              <span className="max-w-[200px] truncate sm:max-w-[280px]">{image.name}</span>
              <button
                onClick={() => setImage(null)}
                aria-label="Remove attached image"
                className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-gh-ink-blue/15 dark:hover:bg-white/10"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <p className="gemini-disclaimer">BroxStudies AI can make mistakes. Verify important info.</p>
        </div>
      </div>
    </div>
  );
}

export default StudyCoach;
