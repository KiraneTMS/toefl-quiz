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
  renderDashboard();
  populateCategorySelect();
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
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });

  if (name === 'progress') renderProgress();
  if (name === 'kesalahans') renderMistakes();
  if (name === 'dashboard') renderDashboard();
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
    (state.questions.reading || []).forEach(set => {
      if (difficulty !== 'all' && set.difficulty !== difficulty) return;
      set.questions.forEach(q => {
        if (category !== 'all' && q.type !== category) return;
        pool.push({
          ...q,
          section: 'reading',
          category: q.type || 'reading',
          difficulty: set.difficulty,
          passage: set.passage,
          passageTitle: set.title
        });
      });
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

  // Prepare each question with shuffled options
  return selected.map(q => {
    if (section === 'vocabulary') {
      // Generate options from other correct answers
      const { options, correctIndex } = generateVocabOptions(q.correct, state.questions.vocabulary);
      return { ...q, options, correct: correctIndex };
    } else {
      // Shuffle existing options so correct answer is not always in same position
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

  state.currentQuiz = {
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
  document.getElementById('btn-prev').disabled = i === 0;
  const isLast = i === total - 1;
  document.getElementById('btn-next').classList.toggle('hidden', isLast);
  document.getElementById('btn-finish').classList.toggle('hidden', !isLast);

  // In practice mode after answering, show feedback
  if (quiz.mode === 'practice' && quiz.answers[i] !== null) {
    showFeedback(q, quiz.answers[i]);
  }
}

function selectOption(idx) {
  const quiz = state.currentQuiz;
  if (!quiz) return;
  quiz.answers[quiz.index] = idx;

  // Re-render to update selected state
  renderQuestion();

  if (quiz.mode === 'practice') {
    showFeedback(quiz.questions[quiz.index], idx);
  }
}

function showFeedback(q, chosen) {
  const box = document.getElementById('feedback-box');
  const correct = chosen === q.correct;
  box.classList.remove('hidden', 'correct', 'wrong');
  box.classList.add(correct ? 'correct' : 'wrong');
  box.innerHTML = `
    <div class="title">${correct ? '✓ Benar' : '✗ Salah'}</div>
    <div>${q.explanation || ''}</div>
  `;

  // Highlight options
  const options = document.querySelectorAll('.option');
  options.forEach((opt, i) => {
    opt.classList.remove('correct', 'wrong');
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
  if (quiz.answers[quiz.index] === null) {
    alert('Silakan pilih jawaban.');
    return;
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
    const sec = q.section;
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

  // Show results
  document.getElementById('score-percent').textContent = percent + '%';
  document.getElementById('score-fraction').textContent = `${correctCount} / ${quiz.questions.length}`;

  // Breakdown (simple for now)
  const breakdown = document.getElementById('section-breakdown');
  breakdown.innerHTML = `
    <div class="breakdown-item">
      <span>Bagian: ${quiz.section.replace(/-/g, ' ')}</span>
      <span>${correctCount} / ${quiz.questions.length}</span>
    </div>
  `;

  // Weak areas
  const weakEl = document.getElementById('weak-areas');
  if (Object.keys(weak).length) {
    weakEl.innerHTML = '<h3>Area Lemah (sesi ini)</h3>' +
      Object.entries(weak).map(([cat, cnt]) => `
        <div class="weak-item">
          <span>${cat.replace(/-/g, ' ')}</span>
          <span>${cnt} kesalahan${cnt > 1 ? 's' : ''}</span>
        </div>
      `).join('');
  } else {
    weakEl.innerHTML = '<h3>Kerja bagus!</h3><p style="color:var(--text-muted)">Tidak ada area lemah di sesi ini.</p>';
  }

  document.getElementById('btn-review-kesalahans').onclick = () => {
    showView('kesalahans');
  };

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
function renderMistakes() {
  const list = document.getElementById('kesalahans-list');
  const empty = document.getElementById('no-kesalahans');
  const kesalahans = state.progress.kesalahans;

  if (!kesalahans.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const letters = ['A', 'B', 'C', 'D'];
  list.innerHTML = kesalahans.map(m => `
    <div class="kesalahan-card">
      <div class="q-text">${m.question}</div>
      <div class="answer-row">
        <span class="wrong-ans">Jawabanmu: ${letters[m.chosen] || '?'} – ${m.options[m.chosen] || '—'}</span>
        <span class="correct-ans">Jawaban benar: ${letters[m.correct]} – ${m.options[m.correct]}</span>
      </div>
      <div class="explanation">${m.explanation || ''}</div>
    </div>
  `).join('');
}

// ---------- Init ----------
loadData().then(() => {
  showView('dashboard');
});