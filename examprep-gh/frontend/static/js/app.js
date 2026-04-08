/**
 * BisaME Osuani — App JavaScript
 * Ghana SHS Exam Prep
 */

const API_BASE = "http://localhost:8000/api";

// ── State ──────────────────────────────────────────────────────────────

const state = {
  user: null,
  accessToken: null,
  questions: [],
  currentIndex: 0,
  score: 0,
  answered: [],
  timerInterval: null,
  timeLeft: 0,
};

// ── Helpers ────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.accessToken) {
    headers["Authorization"] = `Bearer ${state.accessToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function toast(message, type = "info") {
  const container = $("#toast-container") || document.body;
  const div = document.createElement("div");
  const colors = {
    info: "bg-blue-500/90",
    success: "bg-emerald-500/90",
    error: "bg-red-500/90",
  };
  div.className = `${colors[type]} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium fade-up`;
  div.textContent = message;
  container.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

// ── Auth ───────────────────────────────────────────────────────────────

async function signUp(email, password, fullName) {
  const data = await api("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  toast("Account created! Check your email.", "success");
  return data;
}

async function signIn(email, password) {
  const data = await api("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  state.accessToken = data.access_token;
  state.user = data.user;
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("user", JSON.stringify(data.user));
  toast("Welcome back! 🎉", "success");
  return data;
}

function signOut() {
  state.accessToken = null;
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

function restoreSession() {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  if (token && user) {
    state.accessToken = token;
    state.user = JSON.parse(user);
    return true;
  }
  return false;
}

// ── Subjects ──────────────────────────────────────────────────────────

async function loadSubjects() {
  return api("/questions/subjects");
}

// ── Question Generation ───────────────────────────────────────────────

async function generateQuestions(subject, topic, format = "MCQ", numQuestions = 5) {
  const data = await api("/questions/generate", {
    method: "POST",
    body: JSON.stringify({
      subject,
      topic,
      format,
      num_questions: numQuestions,
    }),
  });
  state.questions = data;
  state.currentIndex = 0;
  state.score = 0;
  state.answered = new Array(data.length).fill(null);
  return data;
}

// ── Exam Timer ────────────────────────────────────────────────────────

function startTimer(seconds, onTick, onEnd) {
  state.timeLeft = seconds;
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    if (onTick) onTick(state.timeLeft, seconds);
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      if (onEnd) onEnd();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Rendering Helpers ─────────────────────────────────────────────────

function renderQuestion(question, index, container) {
  const div = document.createElement("div");
  div.className = "glass-card question-block fade-up";
  div.style.animationDelay = `${index * 0.08}s`;

  let optionsHTML = "";
  if (question.format === "MCQ" && question.options?.length) {
    optionsHTML = question.options
      .map(
        (opt, i) =>
          `<button class="option-btn" data-q="${index}" data-opt="${i}" onclick="selectOption(this, ${index}, ${i})">${opt}</button>`
      )
      .join("");
  } else {
    optionsHTML = `<div class="mt-3 p-4 rounded-xl bg-white/5 text-sm text-slate-300 leading-relaxed hidden" id="essay-answer-${index}">
      <p class="font-semibold text-gold-400 mb-1">Model Answer:</p>
      ${question.answer}
    </div>
    <button class="btn-outline mt-3 text-sm" onclick="document.getElementById('essay-answer-${index}').classList.toggle('hidden')">
      Show / Hide Answer
    </button>`;
  }

  div.innerHTML = `
    <div class="flex items-start gap-3 mb-3">
      <span class="q-number">${index + 1}</span>
      <p class="text-base leading-relaxed">${question.text}</p>
    </div>
    <div class="options-wrapper pl-10">${optionsHTML}</div>
    <div class="explanation hidden mt-3 ml-10 p-3 rounded-lg bg-emerald-500/10 text-sm text-emerald-300" id="explanation-${index}">
      ${question.explanation || ""}
    </div>
  `;
  container.appendChild(div);
}

function selectOption(btn, qIndex, optIndex) {
  if (state.answered[qIndex] !== null) return; // already answered
  state.answered[qIndex] = optIndex;

  const question = state.questions[qIndex];
  const correctLetter = question.answer.trim().charAt(0).toUpperCase();
  const letters = ["A", "B", "C", "D"];
  const isCorrect = letters[optIndex] === correctLetter;

  if (isCorrect) {
    btn.classList.add("correct");
    state.score++;
  } else {
    btn.classList.add("wrong");
    // Highlight correct
    const allBtns = document.querySelectorAll(`[data-q="${qIndex}"]`);
    const correctIdx = letters.indexOf(correctLetter);
    if (allBtns[correctIdx]) allBtns[correctIdx].classList.add("correct");
  }

  // Show explanation
  const expl = document.getElementById(`explanation-${qIndex}`);
  if (expl) expl.classList.remove("hidden");

  // Update score display
  const scoreEl = $("#live-score");
  if (scoreEl) scoreEl.textContent = `${state.score} / ${state.questions.length}`;
}

function renderScoreRing(score, total) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const ring = $(".score-ring");
  if (ring) {
    ring.style.setProperty("--score-pct", `${pct}%`);
    ring.setAttribute("data-score", `${pct}%`);
  }
}

// ── Subject Card Icons (emoji map) ───────────────────────────────────

const subjectIcons = {
  ENG: "📖", CMATH: "📐", ISCI: "🔬", SSCI: "🌍",
  EMATH: "📊", PHY: "⚡", CHEM: "🧪", BIO: "🧬",
  ECON: "💰", GEO: "🗺️", GOV: "🏛️", HIST: "📜",
  LIT: "✍️", FRE: "🇫🇷", ACC: "📒", BUS: "💼", ICT: "💻",
};

// ── Init ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  restoreSession();

  // Update nav auth state
  const authNav = $("#auth-nav");
  if (authNav) {
    if (state.user) {
      authNav.innerHTML = `
        <span class="text-sm text-slate-400">${state.user.email}</span>
        <button onclick="signOut()" class="btn-outline text-sm py-1 px-3">Sign Out</button>
      `;
    }
  }
});
