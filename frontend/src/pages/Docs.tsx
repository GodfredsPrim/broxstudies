import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, Search, Rocket, Users, Brain, Trophy,
  Server, ShieldCheck, TestTube2, Wrench, ChevronRight, ExternalLink,
  Copy, Check, AlertTriangle, Database, Settings,
} from 'lucide-react'

type DocSection = {
  id: string
  title: string
  description: string
  icon: typeof BookOpen
  keywords: string
  content: React.ReactNode
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div className="relative my-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-0)]">
      <button onClick={() => void copy()} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-[var(--bg-1)] text-[var(--fg-2)] hover:text-indigo-400" aria-label="Copy code">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre className="overflow-x-auto p-4 pr-12 text-xs leading-6 text-[var(--fg-1)]"><code>{children}</code></pre>
    </div>
  )
}

function Callout({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  return <div className={`my-4 flex gap-3 rounded-xl border px-4 py-3 text-sm leading-6 ${tone === 'warning' ? 'border-amber-400/25 bg-amber-400/10 text-amber-200' : 'border-indigo-400/25 bg-indigo-500/10 text-[var(--fg-1)]'}`}><AlertTriangle size={16} className="mt-1 shrink-0" /> <div>{children}</div></div>
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-7 text-base font-semibold text-[var(--fg-0)]">{children}</h3>
}

function Steps({ items }: { items: Array<{ title: string; body: React.ReactNode }> }) {
  return <ol className="my-4 space-y-4">{items.map((item, index) => <li key={item.title} className="grid grid-cols-[28px_1fr] gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/10 text-xs font-bold text-indigo-400">{index + 1}</span><div><div className="font-semibold text-[var(--fg-1)]">{item.title}</div><div className="mt-1 text-sm leading-6 text-[var(--fg-2)]">{item.body}</div></div></li>)}</ol>
}

export function DocsPage() {
  const [query, setQuery] = useState('')
  const sections: DocSection[] = useMemo(() => [
    {
      id: 'overview', title: 'Project overview', description: 'What BroxStudies is and how the system fits together.', icon: BookOpen, keywords: 'overview architecture students ghana shs tvet purpose',
      content: <>
        <p>BroxStudies is an AI-assisted learning platform for SHS/STEM and TVET learners. It combines source-grounded tutoring, practice generation, exam preparation, live challenges, learning analytics, a digital library, subscription management, and administration in one responsive web application.</p>
        <H3>Core architecture</H3>
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-[var(--fg-3)]"><th className="py-2 pr-4">Layer</th><th className="py-2 pr-4">Technology</th><th className="py-2">Responsibility</th></tr></thead><tbody className="divide-y divide-[var(--line)] text-[var(--fg-2)]"><tr><td className="py-3 pr-4 font-medium text-[var(--fg-1)]">Frontend</td><td className="py-3 pr-4">React 18, TypeScript, Vite, Tailwind</td><td className="py-3">SPA, PWA, student and admin interfaces</td></tr><tr><td className="py-3 pr-4 font-medium text-[var(--fg-1)]">Backend</td><td className="py-3 pr-4">FastAPI, Python</td><td className="py-3">Authentication, AI orchestration, files, payments and APIs</td></tr><tr><td className="py-3 pr-4 font-medium text-[var(--fg-1)]">Persistence</td><td className="py-3 pr-4">SQLite locally, PostgreSQL in production</td><td className="py-3">Users, subscriptions, history, progress and content</td></tr><tr><td className="py-3 pr-4 font-medium text-[var(--fg-1)]">AI retrieval</td><td className="py-3 pr-4">LLM provider, embeddings, vector store</td><td className="py-3">Grounded answers, question generation and analysis</td></tr></tbody></table></div>
        <H3>Request flow</H3><p>A user action begins in the React client, passes through the typed API layer to a FastAPI route, and is delegated to a focused backend service. Protected operations validate the bearer token and, where required, the subscription. AI operations assemble curriculum, retrieval, uploaded-source, or conversation context before calling the configured model.</p>
      </>,
    },
    {
      id: 'student-guide', title: 'Student guide', description: 'The complete learner workflow from signup to revision.', icon: Users, keywords: 'student signup login track dashboard study practice quiz library history analytics',
      content: <>
        <Steps items={[{ title: 'Create or access an account', body: 'Sign up with the available identity method, verify the account if requested, then sign in.' }, { title: 'Choose an academic track', body: 'Select SHS/STEM or TVET. The track controls subjects, terminology, and exam-preparation experiences.' }, { title: 'Activate access', body: 'Use a valid access code or complete the available mobile-money payment flow. Public and guest areas remain available according to their gate rules.' }, { title: 'Start learning', body: 'Use the AI Tutor, Source Studio, Practice Questions, Likely WASSCE/NAPTEX, Quiz Challenge, Library, and News areas.' }, { title: 'Review progress', body: 'History stores previous learning activity while Analytics, XP, levels, streaks, coins, and badges make progress visible.' }]} />
        <H3>Navigation</H3><p><strong>Dashboard</strong> gives an overview. <strong>AI Tutor</strong> handles open questions and uploaded sources. <strong>Practice Questions</strong> generates tailored work. <strong>Likely WASSCE/NAPTEX</strong> uses past-paper intelligence. <strong>Quiz Challenge</strong> supports timed rooms. <strong>Library</strong> supports reading discovery. <strong>History</strong> restores prior work. <strong>Analytics</strong> explains performance.</p>
      </>,
    },
    {
      id: 'ai-study', title: 'AI Tutor and Source Studio', description: 'Chat, upload sources, and create NotebookLM-style study resources.', icon: Brain, keywords: 'ai tutor notebooklm sources upload pdf docx flashcards quiz faq briefing image voice',
      content: <>
        <p>The study workspace supports ordinary chat, streamed answers, voice input, conversation history, and file-grounded learning. Supported sources include PDF, DOCX, TXT, Markdown, and common image formats.</p>
        <H3>Source Studio workflow</H3><Steps items={[{ title: 'Add sources', body: 'Choose one or more study files. Each file may be up to 8 MB, with a 24 MB combined request limit.' }, { title: 'Choose an output', body: 'Generate a study guide, flashcards, mixed quiz, FAQ, or exam-ready briefing note.' }, { title: 'Continue the conversation', body: 'Ask follow-up questions, request simpler explanations, or compare ideas from the same sources.' }, { title: 'Check grounding', body: 'Generated materials are prompted to use only uploaded content and identify filenames or source sections where possible.' }]} />
        <Callout>Scanned or photographed material depends on image-model capability and image clarity. Text PDFs and DOCX files provide the most reliable grounding.</Callout>
        <H3>File processing</H3><p>Files are validated by type and signature. PDFs are temporarily processed into text chunks, DOCX paragraphs and text files are extracted directly, and images are sent as vision inputs. Extracted text is capped to control model context and latency.</p>
      </>,
    },
    {
      id: 'features', title: 'Learning features', description: 'Practice, exams, quizzes, library, analytics and gamification.', icon: Trophy, keywords: 'features practice wassce naptex quiz library analytics gamification news rankings',
      content: <>
        <H3>Practice and marking</H3><p>Students can generate multiple-choice, short-answer, essay, true/false, and standard question formats by subject, topic, year, difficulty, and quantity. Submitted answers can be marked with expected answers, explanations, scores, and feedback.</p>
        <H3>Exam intelligence</H3><p>The WASSCE/NAPTEX preparation area uses historical patterns, curriculum context, and subject-specific generation services. Confidence and source details should be treated as preparation guidance, not a guarantee of future examination content.</p>
        <H3>Live quizzes and competition</H3><p>Quiz Challenge can create timed rooms, accept player joins, submit answers, and maintain leaderboard-style results. Competition and ranking areas add scheduled activities and broader engagement.</p>
        <H3>Library and progress</H3><p>The library combines local resources with discovery services. Reading and study progress feed history, analytics, streaks, XP, coins, levels, and badges. Offline history and PWA behavior improve continuity on constrained connections.</p>
      </>,
    },
    {
      id: 'setup', title: 'Local development', description: 'Install and run the complete system on a developer machine.', icon: Rocket, keywords: 'setup install python node npm powershell uvicorn localhost development',
      content: <>
        <H3>Prerequisites</H3><p>Install Python 3.9 or newer, Node.js 18 or newer, npm, and Git. A configured LLM API key is required for AI features.</p>
        <H3>Quick start on Windows</H3><CodeBlock>{`# From the repository root
.\\start_system.ps1

# Useful alternatives
.\\start_system.ps1 -SkipInstall
.\\start_system.ps1 -BackendOnly
.\\start_system.ps1 -FrontendOnly`}</CodeBlock>
        <H3>Manual backend setup</H3><CodeBlock>{`cd backend
python -m venv venv
.\\venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000`}</CodeBlock>
        <H3>Manual frontend setup</H3><CodeBlock>{`cd frontend
npm install
npm run dev`}</CodeBlock>
        <p>The Vite development client runs locally and calls the FastAPI API. In production, FastAPI serves the built files from <code>frontend/dist</code>.</p>
      </>,
    },
    {
      id: 'configuration', title: 'Configuration reference', description: 'Environment variables grouped by responsibility.', icon: Settings, keywords: 'env configuration openai deepseek database auth google moolre paystack cors embedding',
      content: <>
        <Callout tone="warning"><strong>Never commit real credentials.</strong> Replace default secrets in every deployed environment and keep <code>backend/.env</code> outside version control.</Callout>
        <H3>AI provider</H3><p><code>OPENAI_API_KEY</code>, <code>OPENAI_BASE_URL</code>, and <code>OPENAI_MODEL</code> configure OpenAI-compatible access. DeepSeek has corresponding variables. Generic <code>LLM_API_KEY</code>, <code>LLM_BASE_URL</code>, and <code>LLM_MODEL</code> override provider-specific resolution. <code>LLM_FALLBACK_ENABLED</code> controls fallback behavior.</p>
        <H3>Data and authentication</H3><p><code>DATABASE_URL</code> selects PostgreSQL; without it, local SQLite persistence is used. Configure <code>AUTH_SECRET_KEY</code>, token expiry, Google credentials, administrator credentials, and the admin secret. Production secrets must be long, unique, and randomly generated.</p>
        <H3>Payments and messaging</H3><p>Moolre payment uses <code>MOOLRE_API_USER</code>, <code>MOOLRE_API_KEY</code>, <code>MOOLRE_ACCOUNT_NUMBER</code>, and <code>MOOLRE_PAYMENT_ENABLED</code>. SMS uses <code>MOOLRE_VAS_KEY</code>, sender ID, API base URL, and <code>SMS_ENABLED</code>. Paystack variables remain available as a rollback path. <code>PUBLIC_APP_URL</code> must match the deployed application.</p>
        <H3>Retrieval and loading</H3><p>Upload, data, resource, vector-store, chunk-size, overlap, embedding-model, and startup-loading variables control local paths and knowledge initialization. CORS origins must list only trusted frontend origins in production.</p>
      </>,
    },
    {
      id: 'api', title: 'Backend API map', description: 'The major FastAPI route families and their responsibilities.', icon: Server, keywords: 'api endpoints swagger openapi auth tutor uploads questions analysis resources books payments admin',
      content: <>
        <p>FastAPI exposes its interactive OpenAPI explorer at <a className="text-indigo-400 hover:underline" href="/api/docs" target="_blank" rel="noreferrer">/api/docs</a>. The raw schema remains available at <a className="text-indigo-400 hover:underline" href="/openapi.json" target="_blank" rel="noreferrer">/openapi.json</a>.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-[var(--fg-3)]"><th className="py-2 pr-4">Prefix</th><th className="py-2">Purpose</th></tr></thead><tbody className="divide-y divide-[var(--line)] text-[var(--fg-2)]">{[['/api/auth','Signup, login, social auth, OTP, account and progress'],['/api/tutor','Chat, streaming, attachments and chat history'],['/api/questions','Question generation, marking, subjects and history'],['/api/analysis','Pattern, topic and retrieval-index analysis'],['/api/uploads','Administrative PDF ingestion and upload status'],['/api/resources','Curriculum resource discovery and loading'],['/api/books','Library search, metadata and reading resources'],['/api/payments','Subscription, Moolre, Paystack and payment status'],['/api/admin','Administration, content, users and reporting']].map(([prefix,purpose]) => <tr key={prefix}><td className="py-3 pr-4 font-mono text-xs text-indigo-400">{prefix}</td><td className="py-3">{purpose}</td></tr>)}</tbody></table></div>
        <H3>Authentication convention</H3><CodeBlock>{`Authorization: Bearer <access-token>
Content-Type: application/json`}</CodeBlock><p>Multipart upload endpoints use <code>multipart/form-data</code>. The frontend API wrapper automatically attaches the stored token.</p>
      </>,
    },
    {
      id: 'security', title: 'Security and data handling', description: 'Authentication, uploads, permissions and production safeguards.', icon: ShieldCheck, keywords: 'security privacy file validation subscription bearer admin secrets cors webhook',
      content: <>
        <p>Protected routes validate bearer tokens and subscription state. Admin routes additionally require administrator authorization. Uploaded learning files enforce size, MIME, filename, and file-signature checks before processing.</p>
        <H3>Production checklist</H3><ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--fg-2)]"><li>Replace all default auth, administrator, and integration secrets.</li><li>Restrict CORS origins and configure HTTPS.</li><li>Use managed PostgreSQL with backups and least-privilege credentials.</li><li>Keep provider keys server-side and redact sensitive logs.</li><li>Verify payment status and amount server-side before fulfillment.</li><li>Apply retention and privacy rules to chat history, uploads, phone numbers, and analytics.</li><li>Monitor rate limits, authentication failures, model cost, and upload abuse.</li></ul>
      </>,
    },
    {
      id: 'testing', title: 'Testing and quality', description: 'Commands and checks used before release.', icon: TestTube2, keywords: 'test typecheck build pytest vitest quality release',
      content: <>
        <H3>Frontend</H3><CodeBlock>{`cd frontend
npm run typecheck
npm run test
npm run build`}</CodeBlock>
        <H3>Backend</H3><CodeBlock>{`cd backend
pytest`}</CodeBlock>
        <p>Before deployment, test signup and login, track selection, subscription gates, source uploads, AI generation, answer marking, payments, SMS/OTP, admin access, mobile layout, theme switching, offline handling, and the production SPA fallback.</p>
      </>,
    },
    {
      id: 'deployment', title: 'Deployment', description: 'Build and operate the unified production application.', icon: Database, keywords: 'deployment docker render postgres build production health',
      content: <>
        <p>The repository contains a unified <code>Dockerfile</code> and <code>render.yaml</code>. The production build compiles the Vite frontend, installs backend dependencies, and runs FastAPI, which serves both API routes and the SPA fallback.</p>
        <Steps items={[{ title: 'Provision persistence', body: 'Create PostgreSQL and set DATABASE_URL. Configure durable storage where local resources or uploads must survive restarts.' }, { title: 'Set production secrets', body: 'Configure AI, authentication, payments, SMS, public URL, CORS, and administrator variables in the host secret manager.' }, { title: 'Build and deploy', body: 'Deploy from the repository root using the Dockerfile or Render blueprint.' }, { title: 'Verify health', body: 'Check the health endpoint, open the SPA, authenticate, run a small AI request, and verify payment callbacks from the public URL.' }, { title: 'Observe', body: 'Monitor API errors, database connections, provider failures, latency, model consumption, and webhook delivery.' }]} />
      </>,
    },
    {
      id: 'troubleshooting', title: 'Troubleshooting', description: 'Common local and production failure modes.', icon: Wrench, keywords: 'troubleshooting error cors database model payment sms upload blank page',
      content: <>
        <div className="space-y-5 text-sm leading-6 text-[var(--fg-2)]"><div><strong className="text-[var(--fg-1)]">AI requests fail:</strong> confirm a resolved API key/model pair, provider base URL, account quota, and backend logs.</div><div><strong className="text-[var(--fg-1)]">Frontend cannot reach the API:</strong> verify backend port, Vite proxy/client base URL, CORS origins, and that the API path begins with <code>/api/</code>.</div><div><strong className="text-[var(--fg-1)]">Database errors:</strong> validate DATABASE_URL, encoded credentials, network access, migrations/schema initialization, and connection limits.</div><div><strong className="text-[var(--fg-1)]">Upload extraction is empty:</strong> check file type and signature. Scanned PDFs may contain images rather than selectable text and should be uploaded as clear page images when vision is available.</div><div><strong className="text-[var(--fg-1)]">Payment remains pending:</strong> verify public callback reachability, Moolre credentials, provider status, reference matching, and server-side verification logs.</div><div><strong className="text-[var(--fg-1)]">SMS does not arrive:</strong> confirm SMS is enabled, the VAS key and sender ID are approved, phone normalization is correct, and inspect the SMS log.</div><div><strong className="text-[var(--fg-1)]">Production route returns 404:</strong> ensure the frontend was built into <code>frontend/dist</code> and the FastAPI SPA fallback is active after API routes.</div></div>
      </>,
    },
  ], [])

  const normalized = query.trim().toLowerCase()
  const visible = normalized ? sections.filter(section => `${section.title} ${section.description} ${section.keywords}`.toLowerCase().includes(normalized)) : sections

  return (
    <div className="min-h-full bg-[var(--bg-0)] text-[var(--fg-1)]">
      <div className="border-b border-[var(--line)] bg-[var(--bg-1)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-3xl"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-400"><BookOpen size={14} /> Product documentation</div><h1 className="text-3xl font-bold tracking-tight text-[var(--fg-0)] sm:text-4xl">BroxStudies documentation</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--fg-2)] sm:text-base">A practical guide to using, developing, configuring, securing, testing, and deploying the complete learning platform.</p></div>
          <label className="relative mt-7 block max-w-2xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-3)]" size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search setup, payments, Source Studio, deployment..." className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg-0)] pl-11 pr-4 text-sm text-[var(--fg-0)] outline-none transition placeholder:text-[var(--fg-3)] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15" /></label>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)] lg:overflow-y-auto"><div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fg-3)]">On this page</div><nav className="space-y-1">{visible.map(section => { const Icon = section.icon; return <a key={section.id} href={`#${section.id}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--fg-2)] transition hover:bg-[var(--bg-2)] hover:text-[var(--fg-0)]"><Icon size={14} /><span className="flex-1">{section.title}</span><ChevronRight size={12} /></a> })}</nav><Link to="/" className="mt-6 flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/10"><Brain size={14} /> Open AI Tutor <ExternalLink size={12} className="ml-auto" /></Link></aside>
        <main className="min-w-0 space-y-6">{visible.length ? visible.map(section => { const Icon = section.icon; return <article id={section.id} key={section.id} className="scroll-mt-20 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-5 sm:p-7"><div className="mb-5 flex items-start gap-4 border-b border-[var(--line)] pb-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400"><Icon size={19} /></span><div><h2 className="text-xl font-bold text-[var(--fg-0)]">{section.title}</h2><p className="mt-1 text-sm text-[var(--fg-3)]">{section.description}</p></div></div><div className="text-sm leading-7 text-[var(--fg-2)]">{section.content}</div></article> }) : <div className="rounded-2xl border border-dashed border-[var(--line)] p-10 text-center"><Search size={24} className="mx-auto text-[var(--fg-3)]" /><h2 className="mt-3 font-semibold text-[var(--fg-0)]">No documentation found</h2><p className="mt-1 text-sm text-[var(--fg-3)]">Try a broader search term such as AI, setup, payment, or testing.</p></div>}</main>
      </div>
    </div>
  )
}
