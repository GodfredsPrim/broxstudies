import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Brain, FileText, BookOpen, Zap, BarChart3, Sparkles,
  ArrowRight, CheckCircle2, Users, Target, GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/shadcn-button'
import { Card, CardContent } from '@/components/ui/shadcn-card'
import { AnimatedCounter } from '@/components/shared/AnimatedCounter'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/shared/PageTransition'
import { LandingNavbar, LandingFooter } from '@/components/landing/LandingNav'
import { cn } from '@/lib/cn'

const STATS = [
  { value: 12000, suffix: '+', label: 'Students learning' },
  { value: 50000, suffix: '+', label: 'Questions generated' },
  { value: 15, suffix: '+', label: 'Subjects covered' },
  { value: 98, suffix: '%', label: 'Satisfaction rate' },
]

const FEATURES = [
  { icon: Brain, title: 'AI Tutor', desc: 'Curriculum-aware tutoring with math, code, and file support. Ask anything about your syllabus.', accent: 'primary' as const },
  { icon: FileText, title: 'Question Generator', desc: 'Generate custom practice papers by subject, topic, difficulty, and question type.', accent: 'accent' as const },
  { icon: Target, title: 'Likely WASSCE', desc: 'AI-analyzed past papers reveal which topics are most likely to appear this year.', accent: 'primary' as const },
  { icon: Zap, title: 'Live Quiz', desc: 'Challenge classmates in real-time timed quizzes. Compete and climb the leaderboard.', accent: 'accent' as const },
  { icon: BookOpen, title: 'Study Library', desc: 'Browse Ghanaian classics, textbooks, and curriculum resources with reading progress.', accent: 'primary' as const },
  { icon: BarChart3, title: 'Analytics', desc: 'Track weak topics, study heatmaps, and exam readiness scores with AI recommendations.', accent: 'accent' as const },
]

const STEPS = [
  { step: '01', title: 'Choose your track', desc: 'Select SHS or TVET and pick your subjects aligned with Ghana\'s New Curriculum.' },
  { step: '02', title: 'Study with AI', desc: 'Ask questions, upload files, and get instant explanations tailored to your grade level.' },
  { step: '03', title: 'Practice & compete', desc: 'Generate papers, take likely WASSCE exams, and challenge friends in live quizzes.' },
  { step: '04', title: 'Track progress', desc: 'Earn XP, badges, and streaks while monitoring your exam readiness score.' },
]

const TESTIMONIALS = [
  { name: 'Ama K.', school: 'Wesley Girls\' SHS', text: 'BroxStudies helped me jump from a C to an A in Core Mathematics. The AI tutor explains things better than my textbook!', avatar: 'AK' },
  { name: 'Kwame O.', school: 'Prempeh College', text: 'The likely WASSCE feature is incredible. I knew exactly which topics to focus on before my exams.', avatar: 'KO' },
  { name: 'Efua M.', school: 'Accra Technical Institute', text: 'As a TVET student, having NAPTEX-focused content makes BroxStudies stand out from every other app.', avatar: 'EM' },
]

const FAQ = [
  { q: 'Is BroxStudies free?', a: 'You get 3 free AI tutor chats without an account. Full access including unlimited practice, WASSCE prep, and live quizzes is GH₵20 for 3 months.' },
  { q: 'Does it work offline?', a: 'Yes! Install BroxStudies as a PWA on your phone for offline access to your history and saved practice sets.' },
  { q: 'SHS or TVET?', a: 'Both! Select your academic track during signup. TVET students get NAPTEX-focused content and subjects.' },
  { q: 'How does the AI tutor work?', a: 'Our AI is trained on Ghana\'s New Secondary Education Curriculum. It supports text, images, PDFs, and voice input with math rendering.' },
]

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="v2-mesh" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--bg-0)_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-400">
              <Sparkles size={14} />
              AI-Powered Learning for Ghana
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Master WASSCE with{' '}
              <span className="gradient-text">AI that understands</span>{' '}
              your curriculum
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              The premium study platform for SHS and TVET students. AI tutoring, practice exams, live quizzes, and personalized analytics — all aligned with Ghana's New Secondary Education Curriculum.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/signup">
                <Button size="lg" className="gap-2 px-8">
                  Start learning free <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline" size="lg" className="gap-2 px-8">
                  <GraduationCap size={18} /> Explore dashboard
                </Button>
              </Link>
            </div>
          </FadeIn>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto mt-16 max-w-5xl"
          >
            <motion.img
              src="/images/students-championship.jpg"
              alt="Ghanaian SHS students celebrating at a national championship"
              initial={{ opacity: 0, y: 20, rotate: -6 }}
              animate={{ opacity: 1, y: [20, -8, 20], rotate: -6 }}
              transition={{
                opacity: { delay: 0.5, duration: 0.6 },
                rotate: { delay: 0.5, duration: 0.6 },
                y: { delay: 0.5, duration: 7, repeat: Infinity, ease: 'easeInOut' },
              }}
              className="absolute -left-6 -top-10 hidden h-28 w-40 rounded-2xl border-2 border-[var(--bg-0)] object-cover shadow-glow-md sm:block lg:-left-16 lg:h-36 lg:w-52"
            />
            <motion.img
              src="/images/students-quiz-team.jpg"
              alt="Students on a quiz competition team"
              initial={{ opacity: 0, y: 20, rotate: 6 }}
              animate={{ opacity: 1, y: [20, -12, 20], rotate: 6 }}
              transition={{
                opacity: { delay: 0.65, duration: 0.6 },
                rotate: { delay: 0.65, duration: 0.6 },
                y: { delay: 0.65, duration: 8.5, repeat: Infinity, ease: 'easeInOut' },
              }}
              className="absolute -right-4 -bottom-8 hidden h-24 w-32 rounded-2xl border-2 border-[var(--bg-0)] object-cover shadow-glow-md sm:block lg:-right-12 lg:h-32 lg:w-44"
            />
            <div className="gradient-border rounded-3xl p-px">
              <div className="overflow-hidden rounded-3xl border border-border bg-[var(--bg-1)] shadow-glow-lg">
                <div className="border-b border-border bg-[var(--bg-2)] px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-rose-500/60" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/60" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/60" />
                  </div>
                  <span className="ml-2 text-xs text-muted-foreground">BroxStudies AI Tutor</span>
                </div>
                <div className="p-6 space-y-4 min-h-[280px]">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
                    <div className="rounded-2xl rounded-tl-sm bg-[var(--bg-2)] px-4 py-3 text-sm max-w-md">
                      Explain the difference between ionic and covalent bonding for WASSCE Chemistry.
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="rounded-2xl rounded-tr-sm bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 px-4 py-3 text-sm max-w-lg">
                      <p className="font-medium text-indigo-300 mb-1">Great question! Here's a WASSCE-ready explanation:</p>
                      <p className="text-muted-foreground">Ionic bonds form when electrons transfer between metals and non-metals (e.g. NaCl), while covalent bonds share electrons between non-metals (e.g. H₂O)...</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['Practice questions', 'Draw diagram', 'Past paper example'].map(p => (
                      <span key={p} className="rounded-full border border-border bg-[var(--bg-2)] px-3 py-1 text-xs text-muted-foreground">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-[var(--bg-1)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <FadeIn key={s.label} delay={i * 0.1} className="text-center">
                <div className="text-3xl font-extrabold sm:text-4xl">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-muted-foreground">Trusted by students across Ghana</p>
          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { src: '/images/students-assembly.jpg', alt: 'Students at a school assembly' },
              { src: '/images/students-girls-shs.jpg', alt: 'Girls SHS students on campus' },
              { src: '/images/students-championship.jpg', alt: 'Students celebrating at a national championship' },
              { src: '/images/students-quiz-team.jpg', alt: 'Students on a quiz competition team' },
            ].map(img => (
              <img
                key={img.src}
                src={img.src}
                alt={img.alt}
                className="h-20 w-full rounded-xl border border-[var(--line)] object-cover sm:h-24"
              />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-muted-foreground/60">
            {['Prempeh College', 'Wesley Girls\' SHS', 'Achimota School', 'Mfantsipim', 'Accra Technical Institute', 'KNUST SHS'].map(s => (
              <span key={s} className="text-sm font-semibold">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-400">Features</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Everything you need to ace WASSCE</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">One platform for studying, practicing, competing, and tracking your progress.</p>
          </FadeIn>
          <StaggerContainer className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <StaggerItem key={f.title}>
                <Card
                  className={cn(
                    'group h-full border-border bg-card transition-all duration-300',
                    f.accent === 'primary' ? 'hover:border-primary/40' : 'hover:border-[var(--accent)]/40',
                  )}
                >
                  <CardContent className="p-6">
                    <div
                      className={cn(
                        'mb-4 grid h-11 w-11 place-items-center rounded-lg border',
                        f.accent === 'primary'
                          ? 'border-primary/25 bg-primary/10 text-primary'
                          : 'border-[var(--accent)]/25 bg-[var(--accent-tint)] text-[var(--accent)]',
                      )}
                    >
                      <f.icon size={20} />
                    </div>
                    <h3 className="text-lg font-bold">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-[var(--bg-1)] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest text-purple-400">How it works</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Four steps to exam success</h2>
          </FadeIn>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <FadeIn key={s.step} delay={i * 0.1}>
                <div className="relative">
                  <span className="text-5xl font-extrabold text-indigo-500/20">{s.step}</span>
                  <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Testimonials</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Students love BroxStudies</h2>
          </FadeIn>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.1}>
                <Card className="h-full">
                  <CardContent className="p-6">
                    <p className="text-sm leading-relaxed text-muted-foreground">"{t.text}"</p>
                    <div className="mt-6 flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-bold text-white">
                        {t.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.school}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-border bg-[var(--bg-1)] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest text-amber-400">Pricing</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Affordable for every student</h2>
          </FadeIn>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-8">
                <h3 className="text-lg font-bold">Free</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try before you commit</p>
                <p className="mt-6 text-4xl font-extrabold">GH₵0</p>
                <ul className="mt-6 space-y-3">
                  {['3 AI tutor chats', 'Browse news & rankings', 'Track selection'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="mt-8 block">
                  <Button variant="outline" className="w-full">Get started</Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-indigo-500/40 shadow-glow-md relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <CardContent className="p-8">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">Pro</h3>
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-400">Popular</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Full access for 3 months</p>
                <p className="mt-6 text-4xl font-extrabold">GH₵20</p>
                <ul className="mt-6 space-y-3">
                  {['Unlimited AI tutoring', 'Practice question generator', 'Likely WASSCE papers', 'Live quiz rooms', 'Full library access', 'Progress analytics'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="mt-8 block">
                  <Button className="w-full">Activate now</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Frequently asked questions</h2>
          </FadeIn>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <FadeIn key={item.q} delay={i * 0.05}>
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold">{item.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--bg-1)] px-8 py-16 text-center sm:px-16">
            <div className="v2-grain" />
            <div className="absolute inset-x-0 top-0 h-px border-t v2-chalk-rule" />
            <div className="relative">
              <Users size={36} className="mx-auto text-primary" />
              <h2 className="mt-6 text-3xl font-extrabold sm:text-4xl">Join thousands of Ghanaian students</h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Start your journey to WASSCE success today. Free to try, affordable to unlock everything.</p>
              <Link to="/signup" className="mt-8 inline-block">
                <Button size="lg" className="gap-2 px-8">
                  Create free account <ArrowRight size={18} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
