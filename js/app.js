/* =========================
   TOEFL Quiz – Pure JS
   ========================= */

const STORAGE_KEY = 'toefl_quiz_progress_v1';

let state = {
  questions: {
    structure: [],
    'written-expression': [],
    reading: [],
    vocabulary: []
  },
  currentQuiz: null,          // { questions, answers, mode, index, startTime }
  progress: loadProgress()
};

// ---------- Data loading ----------
async function loadData() {
  const files = ['structure', 'written-expression', 'reading', 'vocabulary'];
  for (const f of files) {
    try {
      const res = await fetch(`data/${f}.json`);
      state.questions[f] = await res.json();
    } catch (e) {
      console.error('Failed to load', f, e);
      state.questions[f] = [];
    }
  }
  try {
    const res = await fetch('data/wordlist.json');
    state.wordlist = await res.json();
  } catch (e) {
    console.error('Failed to load wordlist', e);
    state.wordlist = [];
  }
  try {
    state.skills = await (await fetch('data/skills.json')).json();
  } catch (e) {
    console.error('Failed to load skills', e);
    state.skills = [];
  }
  try {
    state.skillMateri = await (await fetch('data/skill-materi.json')).json();
  } catch (e) {
    console.error('Failed to load skill materi', e);
    state.skillMateri = [];
  }
  state.materiLang = localStorage.getItem('toefl_materi_lang') || 'id';
  state.currentMateriSkillId = null;
  try {
    state.skillPacks = await (await fetch('data/skill-packs.json')).json();
  } catch (e) {
    console.error('Failed to load skill packs', e);
    state.skillPacks = [];
  }
  state.selectedSkillId = null;
  state.selectedSeed = null;
  renderDashboard();
  populateCategorySelect();
  initWordlistUI();
}

// ---------- Progress ----------
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    overall: { correct: 0, total: 0 },
    sections: {
      structure: { correct: 0, total: 0 },
      'written-expression': { correct: 0, total: 0 },
      reading: { correct: 0, total: 0 },
      vocabulary: { correct: 0, total: 0 }
    },
    categories: {},
    kesalahans: [],
    history: []
  };
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function resetProgress() {
  if (confirm('Reset semua progress dan kesalahan? Tindakan ini tidak bisa dibatalkan.')) {
    state.progress = {
      overall: { correct: 0, total: 0 },
      sections: {
        structure: { correct: 0, total: 0 },
        'written-expression': { correct: 0, total: 0 },
        reading: { correct: 0, total: 0 },
        vocabulary: { correct: 0, total: 0 }
      },
      categories: {},
      kesalahans: [],
      history: []
    };
    saveProgress();
    renderDashboard();
    renderProgress();
    renderMistakes();
  }
}

// ---------- Navigation ----------
// ---------- SPA history (browser back/forward) ----------
const VIEW_NAMES = new Set([
  'dashboard', 'practice', 'quiz', 'results', 'progress',
  'mistakes', 'wordlist', 'skills', 'materi'
]);

state._navSilent = false; // true = apply view without pushing history
state._lastHash = '';

function viewToHash(name, extra) {
  if (name === 'dashboard') return '#/';
  let h = '#/' + name;
  if (name === 'materi' && (extra?.skillId || state.currentMateriSkillId)) {
    h += '/' + (extra?.skillId || state.currentMateriSkillId);
  }
  if (name === 'skills' && state.selectedSkillId) {
    h += '/' + state.selectedSkillId;
  }
  return h;
}

function parseHash(hash) {
  const raw = (hash || '').replace(/^#\/?/, '');
  if (!raw) return { view: 'dashboard' };
  const parts = raw.split('/').filter(Boolean);
  const view = VIEW_NAMES.has(parts[0]) ? parts[0] : 'dashboard';
  const skillId = parts[1] || null;
  return { view, skillId };
}

function pushViewHistory(name) {
  if (state._navSilent) return;
  const hash = viewToHash(name);
  if (hash === state._lastHash) return;
  // If same as current location hash, skip
  if (location.hash === hash || (hash === '#/' && (location.hash === '' || location.hash === '#/'))) {
    state._lastHash = hash;
    return;
  }
  try {
    history.pushState({ view: name, skillId: state.currentMateriSkillId || state.selectedSkillId || null }, '', hash);
    state._lastHash = hash;
  } catch (e) {
    location.hash = hash;
    state._lastHash = hash;
  }
}

function applyViewFromRoute(name, skillId) {
  if (skillId) {
    if (name === 'materi') state.currentMateriSkillId = skillId;
    if (name === 'skills') state.selectedSkillId = skillId;
  }
  state._navSilent = true;
  showView(name);
  state._navSilent = false;
}

function onRouteChange() {
  const { view, skillId } = parseHash(location.hash);
  state._lastHash = location.hash || '#/';
  applyViewFromRoute(view, skillId);
}

function initRouter() {
  window.addEventListener('popstate', () => {
    const st = history.state;
    if (st && st.view && VIEW_NAMES.has(st.view)) {
      applyViewFromRoute(st.view, st.skillId || null);
      return;
    }
    onRouteChange();
  });
  window.addEventListener('hashchange', () => {
    // Only if not already handled by our push
    if (state._navSilent) return;
    onRouteChange();
  });
  // Initial: if no hash, set dashboard without adding extra history entry
  if (!location.hash || location.hash === '#') {
    try {
      history.replaceState({ view: 'dashboard' }, '', '#/');
    } catch (_) {}
    state._lastHash = '#/';
  } else {
    onRouteChange();
  }
}

function showView(name) {
  if (!VIEW_NAMES.has(name)) name = 'dashboard';

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  if (typeof closeMobileNav === 'function') closeMobileNav();
  const bn = document.getElementById('bottom-nav');
  if (bn) {
    // restore default display from CSS; hide only in quiz
    bn.style.display = (name === 'quiz') ? 'none' : '';
  }
  document.body.classList.toggle('in-quiz', name === 'quiz');

  if (name === 'progress') renderProgress();
  if (name === 'mistakes') renderMistakes();
  if (name === 'dashboard') renderDashboard();
  if (name === 'wordlist') renderWordlist();
  if (name === 'skills') renderSkillsView();
  if (name === 'materi') renderMateriView();

  pushViewHistory(name);
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ---------- Dashboard ----------
function renderDashboard() {
  const p = state.progress;
  const latest = p.history[p.history.length - 1];
  const latestEl = document.getElementById('latest-score');
  if (latest) {
    latestEl.innerHTML = `${latest.correct} / ${latest.total}<br><small style="font-size:0.9rem;color:var(--text-muted)">${latest.percent}% • ${latest.section}</small>`;
  } else {
    latestEl.textContent = 'Belum ada latihan';
  }

  const overview = document.getElementById('progress-overview');
  const sections = ['structure', 'written-expression', 'reading', 'vocabulary'];
  const labels = {
    structure: 'Structure',
    'written-expression': 'Written Expression',
    reading: 'Reading',
    vocabulary: 'Vocabulary'
  };

  overview.innerHTML = sections.map(s => {
    const sec = p.sections[s];
    const pct = sec.total ? Math.round((sec.correct / sec.total) * 100) : 0;
    return `
      <div class="progress-item">
        <span>${labels[s]}</span>
        <div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span>${pct}%</span>
      </div>`;
  }).join('');
}

// ---------- Practice setup ----------
function populateCategorySelect() {
  const sectionSel = document.getElementById('select-section');
  const catSel = document.getElementById('select-category');

  function updateCats() {
    const section = sectionSel.value;
    const qs = state.questions[section] || [];
    const cats = new Set();
    qs.forEach(q => {
      if (q.category) cats.add(q.category);
      if (q.questions) q.questions.forEach(qq => { if (qq.type) cats.add(qq.type); });
    });
    catSel.innerHTML = '<option value="all">Semua Kategori</option>' +
      [...cats].sort().map(c => `<option value="${c}">${c.replace(/-/g, ' ')}</option>`).join('');
  }

  sectionSel.addEventListener('change', updateCats);
  updateCats();
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('btn-start-practice').addEventListener('click', () => {
  const section = document.getElementById('select-section').value;
  const category = document.getElementById('select-category').value;
  const difficulty = document.getElementById('select-difficulty').value;
  const count = parseInt(document.getElementById('select-count').value, 10);
  const mode = document.querySelector('.mode-btn.active').dataset.mode;
  startQuiz(section, category, difficulty, count, mode);
});

function startSection(section) {
  document.getElementById('select-section').value = section;
  document.getElementById('select-section').dispatchEvent(new Event('change'));
  showView('practice');
}

function startQuickQuiz() {
  startQuiz('structure', 'all', 'all', 5, 'practice');
}

// ---------- Build question list ----------
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// For vocabulary (no options in JSON): generate 4 choices from other correct answers
function generateVocabOptions(correctAnswer, allVocab) {
  const allMeanings = allVocab.map(q => q.correct).filter(m => m && m !== correctAnswer);
  const unique = [...new Set(allMeanings)];
  const distractors = shuffleArray(unique).slice(0, 3);
  const options = shuffleArray([correctAnswer, ...distractors]);
  const correctIndex = options.indexOf(correctAnswer);
  return { options, correctIndex };
}

// For normal questions that already have options: shuffle them
function shuffleOptions(q) {
  if (!q.options || !Array.isArray(q.options)) return q;
  const pairs = q.options.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  const shuffled = shuffleArray(pairs);
  return {
    ...q,
    options: shuffled.map(p => p.opt),
    correct: shuffled.findIndex(p => p.isCorrect)
  };
}

function getQuestions(section, category, difficulty, count) {
  let pool = [];

  if (section === 'reading') {
    // Keep full passage sets (not flattened)
    pool = (state.questions.reading || []).filter(set => {
      if (difficulty !== 'all' && set.difficulty !== difficulty) return false;
      return true;
    }).map(set => {
      // Shuffle options for each question in the set
      const questions = set.questions.map(q => shuffleOptions({
        ...q,
        section: 'reading',
        category: q.type || 'reading',
        difficulty: set.difficulty
      }));
      return {
        id: set.id,
        section: 'reading',
        title: set.title,
        passage: set.passage,
        difficulty: set.difficulty,
        questions
      };
    });
  } else if (section === 'vocabulary') {
    pool = (state.questions.vocabulary || []).filter(q => {
      if (category !== 'all' && q.category !== category) return false;
      if (difficulty !== 'all' && q.difficulty !== difficulty) return false;
      return true;
    });
  } else {
    pool = (state.questions[section] || []).filter(q => {
      if (category !== 'all' && q.category !== category) return false;
      if (difficulty !== 'all' && q.difficulty !== difficulty) return false;
      return true;
    });
  }

  pool = shuffleArray(pool);
  const selected = pool.slice(0, Math.min(count, pool.length));

  if (section === 'reading') {
    return selected; // array of passage sets
  }

  return selected.map(q => {
    if (section === 'vocabulary') {
      const { options, correctIndex } = generateVocabOptions(q.correct, state.questions.vocabulary);
      return { ...q, options, correct: correctIndex };
    } else {
      return shuffleOptions(q);
    }
  });
}

// ---------- Quiz engine ----------
function startQuiz(section, category, difficulty, count, mode) {
  const questions = getQuestions(section, category, difficulty, count);
  if (questions.length === 0) {
    alert('Tidak ada soal yang cocok dengan filter. Coba opsi lain.');
    return;
  }

  if (section === 'reading') {
    // Reading: one passage set at a time, all questions shown together
    // For simplicity take first set (or cycle). Use count as number of passages.
    const set = questions[0];
    state.currentQuiz = {
      isReadingSet: true,
      passageSet: set,
      questions: set.questions,
      answers: new Array(set.questions.length).fill(null),
      mode,
      index: 0,
      startTime: Date.now(),
      section: 'reading'
    };
    showView('quiz');
    renderReadingSet();
  } else {
    state.currentQuiz = {
      isReadingSet: false,
      questions,
      answers: new Array(questions.length).fill(null),
      mode,
      index: 0,
      startTime: Date.now(),
      section
    };
    showView('quiz');
    renderQuestion();
  }
}


function renderReadingSet() {
  const quiz = state.currentQuiz;
  if (!quiz || !quiz.isReadingSet) return;

  const set = quiz.passageSet;
  const total = quiz.questions.length;
  const answered = quiz.answers.filter(a => a !== null).length;

  document.getElementById('quiz-progress-text').textContent = `Bacaan: ${answered} / ${total} dijawab`;
  document.getElementById('quiz-progress-bar').style.width = `${(answered / total) * 100}%`;

  // Passage always visible
  const passageBox = document.getElementById('passage-box');
  passageBox.classList.remove('hidden');
  passageBox.innerHTML = `<strong>${set.title || 'Bacaan'}</strong><br><br>${set.passage}`;

  // Hide single question text area, use options container for all questions
  document.getElementById('question-text').innerHTML = '';
  document.getElementById('feedback-box').classList.add('hidden');

  const container = document.getElementById('options-container');
  const letters = ['A', 'B', 'C', 'D'];

  container.innerHTML = quiz.questions.map((q, qi) => {
    const optsHtml = q.options.map((opt, oi) => {
      let cls = 'option';
      if (quiz.answers[qi] === oi) cls += ' selected';
      if (quiz.mode === 'practice' && quiz.answers[qi] !== null) {
        if (oi === q.correct) cls += ' correct';
        else if (oi === quiz.answers[qi] && oi !== q.correct) cls += ' wrong';
      }
      return `<button class="${cls}" data-qi="${qi}" data-oi="${oi}">
        <span class="letter">${letters[oi]}.</span>
        <span>${opt}</span>
      </button>`;
    }).join('');

    let feedback = '';
    if (quiz.mode === 'practice' && quiz.answers[qi] !== null) {
      const ok = quiz.answers[qi] === q.correct;
      feedback = `<div class="feedback-box ${ok ? 'correct' : 'wrong'}" style="margin-top:0.5rem;margin-bottom:0.75rem">
        <div class="title">${ok ? '✓ Benar' : '✗ Salah'}</div>
        <div>${q.explanation || ''}</div>
      </div>`;
    }

    return `<div class="reading-q-block" style="margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
      <h4 style="margin-bottom:0.75rem;font-size:1.05rem">${qi + 1}. ${q.question}</h4>
      <div class="options">${optsHtml}</div>
      ${feedback}
    </div>`;
  }).join('');

  container.querySelectorAll('.option').forEach(btn => {
    btn.addEventListener('click', () => {
      const qi = parseInt(btn.dataset.qi, 10);
      const oi = parseInt(btn.dataset.oi, 10);
      quiz.answers[qi] = oi;
      renderReadingSet();
    });
  });

  // Buttons: no prev/next, only finish when all answered (or allow anytime)
  document.getElementById('btn-prev').classList.add('hidden');
  document.getElementById('btn-next').classList.add('hidden');
  document.getElementById('btn-finish').classList.remove('hidden');
  document.getElementById('btn-finish').textContent = 'Selesai';
}


function renderQuestion() {
  const quiz = state.currentQuiz;
  if (!quiz) return;

  const i = quiz.index;
  const q = quiz.questions[i];
  const total = quiz.questions.length;

  document.getElementById('quiz-progress-text').textContent = `Soal ${i + 1} / ${total}`;
  document.getElementById('quiz-progress-bar').style.width = `${((i + 1) / total) * 100}%`;

  // Passage
  const passageBox = document.getElementById('passage-box');
  if (q.passage) {
    passageBox.classList.remove('hidden');
    passageBox.innerHTML = `<strong>${q.passageTitle || 'Bacaan'}</strong><br><br>${q.passage}`;
  } else {
    passageBox.classList.add('hidden');
  }

  // Soal text
  let qText = q.question;
  // For written expression, show with slashes highlighted
  if (q.section === 'written-expression') {
    qText = q.question.split(' / ').map((part, idx) => {
      return `<span style="padding:0 2px">${part}</span>`;
    }).join(' <span style="color:var(--text-muted)">/</span> ');
  }
  document.getElementById('question-text').innerHTML = qText;

  // Options
  const container = document.getElementById('options-container');
  const letters = ['A', 'B', 'C', 'D'];
  container.innerHTML = q.options.map((opt, idx) => `
    <button class="option ${quiz.answers[i] === idx ? 'selected' : ''}" data-idx="${idx}">
      <span class="letter">${letters[idx]}.</span>
      <span>${opt}</span>
    </button>
  `).join('');

  container.querySelectorAll('.option').forEach(btn => {
    btn.addEventListener('click', () => selectOption(parseInt(btn.dataset.idx, 10)));
  });

  // Feedback
  document.getElementById('feedback-box').classList.add('hidden');

  // Buttons
  document.getElementById('btn-prev').classList.remove('hidden');
  document.getElementById('btn-next').classList.remove('hidden');
  document.getElementById('btn-prev').disabled = i === 0;
  const isLast = i === total - 1;
  document.getElementById('btn-next').classList.toggle('hidden', isLast);
  document.getElementById('btn-finish').classList.toggle('hidden', !isLast);
  document.getElementById('btn-finish').textContent = 'Selesai';

  // In practice mode after answering, show feedback
  if (quiz.mode === 'practice' && quiz.answers[i] !== null) {
    showFeedback(q, quiz.answers[i]);
  }
}

function selectOption(idx) {
  const quiz = state.currentQuiz;
  if (!quiz || quiz.isReadingSet) return;
  // Practice / skill: lock first answer (score & mistake stay honest)
  if (quiz.mode === 'practice' && quiz.answers[quiz.index] !== null) return;
  quiz.answers[quiz.index] = idx;
  renderQuestion();
  if (quiz.mode === 'practice') {
    showFeedback(quiz.questions[quiz.index], idx);
  }
}

function showFeedback(q, chosen) {
  const box = document.getElementById('feedback-box');
  const correct = chosen === q.correct;
  const letters = ['A', 'B', 'C', 'D'];
  const correctText = q.options[q.correct];
  const chosenText = q.options[chosen];

  box.classList.remove('hidden', 'correct', 'wrong');
  box.classList.add(correct ? 'correct' : 'wrong');

  let body = '';
  if (correct) {
    body = `
      <div class="fb-line"><strong>Jawaban benar:</strong> ${letters[q.correct]}. ${correctText}</div>
      <div class="fb-explain"><strong>Penjelasan:</strong> ${q.explanation || '—'}</div>
    `;
  } else {
    body = `
      <div class="fb-line wrong-pick"><strong>Jawabanmu:</strong> ${letters[chosen]}. ${chosenText}</div>
      <div class="fb-line right-pick"><strong>Jawaban benar:</strong> ${letters[q.correct]}. ${correctText}</div>
      <div class="fb-explain"><strong>Penjelasan:</strong> ${q.explanation || '—'}</div>
    `;
  }

  box.innerHTML = `
    <div class="title">${correct ? '✓ Benar' : '✗ Salah'}</div>
    ${body}
  `;

  // Highlight options + lock after answer
  const options = document.querySelectorAll('.option');
  options.forEach((opt, i) => {
    opt.classList.remove('correct', 'wrong');
    opt.disabled = true;
    opt.classList.add('locked');
    if (i === q.correct) opt.classList.add('correct');
    else if (i === chosen && !correct) opt.classList.add('wrong');
  });
}

document.getElementById('btn-prev').addEventListener('click', () => {
  if (state.currentQuiz && state.currentQuiz.index > 0) {
    state.currentQuiz.index--;
    renderQuestion();
  }
});

document.getElementById('btn-next').addEventListener('click', () => {
  const quiz = state.currentQuiz;
  if (!quiz) return;
  if (quiz.answers[quiz.index] === null) {
    alert('Silakan pilih jawaban.');
    return;
  }
  if (quiz.index < quiz.questions.length - 1) {
    quiz.index++;
    renderQuestion();
  }
});

document.getElementById('btn-finish').addEventListener('click', () => {
  const quiz = state.currentQuiz;
  if (!quiz) return;
  if (quiz.isReadingSet) {
    // Allow finish; warn if some unanswered
    const unanswered = quiz.answers.filter(a => a === null).length;
    if (unanswered > 0) {
      if (!confirm(`Masih ada ${unanswered} soal belum dijawab. Selesai sekarang?`)) return;
    }
  } else {
    if (quiz.answers[quiz.index] === null) {
      alert('Silakan pilih jawaban.');
      return;
    }
  }
  finishQuiz();
});

function finishQuiz() {
  const quiz = state.currentQuiz;
  let correctCount = 0;
  const weak = {};
  const kesalahansThis = [];

  quiz.questions.forEach((q, i) => {
    const chosen = quiz.answers[i];
    const isCorrect = chosen === q.correct;
    if (isCorrect) correctCount++;
    else {
      kesalahansThis.push({
        question: q.question,
        options: q.options,
        chosen,
        correct: q.correct,
        explanation: q.explanation,
        section: q.section,
        category: q.category || 'general',
        id: q.id || `tmp-${i}`
      });
      const cat = q.category || 'general';
      weak[cat] = (weak[cat] || 0) + 1;
    }

    // Update progress
    const sec = q.section || quiz.section || 'structure';
    if (!state.progress.sections[sec]) state.progress.sections[sec] = { correct: 0, total: 0 };
    state.progress.sections[sec].total++;
    if (isCorrect) state.progress.sections[sec].correct++;
    state.progress.overall.total++;
    if (isCorrect) state.progress.overall.correct++;

    const cat = q.category || 'general';
    if (!state.progress.categories[cat]) state.progress.categories[cat] = { correct: 0, total: 0 };
    state.progress.categories[cat].total++;
    if (isCorrect) state.progress.categories[cat].correct++;
  });

  // Save kesalahans (keep last 50)
  state.progress.kesalahans = [...kesalahansThis, ...state.progress.kesalahans].slice(0, 50);

  const percent = Math.round((correctCount / quiz.questions.length) * 100);
  state.progress.history.push({
    section: quiz.section,
    correct: correctCount,
    total: quiz.questions.length,
    percent,
    date: new Date().toISOString()
  });
  if (state.progress.history.length > 20) state.progress.history.shift();

  saveProgress();

  // Skill pack history
  if (quiz.isSkillPack && quiz.seed) {
    saveSeedHistory(quiz.seed, quiz.skillId, percent, correctCount, quiz.questions.length);
  }

  // Show results
  document.getElementById('score-percent').textContent = percent + '%';
  document.getElementById('score-fraction').textContent = `${correctCount} / ${quiz.questions.length}`;

  // Breakdown (simple for now)
  const breakdown = document.getElementById('section-breakdown');
  const seedLine = quiz.seed
    ? `<div class="breakdown-item"><span>Seed / Pack</span><span style="font-family:ui-monospace,monospace">${quiz.seed}</span></div>`
    : '';
  const skillLine = quiz.isSkillPack
    ? `<div class="breakdown-item"><span>Mode</span><span>Skill pack · feedback langsung</span></div>`
    : '';
  breakdown.innerHTML = `
    <div class="breakdown-item">
      <span>Bagian: ${(quiz.skillId || quiz.section || '').replace(/-/g, ' ')}</span>
      <span>${correctCount} / ${quiz.questions.length}</span>
    </div>
    ${seedLine}
    ${skillLine}
    <div class="breakdown-item">
      <span>Benar</span><span style="color:var(--success, #22c55e)">${correctCount}</span>
    </div>
    <div class="breakdown-item">
      <span>Salah</span><span style="color:var(--danger, #ef4444)">${quiz.questions.length - correctCount}</span>
    </div>
  `;

  // Weak areas + session mistake cards
  const weakEl = document.getElementById('weak-areas');
  if (Object.keys(weak).length) {
    weakEl.innerHTML = '<h3>Area Lemah (sesi ini)</h3>' +
      Object.entries(weak).map(([cat, cnt]) => `
        <div class="weak-item">
          <span>${cat.replace(/-/g, ' ')}</span>
          <span>${cnt} kesalahan</span>
        </div>
      `).join('');
  } else {
    weakEl.innerHTML = '<h3>Kerja bagus!</h3><p style="color:var(--text-muted)">Tidak ada area lemah di sesi ini.</p>';
  }

  // Show wrong answers from this session on results page
  let sessionBox = document.getElementById('session-mistakes');
  if (!sessionBox) {
    sessionBox = document.createElement('div');
    sessionBox.id = 'session-mistakes';
    sessionBox.className = 'session-mistakes';
    weakEl.insertAdjacentElement('afterend', sessionBox);
  }
  if (kesalahansThis.length) {
    sessionBox.innerHTML = '<h3>Review jawaban salah</h3>' +
      kesalahansThis.map((m, i) => formatMistakeCard(m, i)).join('');
  } else {
    sessionBox.innerHTML = '';
  }

  const reviewBtn = document.getElementById('btn-review-mistakes');
  if (reviewBtn) {
    reviewBtn.onclick = () => showView('mistakes');
  }

  showView('results');
  state.currentQuiz = null;
}

// ---------- Progress view ----------
function renderProgress() {
  const p = state.progress;
  const overallPct = p.overall.total ? Math.round((p.overall.correct / p.overall.total) * 100) : 0;

  document.getElementById('overall-stats').innerHTML = `
    <div class="stat-card">
      <div class="value">${overallPct}%</div>
      <div class="label">Akurasi Keseluruhan</div>
    </div>
    <div class="stat-card">
      <div class="value">${p.overall.total}</div>
      <div class="label">Soal Dijawab</div>
    </div>
    <div class="stat-card">
      <div class="value">${p.kesalahans.length}</div>
      <div class="label">Kesalahan Tersimpan</div>
    </div>
  `;

  const topics = Object.entries(p.categories)
    .map(([cat, data]) => ({
      cat,
      pct: data.total ? Math.round((data.correct / data.total) * 100) : 0,
      total: data.total
    }))
    .sort((a, b) => a.pct - b.pct);

  document.getElementById('topic-performance').innerHTML = topics.length
    ? topics.map(t => `
        <div class="topic-item">
          <span>${t.cat.replace(/-/g, ' ')} <small style="color:var(--text-muted)">(${t.total})</small></span>
          <span>${t.pct}%</span>
        </div>
      `).join('')
    : '<p class="empty-state">Belum ada data. Mulai latihan!</p>';
}

// ---------- Mistakes view ----------
function formatMistakeCard(m, index) {
  const letters = ['A', 'B', 'C', 'D'];
  const chosenLetter = letters[m.chosen] ?? '?';
  const correctLetter = letters[m.correct] ?? '?';
  const chosenText = (m.options && m.options[m.chosen] != null) ? m.options[m.chosen] : '—';
  const correctText = (m.options && m.options[m.correct] != null) ? m.options[m.correct] : '—';
  const section = (m.section || '').replace(/-/g, ' ');
  const category = (m.category || '').replace(/-/g, ' ');
  const meta = [section, category].filter(Boolean).join(' · ');

  return `
    <div class="mistake-card">
      <div class="mistake-header">
        <span class="mistake-badge">Salah${index != null ? ' #' + (index + 1) : ''}</span>
        ${meta ? `<span class="mistake-meta">${meta}</span>` : ''}
      </div>
      <div class="q-text">${m.question}</div>
      <div class="answer-compare">
        <div class="answer-box wrong">
          <span class="label">Jawabanmu</span>
          <span>${chosenLetter}. ${chosenText}</span>
        </div>
        <div class="answer-box correct">
          <span class="label">Jawaban benar</span>
          <span>${correctLetter}. ${correctText}</span>
        </div>
      </div>
      <div class="explanation"><strong>Penjelasan:</strong> ${m.explanation || '—'}</div>
    </div>
  `;
}

function renderMistakes() {
  const list = document.getElementById('mistakes-list');
  const empty = document.getElementById('no-mistakes');
  const kesalahans = state.progress.kesalahans || [];

  if (!kesalahans.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = `
    <div class="mistakes-summary">
      <strong>${kesalahans.length}</strong> kesalahan tersimpan (maks. 50 terakhir)
    </div>
  ` + kesalahans.map((m, i) => formatMistakeCard(m, i)).join('');
}


// ---------- Word list (TOEFL high-frequency academic words) ----------
function initWordlistUI() {
  const letterSel = document.getElementById('wordlist-letter');
  if (!letterSel || letterSel.options.length > 1) return;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(L => {
    const opt = document.createElement('option');
    opt.value = L;
    opt.textContent = L;
    letterSel.appendChild(opt);
  });
  const search = document.getElementById('wordlist-search');
  if (search) search.addEventListener('input', renderWordlist);
  letterSel.addEventListener('change', renderWordlist);
}

function renderWordlist() {
  const container = document.getElementById('wordlist-container');
  const countEl = document.getElementById('wordlist-count');
  if (!container) return;

  const q = (document.getElementById('wordlist-search')?.value || '').trim().toLowerCase();
  const letter = document.getElementById('wordlist-letter')?.value || 'all';
  let list = state.wordlist || [];

  if (letter !== 'all') {
    list = list.filter(w => w.word[0].toUpperCase() === letter);
  }
  if (q) {
    list = list.filter(w =>
      w.word.toLowerCase().includes(q) ||
      (w.meaning_id || '').toLowerCase().includes(q) ||
      (w.example || '').toLowerCase().includes(q)
    );
  }

  // sort A-Z
  list = [...list].sort((a, b) => a.word.localeCompare(b.word));

  if (countEl) {
    countEl.innerHTML = `<strong>${list.length}</strong> kata ditampilkan` +
      (q || letter !== 'all' ? ' (terfilter)' : ' — fokus kata akademik TOEFL');
  }

  if (!list.length) {
    container.innerHTML = '<p class="empty-state">Tidak ada kata yang cocok.</p>';
    return;
  }

  container.innerHTML = list.map(w => `
    <div class="word-card">
      <div class="word">${w.word}</div>
      <div class="meaning">${w.meaning_id}</div>
      <div class="example">${w.example || ''}</div>
    </div>
  `).join('');
}



// ---------- Skills + Seed packs ----------
const SEED_HISTORY_KEY = 'toefl_skill_seed_history_v1';

function loadSeedHistory() {
  try {
    return JSON.parse(localStorage.getItem(SEED_HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveSeedHistory(seed, skillId, percent, correct, total) {
  let hist = loadSeedHistory().filter(h => h.seed !== seed);
  hist.unshift({
    seed,
    skillId,
    percent,
    correct,
    total,
    date: new Date().toISOString()
  });
  hist = hist.slice(0, 30);
  localStorage.setItem(SEED_HISTORY_KEY, JSON.stringify(hist));
}

function getPackBySeed(seed) {
  if (!seed) return null;
  const code = String(seed).trim().toUpperCase();
  return (state.skillPacks || []).find(p => p.seed.toUpperCase() === code) || null;
}

function renderSkillsView() {
  initSkillsSectionTabs();
  const list = document.getElementById('skills-list');
  if (!list) return;

  if (!state.skillsSection) state.skillsSection = 'structure';
  const section = state.skillsSection;

  // section tabs UI state
  document.querySelectorAll('#skills-section-tabs .section-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.section === section);
  });
  const hint = document.getElementById('skills-section-hint');
  if (hint) {
    hint.innerHTML = section === 'structure'
      ? '💡 Pilih skill Structure, lalu buka <strong>Materi</strong> sebelum latihan.'
      : '✍️ Written Expression — pilih skill, buka <strong>Materi</strong>. Pack soal menyusul.';
  }
  const pdfBtn = document.getElementById('btn-open-materi-pdf');
  if (pdfBtn) {
    const sectionSkillIds = new Set((state.skills || []).filter(s => (s.section || 'structure') === section && !s.placeholder).map(s => s.id));
    const hasAnyMateri = (state.skillMateri || []).some(m => sectionSkillIds.has(m.skillId));
    pdfBtn.style.display = hasAnyMateri ? '' : 'none';
  }

  const skills = (state.skills || []).filter(sk => {
    const sec = sk.section || 'structure';
    return sec === section;
  });

  let html = '';
  if (section === 'written-expression') {
    const ready = skills.filter(s => !s.placeholder).length;
    if (!ready) {
      html += `<div class="we-empty-banner">Written Expression skills masih placeholder. Kirim materi/contoh soal nanti — slot sudah siap diisi.</div>`;
    } else {
      html += `<div class="we-empty-banner">${ready} skill WE siap (materi). Pack soal latihan menyusul.</div>`;
    }
  }

  let lastGroup = '';
  skills.forEach(sk => {
    if (sk.group !== lastGroup) {
      lastGroup = sk.group;
      html += `<div class="skill-group-label">${sk.group}</div>`;
    }
    const active = state.selectedSkillId === sk.id ? 'active' : '';
    const hasMateri = (state.skillMateri || []).some(m => m.skillId === sk.id);
    const ph = sk.placeholder ? 'placeholder' : '';
    const disabled = sk.placeholder ? 'disabled' : '';
    html += `
      <button type="button" class="skill-item ${active} ${ph}" data-skill="${sk.id}" ${disabled}>
        <div class="skill-code">${sk.code}</div>
        <div class="skill-title">${sk.title}</div>
        <div class="skill-desc">${sk.description}</div>
        ${hasMateri ? `<div class="skill-actions"><span class="mini-btn materi" data-materi="${sk.id}">📖 Materi</span></div>` : ''}
        ${sk.placeholder ? `<div class="skill-actions"><span class="mini-btn" style="opacity:.7">🔒 Segera</span></div>` : ''}
      </button>`;
  });
  list.innerHTML = html || '<p class="hint">Tidak ada skill.</p>';

  list.querySelectorAll('.skill-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target && e.target.classList.contains('materi')) {
        e.stopPropagation();
        openMateri(e.target.dataset.materi);
        return;
      }
      state.selectedSkillId = btn.dataset.skill;
      state.selectedSeed = null;
      renderSkillsView();
    });
  });

  renderSeedsList();
  renderSeedHistory();

  const useBtn = document.getElementById('btn-use-seed');
  const startBtn = document.getElementById('btn-start-skill');
  if (useBtn && !useBtn._bound) {
    useBtn._bound = true;
    useBtn.addEventListener('click', () => {
      const val = document.getElementById('seed-input').value.trim();
      const pack = getPackBySeed(val);
      if (!pack) {
        alert('Seed tidak ditemukan. Contoh: S1-01, S2-03');
        return;
      }
      state.selectedSkillId = pack.skillId;
      state.selectedSeed = pack.seed;
      document.getElementById('seed-input').value = pack.seed;
      renderSkillsView();
    });
  }
  if (startBtn && !startBtn._bound) {
    startBtn._bound = true;
    startBtn.addEventListener('click', startSkillPackQuiz);
  }
}

function renderSeedsList() {
  const seedsEl = document.getElementById('seeds-list');
  const label = document.getElementById('skills-selected-label');
  const preview = document.getElementById('seed-preview');
  const startBtn = document.getElementById('btn-start-skill');
  if (!seedsEl) return;

  const skillId = state.selectedSkillId;
  if (!skillId) {
    seedsEl.innerHTML = '';
    if (label) label.textContent = 'Pilih skill dulu';
    if (preview) preview.classList.add('hidden');
    if (startBtn) startBtn.disabled = true;
    return;
  }

  const skill = (state.skills || []).find(s => s.id === skillId);
  if (label) label.textContent = skill ? `${skill.code} — ${skill.title}` : skillId;

  const packs = (state.skillPacks || []).filter(p => p.skillId === skillId);
  seedsEl.innerHTML = packs.map(p => {
    const active = state.selectedSeed === p.seed ? 'active' : '';
    return `
      <button type="button" class="seed-item ${active}" data-seed="${p.seed}">
        <div class="seed-code">${p.seed}</div>
        <div class="seed-meta">${p.title} · ${p.questionCount} soal</div>
      </button>`;
  }).join('') || '<p class="hint">Belum ada pack untuk skill ini.</p>';

  seedsEl.querySelectorAll('.seed-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedSeed = btn.dataset.seed;
      const inp = document.getElementById('seed-input');
      if (inp) inp.value = state.selectedSeed;
      renderSeedsList();
    });
  });

  const pack = getPackBySeed(state.selectedSeed);
  if (pack && preview) {
    preview.classList.remove('hidden');
    preview.innerHTML = `Pack <strong>${pack.seed}</strong> · ${pack.questionCount} soal · siap dikerjakan / direview`;
  } else if (preview) {
    preview.classList.add('hidden');
  }
  if (startBtn) startBtn.disabled = !pack;
}

function renderSeedHistory() {
  const el = document.getElementById('seed-history');
  if (!el) return;
  const hist = loadSeedHistory();
  if (!hist.length) {
    el.innerHTML = '<p class="hint">Belum ada riwayat.</p>';
    return;
  }
  el.innerHTML = hist.map(h => {
    const pct = h.percent != null ? ` ${h.percent}%` : '';
    return `<button type="button" class="seed-chip" data-seed="${h.seed}" title="Buka pack ini">${h.seed}${pct}</button>`;
  }).join('');
  el.querySelectorAll('.seed-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const pack = getPackBySeed(btn.dataset.seed);
      if (!pack) {
        alert('Pack tidak ditemukan.');
        return;
      }
      state.selectedSkillId = pack.skillId;
      state.selectedSeed = pack.seed;
      const inp = document.getElementById('seed-input');
      if (inp) inp.value = pack.seed;
      renderSkillsView();
    });
  });
}

function startSkillPackQuiz() {
  const pack = getPackBySeed(state.selectedSeed);
  if (!pack) {
    alert('Pilih seed/pack dulu.');
    return;
  }

  // Clone + shuffle options only (keep question order fixed for review consistency)
  const questions = pack.questions.map(q => {
    const copy = { ...q, section: 'structure', category: q.skillId || pack.skillId };
    return shuffleOptions(copy);
  });

  state.currentQuiz = {
    isReadingSet: false,
    isSkillPack: true,
    seed: pack.seed,
    skillId: pack.skillId,
    questions,
    answers: new Array(questions.length).fill(null),
    mode: 'practice',
    index: 0,
    startTime: Date.now(),
    section: 'structure'
  };

  showView('quiz');
  renderQuestion();
}



// ---------- Mobile nav ----------
function closeMobileNav() {
  const nav = document.getElementById('main-nav');
  const bd = document.getElementById('nav-backdrop');
  if (nav) nav.classList.remove('open');
  if (bd) bd.classList.remove('show');
  document.body.classList.remove('nav-open');
}

function initMobileNav() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  const bd = document.getElementById('nav-backdrop');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      if (bd) bd.classList.toggle('show', open);
      document.body.classList.toggle('nav-open', open);
    });
  }
  if (bd) bd.addEventListener('click', closeMobileNav);

  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      if (v) showView(v);
    });
  });
}



// ---------- Materi / Learn ----------
function getMateri(skillId) {
  return (state.skillMateri || []).find(m => m.skillId === skillId) || null;
}

function openMateri(skillId) {
  state.currentMateriSkillId = skillId;
  showView('materi'); // hash will include skill id
}

function markKeyTerms(text) {
  if (!text) return '';
  // longer phrases first
  const terms = [
    'object of a preposition', 'object of preposition', 'objects of prepositions',
    'prepositional phrase', 'preposition', 'appositive', 'present participle', 'past participle', 'participial', 'coordinate connector', 'coordinate', 'prepositional phrase', 'subject/verb agreement',
    'subject–verb agreement', 'Subject–verb agreement',
    'SUBJECT + VERB', 'subject and a verb', 'subject and verb',
    'double subject', 'extra subject', 'extra verb', 'finite verb',
    'SUBJECT', 'VERB',
    'singular', 'plural', 'agreement', 'participle', 'auxiliary', 'gerund',
    'subject', 'verb', 'object', 'Subject', 'Verb', 'Object',
    'klausa', 'kalimat', 'pelaku'
  ];
  // Split by existing tags to avoid nesting; process plain segments only
  let out = String(text).replace(/\*\*([^*]+)\*\*/g, '<strong class="mk-strong">$1</strong>');
  // placeholder protect already strong
  const parts = out.split(/(<[^>]+>)/);
  out = parts.map(seg => {
    if (seg.startsWith('<')) return seg;
    let s = seg;
    terms.forEach(t => {
      const re = new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      s = s.replace(re, (match) => `<mark class="mk">${match}</mark>`);
    });
    // phrases without word boundaries (SUBJECT + VERB)
    s = s.replace(/SUBJECT\s*\+\s*VERB/gi, '<mark class="mk">SUBJECT + VERB</mark>');
    return s;
  }).join('');
  // collapse accidental double marks
  out = out.replace(/<mark class="mk"><mark class="mk">/g, '<mark class="mk">')
           .replace(/<\/mark><\/mark>/g, '</mark>');
  return out;
}

function renderMateriView() {
  initMateriUI();
  initMateriPdfUI();
  const root = document.getElementById('materi-content');
  if (!root) return;
  const lang = state.materiLang || 'id';
  const m = getMateri(state.currentMateriSkillId);

  document.querySelectorAll('#materi-lang-toggle .lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });

  if (!m) {
    root.innerHTML = `<div class="card"><p class="hint">Materi untuk skill ini belum tersedia. Mulai dari <strong>S1</strong>.</p>
      <button class="btn secondary" onclick="showView('skills')">← Skills</button></div>`;
    return;
  }

  const title = lang === 'id' ? m.title_id : m.title_en;
  const group = lang === 'id' ? m.group_id : m.group_en;
  const summary = lang === 'id' ? m.summary_id : m.summary_en;
  const remember = lang === 'id' ? m.remember_id : m.remember_en;
  const checklist = lang === 'id' ? m.checklist_id : m.checklist_en;

  const formulaHtml = (m.formula || []).map((f, fi) => `
    <button type="button" class="formula-card interactive" data-formula="${fi}">
      <div class="flabel">${f.label}</div>
      <div class="fbody">${markKeyTerms(lang === 'id' ? f.id : f.en)}</div>
      <span class="tap-hint">${lang === 'id' ? 'ketuk untuk tandai' : 'tap to pin'}</span>
    </button>`).join('');

  const rulesHtml = (m.rules || []).map((r, ri) => `
    <details class="rule-item interactive" ${ri === 0 ? 'open' : ''}>
      <summary>
        <span class="rule-num">${ri + 1}</span>
        <span>${lang === 'id' ? r.title_id : r.title_en}</span>
      </summary>
      <p>${markKeyTerms(lang === 'id' ? r.body_id : r.body_en)}</p>
    </details>`).join('');

  const letters = ['A', 'B', 'C', 'D'];
  const examplesHtml = (m.examples || []).map((ex, i) => {
    const opts = ex.options.map((o, idx) =>
      `<button type="button" class="opt quiz-opt" data-ex="${i}" data-idx="${idx}">${letters[idx]}. ${o}</button>`
    ).join('');
    return `
      <div class="example-card interactive" data-example="${i}" data-correct="${ex.correct}">
        <div class="example-head">
          <span class="materi-section-label">${lang === 'id' ? 'Contoh' : 'Example'} ${i + 1}</span>
          <span class="ex-status">${lang === 'id' ? 'Pilih jawaban' : 'Pick an answer'}</span>
        </div>
        <div class="stem">${ex.stem}</div>
        <div class="example-opts">${opts}</div>
        <div class="example-why hidden" data-why="${i}">${markKeyTerms(lang === 'id' ? ex.why_id : ex.why_en)}</div>
        <button type="button" class="btn secondary small reveal-btn" data-reveal="${i}">
          ${lang === 'id' ? 'Lihat jawaban & penjelasan' : 'Show answer & explanation'}
        </button>
      </div>`;
  }).join('');

  const checkHtml = checklist.map((c, ci) => `
    <label class="check-row">
      <input type="checkbox" data-check="${ci}">
      <span>${markKeyTerms(c)}</span>
    </label>`).join('');

  root.innerHTML = `
    <div class="materi-banner">
      <div class="materi-code">${m.code}</div>
      <h2>${markKeyTerms(title)}</h2>
      <div class="group">${group}</div>
      <p class="summary">${markKeyTerms(summary)}</p>
    </div>

    <div class="key-legend">
      <span><mark class="mk">highlight</mark> = istilah penting</span>
      <span>📌 ketuk rumus untuk pin</span>
      <span>✓ checklist bisa dicentang</span>
    </div>

    <div class="materi-section-label">${lang === 'id' ? 'Rumus cepat' : 'Quick formula'}</div>
    <div class="formula-grid">${formulaHtml}</div>

    <div class="materi-section-label">${lang === 'id' ? 'Aturan (ketuk untuk buka)' : 'Rules (tap to expand)'}</div>
    <div class="rule-list">${rulesHtml}</div>

    <div class="materi-section-label">${lang === 'id' ? 'Latihan mini — pilih jawaban' : 'Mini practice — pick answers'}</div>
    ${examplesHtml}

    <div class="materi-section-label">${lang === 'id' ? 'Checklist (centang saat paham)' : 'Checklist (tick when clear)'}</div>
    <div class="checklist-box interactive">${checkHtml}</div>

    <div class="materi-section-label">${lang === 'id' ? 'Ingat' : 'Remember'}</div>
    <div class="remember-box">${markKeyTerms(remember)}</div>
  `;

  bindMateriInteractions(root, m, lang);

  const practiceBtn = document.getElementById('btn-materi-practice');
  if (practiceBtn) {
    practiceBtn.onclick = () => {
      state.selectedSkillId = m.skillId;
      state.selectedSeed = null;
      showView('skills');
    };
  }
}

function bindMateriInteractions(root, m, lang) {
  // Pin formula cards
  root.querySelectorAll('.formula-card.interactive').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('pinned');
    });
  });

  // Example: try answer
  root.querySelectorAll('.quiz-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.example-card');
      if (!card || card.classList.contains('revealed')) return;
      const correct = parseInt(card.dataset.correct, 10);
      const idx = parseInt(btn.dataset.idx, 10);
      const status = card.querySelector('.ex-status');
      card.querySelectorAll('.quiz-opt').forEach(o => {
        o.classList.remove('picked', 'ok', 'bad');
        o.disabled = true;
      });
      btn.classList.add('picked');
      if (idx === correct) {
        btn.classList.add('ok');
        if (status) status.textContent = lang === 'id' ? '✓ Benar' : '✓ Correct';
        if (status) status.classList.add('good');
      } else {
        btn.classList.add('bad');
        const right = card.querySelector(`.quiz-opt[data-idx="${correct}"]`);
        if (right) right.classList.add('ok');
        if (status) status.textContent = lang === 'id' ? '✗ Salah — lihat yang hijau' : '✗ Wrong — see green';
        if (status) status.classList.add('bad');
      }
      const why = card.querySelector('.example-why');
      if (why) why.classList.remove('hidden');
      card.classList.add('revealed');
      const rev = card.querySelector('.reveal-btn');
      if (rev) rev.classList.add('hidden');
    });
  });

  // Reveal without answering
  root.querySelectorAll('.reveal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.example-card');
      if (!card) return;
      const correct = parseInt(card.dataset.correct, 10);
      card.querySelectorAll('.quiz-opt').forEach(o => {
        o.disabled = true;
        if (parseInt(o.dataset.idx, 10) === correct) o.classList.add('ok');
      });
      const why = card.querySelector('.example-why');
      if (why) why.classList.remove('hidden');
      card.classList.add('revealed');
      const status = card.querySelector('.ex-status');
      if (status) status.textContent = lang === 'id' ? 'Jawaban ditampilkan' : 'Answer shown';
      btn.classList.add('hidden');
    });
  });

  // Checklist progress
  const checks = root.querySelectorAll('.check-row input');
  checks.forEach(inp => {
    inp.addEventListener('change', () => {
      const row = inp.closest('.check-row');
      if (row) row.classList.toggle('done', inp.checked);
      const box = root.querySelector('.checklist-box');
      if (!box) return;
      const total = checks.length;
      const done = [...checks].filter(c => c.checked).length;
      let bar = box.querySelector('.check-progress');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'check-progress';
        box.prepend(bar);
      }
      bar.textContent = lang === 'id'
        ? `${done}/${total} poin dicentang`
        : `${done}/${total} items checked`;
      bar.style.setProperty('--pct', total ? (done / total * 100) + '%' : '0%');
    });
  });
}

function initMateriUI() {
  const back = document.getElementById('btn-materi-back');
  if (back && !back._bound) {
    back._bound = true;
    back.addEventListener('click', () => showView('skills'));
  }
  document.querySelectorAll('#materi-lang-toggle .lang-btn').forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', () => {
      state.materiLang = btn.dataset.lang;
      localStorage.setItem('toefl_materi_lang', state.materiLang);
      renderMateriView();
    });
  });
}



// ---------- Materi PDF export ----------
function openMateriPdfModal(preselectIds) {
  const modal = document.getElementById('materi-pdf-modal');
  const list = document.getElementById('materi-pdf-checklist');
  if (!modal || !list) return;
  const items = state.skillMateri || [];
  if (!items.length) {
    alert('Belum ada materi yang bisa diunduh.');
    return;
  }
  const pre = new Set(preselectIds || []);
  const sec = state.skillsSection || 'structure';
  const skillMap = Object.fromEntries((state.skills || []).map(s => [s.id, s]));
  const filtered = items.filter(m => {
    const sk = skillMap[m.skillId];
    const msec = (sk && sk.section) || (String(m.code).startsWith('WE') ? 'written-expression' : 'structure');
    return msec === sec || pre.size;
  });
  const useItems = filtered.length ? filtered : items;
  list.innerHTML = useItems.map(m => {
    const checked = pre.size ? pre.has(m.skillId) : true;
    const title = (state.materiLang === 'en' ? m.title_en : m.title_id) || m.title_en;
    return `<label class="pdf-check-row">
      <input type="checkbox" value="${m.skillId}" ${checked ? 'checked' : ''}>
      <span class="code">${m.code}</span>
      <span>${title}</span>
    </label>`;
  }).join('');
  modal.classList.remove('hidden');
}

function closeMateriPdfModal() {
  const modal = document.getElementById('materi-pdf-modal');
  if (modal) modal.classList.add('hidden');
}

function getSelectedMateriForPdf() {
  const boxes = document.querySelectorAll('#materi-pdf-checklist input[type="checkbox"]:checked');
  const ids = [...boxes].map(b => b.value);
  return (state.skillMateri || []).filter(m => ids.includes(m.skillId));
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMateriPdfHtml(items, langMode) {
  const letters = ['A', 'B', 'C', 'D'];
  const blocks = items.map(m => {
    const parts = [];
    const langs = langMode === 'both' ? ['id', 'en'] : [langMode];

    langs.forEach(lang => {
      const title = lang === 'id' ? m.title_id : m.title_en;
      const group = lang === 'id' ? m.group_id : m.group_en;
      const summary = lang === 'id' ? m.summary_id : m.summary_en;
      const remember = lang === 'id' ? m.remember_id : m.remember_en;
      const checklist = lang === 'id' ? m.checklist_id : m.checklist_en;

      const formulas = (m.formula || []).map(f => `
        <div class="fcard">
          <div class="flabel">${escapeHtml(f.label)}</div>
          <pre>${escapeHtml(lang === 'id' ? f.id : f.en)}</pre>
        </div>`).join('');

      const rules = (m.rules || []).map((r, i) => `
        <div class="rule">
          <h4>${i + 1}. ${escapeHtml(lang === 'id' ? r.title_id : r.title_en)}</h4>
          <p>${escapeHtml(lang === 'id' ? r.body_id : r.body_en)}</p>
        </div>`).join('');

      const examples = (m.examples || []).map((ex, i) => {
        const opts = ex.options.map((o, idx) => {
          const mark = idx === ex.correct ? ' ✓' : '';
          const cls = idx === ex.correct ? 'ok' : '';
          return `<div class="opt ${cls}">${letters[idx]}. ${escapeHtml(o)}${mark}</div>`;
        }).join('');
        const why = lang === 'id' ? ex.why_id : ex.why_en;
        return `<div class="ex">
          <div class="ex-label">${lang === 'id' ? 'Contoh' : 'Example'} ${i + 1}</div>
          <div class="stem">${escapeHtml(ex.stem)}</div>
          ${opts}
          <div class="why">${escapeHtml(why)}</div>
        </div>`;
      }).join('');

      const checks = (checklist || []).map(c => `<li>${escapeHtml(c)}</li>`).join('');
      const langTag = lang === 'id' ? 'Bahasa Indonesia' : 'English';

      parts.push(`
        <section class="skill-block">
          <div class="banner">
            <div class="code">${escapeHtml(m.code)}</div>
            <h2>${escapeHtml(title)}</h2>
            <div class="group">${escapeHtml(group)} · ${langTag}</div>
            <p>${escapeHtml(summary)}</p>
          </div>
          <h3>Rumus / Formula</h3>
          <div class="fgrid">${formulas}</div>
          <h3>${lang === 'id' ? 'Aturan' : 'Rules'}</h3>
          ${rules}
          <h3>${lang === 'id' ? 'Contoh' : 'Examples'}</h3>
          ${examples}
          <h3>Checklist</h3>
          <ol>${checks}</ol>
          <div class="remember"><strong>${lang === 'id' ? 'Ingat' : 'Remember'}:</strong> ${escapeHtml(remember)}</div>
        </section>`);
    });
    return parts.join('<div class="page-break"></div>');
  }).join('<div class="page-break"></div>');

  const codes = items.map(m => m.code).join(', ');
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>TOEFL Materi — ${escapeHtml(codes)}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    color: #0f172a;
    line-height: 1.45;
    font-size: 11pt;
    max-width: 800px;
    margin: 0 auto;
    padding: 12px;
  }
  h1 { font-size: 18pt; margin: 0 0 4px; color: #1d4ed8; }
  .meta { color: #64748b; font-size: 9pt; margin-bottom: 18px; }
  .skill-block { margin-bottom: 8px; }
  .banner {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-left: 5px solid #2563eb;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
  }
  .code {
    display: inline-block;
    font-family: ui-monospace, monospace;
    font-weight: 800;
    font-size: 9pt;
    background: #dbeafe;
    color: #1e40af;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .banner h2 { font-size: 14pt; margin: 6px 0 2px; }
  .group { color: #3b82f6; font-size: 9pt; margin-bottom: 6px; }
  h3 {
    font-size: 11pt;
    color: #334155;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    margin: 14px 0 8px;
  }
  .fgrid { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .fcard {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 10px;
    background: #f8fafc;
  }
  .flabel { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #2563eb; font-weight: 700; }
  pre {
    margin: 4px 0 0;
    white-space: pre-wrap;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9.5pt;
  }
  .rule { margin-bottom: 8px; }
  .rule h4 { margin: 0 0 2px; font-size: 10.5pt; }
  .rule p { margin: 0; color: #475569; font-size: 10pt; }
  .ex {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 8px;
  }
  .ex-label { font-size: 8pt; font-weight: 700; color: #64748b; text-transform: uppercase; }
  .stem { font-weight: 600; margin: 4px 0 6px; }
  .opt { padding: 3px 6px; border-radius: 4px; font-size: 10pt; }
  .opt.ok { background: #dcfce7; border: 1px solid #86efac; font-weight: 600; }
  .why { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; color: #475569; font-size: 9.5pt; }
  ol { margin: 0 0 0 18px; padding: 0; }
  li { margin-bottom: 3px; font-size: 10pt; }
  .remember {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 10px 12px;
    margin-top: 8px;
    font-size: 10pt;
  }
  .page-break { page-break-after: always; height: 12px; }
  .no-print { margin: 12px 0 20px; }
  @media print {
    .no-print { display: none !important; }
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 16px;font-weight:700;cursor:pointer;border-radius:8px;border:none;background:#2563eb;color:#fff;">
      Print / Save as PDF
    </button>
    <span style="margin-left:8px;color:#64748b;font-size:12px;">Pilih “Save as PDF” di dialog print.</span>
  </div>
  <h1>TOEFL Skills — Materi</h1>
  <p class="meta">Skill: ${escapeHtml(codes)} · Generated from TOEFL Quiz · Not official ETS material</p>
  ${blocks}
  <script>setTimeout(() => { try { window.print(); } catch(e) {} }, 350);</script>
</body>
</html>`;
}

function generateMateriPdf(items, langMode) {
  if (!items || !items.length) {
    alert(langMode === 'en' ? 'Select at least one skill.' : 'Pilih minimal satu skill.');
    return;
  }
  const html = buildMateriPdfHtml(items, langMode || 'id');
  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup diblokir. Izinkan popup untuk mengunduh PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function initMateriPdfUI() {
  const openBtn = document.getElementById('btn-open-materi-pdf');
  if (openBtn && !openBtn._bound) {
    openBtn._bound = true;
    openBtn.addEventListener('click', () => openMateriPdfModal());
  }
  const pickBtn = document.getElementById('btn-materi-pdf-pick');
  if (pickBtn && !pickBtn._bound) {
    pickBtn._bound = true;
    pickBtn.addEventListener('click', () => openMateriPdfModal(
      state.currentMateriSkillId ? [state.currentMateriSkillId] : []
    ));
  }
  const curBtn = document.getElementById('btn-materi-pdf-current');
  if (curBtn && !curBtn._bound) {
    curBtn._bound = true;
    curBtn.addEventListener('click', () => {
      const m = getMateri(state.currentMateriSkillId);
      if (!m) {
        alert('Buka materi skill dulu.');
        return;
      }
      const lang = document.getElementById('materi-pdf-lang')?.value || state.materiLang || 'id';
      generateMateriPdf([m], lang === 'both' ? 'both' : (state.materiLang || 'id'));
    });
  }
  document.querySelectorAll('[data-close-modal]').forEach(el => {
    if (el._bound) return;
    el._bound = true;
    el.addEventListener('click', closeMateriPdfModal);
  });
  const all = document.getElementById('pdf-select-all');
  const none = document.getElementById('pdf-select-none');
  if (all && !all._bound) {
    all._bound = true;
    all.addEventListener('click', () => {
      document.querySelectorAll('#materi-pdf-checklist input').forEach(i => { i.checked = true; });
    });
  }
  if (none && !none._bound) {
    none._bound = true;
    none.addEventListener('click', () => {
      document.querySelectorAll('#materi-pdf-checklist input').forEach(i => { i.checked = false; });
    });
  }
  const gen = document.getElementById('btn-generate-materi-pdf');
  if (gen && !gen._bound) {
    gen._bound = true;
    gen.addEventListener('click', () => {
      const items = getSelectedMateriForPdf();
      const lang = document.getElementById('materi-pdf-lang')?.value || 'id';
      generateMateriPdf(items, lang);
      closeMateriPdfModal();
    });
  }
}



function initSkillsSectionTabs() {
  const tabs = document.querySelectorAll('#skills-section-tabs .section-tab');
  tabs.forEach(tab => {
    if (tab._bound) return;
    tab._bound = true;
    tab.addEventListener('click', () => {
      state.skillsSection = tab.dataset.section || 'structure';
      state.selectedSkillId = null;
      state.selectedSeed = null;
      renderSkillsView();
    });
  });
}

// ---------- Init ----------
loadData().then(() => {
  initMateriUI();
  initMateriPdfUI();
  initRouter();
  // If hash already points to a view, router applied it; else dashboard
  const { view } = parseHash(location.hash);
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    showView('dashboard');
  } else if (VIEW_NAMES.has(view) && view !== 'dashboard') {
    // already applied in initRouter via onRouteChange; ensure renders
    state._navSilent = true;
    showView(view);
    state._navSilent = false;
  } else {
    showView('dashboard');
  }
});


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initMobileNav());
} else {
  initMobileNav();
}