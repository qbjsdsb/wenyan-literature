/* ============================================================
 *  文研 · 文学考研助手 —— 主逻辑
 * ============================================================ */
(function () {
  "use strict";

  const { SUBJECTS, KNOWLEDGE, QUESTIONS, CARDS } = window.LITERATURE_DATA;

  /* ---------- 工具 ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map(s => [s.id, s]));
  const LS_KEY = "wenyan-progress-v1";

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch { return {}; }
  }
  function saveProgress(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }
  const state = Object.assign({
    quizAnswered: 0,        // 累计答题数
    cardsLearned: 0,        // 累计背卡数
    cardStates: {},         // { cardId: { box: 0-2, due: ts } } 简化艾宾浩斯
    activeSubject: "all",   // 知识点筛选
  }, loadProgress());

  function persist() { saveProgress(state); }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ============================================================
   *  导航
   * ============================================================ */
  const PAGE_TITLES = { knowledge: "知识点", quiz: "真题练习", cards: "记忆卡片" };

  function switchView(view) {
    $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    $$(".view").forEach(v => v.classList.add("hidden"));
    $("#view-" + view).classList.remove("hidden");
    $("#page-title").textContent = PAGE_TITLES[view];
    // 移动端关闭侧栏
    $(".sidebar").classList.remove("open");
    if (view === "knowledge") renderKnowledge();
    if (view === "cards") renderCards();
  }

  $$(".nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  $("#menu-toggle").addEventListener("click", () => $(".sidebar").classList.toggle("open"));

  /* ============================================================
   *  知识点模块
   * ============================================================ */
  function initKnowledgeChips() {
    const chips = $("#knowledge-chips");
    const all = document.createElement("button");
    all.className = "chip active";
    all.textContent = "全部";
    all.dataset.subject = "all";
    chips.appendChild(all);
    SUBJECTS.forEach(s => {
      const c = document.createElement("button");
      c.className = "chip";
      c.textContent = s.short;
      c.dataset.subject = s.id;
      chips.appendChild(c);
    });
    chips.addEventListener("click", e => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      $$(".chip", chips).forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.activeSubject = chip.dataset.subject;
      renderKnowledge();
    });
  }

  function renderKnowledge() {
    const kw = ($("#knowledge-search").value || "").trim().toLowerCase();
    const grid = $("#knowledge-grid");
    const list = KNOWLEDGE.filter(k => {
      if (state.activeSubject !== "all" && k.subject !== state.activeSubject) return false;
      if (!kw) return true;
      return (k.title + k.summary + (SUBJECT_MAP[k.subject]?.name || "")).toLowerCase().includes(kw);
    });

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">没有匹配的知识点，换个关键词试试？</div>`;
      return;
    }
    grid.innerHTML = "";
    list.forEach(k => {
      const card = document.createElement("article");
      card.className = "kn-card";
      card.innerHTML = `
        <span class="kn-tag">${SUBJECT_MAP[k.subject].short}</span>
        <h3 class="kn-title">${escapeHtml(k.title)}</h3>
        <p class="kn-summary">${escapeHtml(k.summary)}</p>`;
      card.addEventListener("click", () => openDetail(k));
      grid.appendChild(card);
    });
  }

  function openDetail(k) {
    const body = $("#detail-body");
    let html = `<span class="detail-tag">${SUBJECT_MAP[k.subject].name}</span>`;
    html += `<h2 class="detail-title">${escapeHtml(k.title)}</h2>`;
    html += `<p class="muted">${escapeHtml(k.summary)}</p>`;
    k.sections.forEach(sec => {
      html += `<div class="detail-section"><h4>${escapeHtml(sec.h)}</h4>`;
      if (sec.p) html += `<p>${escapeHtml(sec.p)}</p>`;
      if (sec.ul) html += `<ul>${sec.ul.map(li => `<li>${escapeHtml(li)}</li>`).join("")}</ul>`;
      html += `</div>`;
    });
    body.innerHTML = html;
    $("#detail-drawer").classList.remove("hidden");
  }

  function closeDetail() { $("#detail-drawer").classList.add("hidden"); }
  $("#detail-close").addEventListener("click", closeDetail);
  $("#detail-mask").addEventListener("click", closeDetail);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDetail();
  });
  $("#knowledge-search").addEventListener("input", renderKnowledge);

  /* ============================================================
   *  真题练习模块
   * ============================================================ */
  const quiz = {
    pool: [],
    index: 0,
    answers: [],   // 用户选择：-1 表示未答
    submitted: false,
  };

  function initQuiz() {
    const sel = $("#quiz-subject");
    const all = document.createElement("option");
    all.value = "all"; all.textContent = "全部科目";
    sel.appendChild(all);
    SUBJECTS.forEach(s => {
      const o = document.createElement("option");
      o.value = s.id; o.textContent = s.name;
      sel.appendChild(o);
    });

    $("#quiz-start").addEventListener("click", startQuiz);
    $("#quiz-prev").addEventListener("click", () => goQuiz(-1));
    $("#quiz-next").addEventListener("click", () => goQuiz(1));
    $("#quiz-submit").addEventListener("click", submitQuiz);
    $("#quiz-retry").addEventListener("click", resetQuiz);
    $("#quiz-wrong").addEventListener("click", toggleWrong);
  }

  function startQuiz() {
    const subject = $("#quiz-subject").value;
    let pool = QUESTIONS.filter(q => subject === "all" || q.subject === subject);
    pool = shuffle(pool);
    const count = parseInt($("#quiz-count").value, 10);
    if (count > 0) pool = pool.slice(0, count);
    if (!pool.length) return;

    quiz.pool = pool;
    quiz.index = 0;
    quiz.answers = pool.map(() => -1);
    quiz.submitted = false;

    $("#quiz-setup").classList.add("hidden");
    $("#quiz-result").classList.add("hidden");
    $("#quiz-wrong-list").classList.add("hidden");
    $("#quiz-running").classList.remove("hidden");
    renderQuestion();
  }

  function renderQuestion() {
    const q = quiz.pool[quiz.index];
    const wrap = $("#quiz-question-wrap");
    const userAns = quiz.answers[quiz.index];

    const optionsHtml = q.options.map((opt, i) => {
      let cls = "q-option";
      if (quiz.submitted) {
        if (i === q.answer) cls += " correct";
        else if (i === userAns) cls += " wrong";
      } else if (i === userAns) {
        cls += " selected";
      }
      const key = String.fromCharCode(65 + i);
      return `<div class="${cls}" data-i="${i}">
        <span class="q-key">${key}</span>
        <span class="q-text">${escapeHtml(opt)}</span>
      </div>`;
    }).join("");

    let explain = "";
    if (quiz.submitted) {
      explain = `<div class="q-explain"><b>解析：</b>${escapeHtml(q.explain)}</div>`;
    }

    wrap.innerHTML = `
      <div class="q-block">
        <div class="q-stem">${quiz.index + 1}. ${escapeHtml(q.stem)}
          <span class="kn-tag" style="margin-left:8px">${SUBJECT_MAP[q.subject].short}</span>
        </div>
        <div class="q-options">${optionsHtml}</div>
        ${explain}
      </div>`;

    $$(".q-option", wrap).forEach(el => el.addEventListener("click", () => {
      if (quiz.submitted) return;
      quiz.answers[quiz.index] = parseInt(el.dataset.i, 10);
      renderQuestion();
      updateQuizActions();
    }));

    $("#quiz-index").textContent = `第 ${quiz.index + 1} / ${quiz.pool.length} 题`;
    $("#quiz-progress").textContent = `已作答 ${quiz.answers.filter(a => a >= 0).length} 题`;
    updateQuizActions();
  }

  function updateQuizActions() {
    $("#quiz-prev").disabled = quiz.index === 0;
    const isLast = quiz.index === quiz.pool.length - 1;
    $("#quiz-next").classList.toggle("hidden", isLast || quiz.submitted);
    if (quiz.submitted) {
      $("#quiz-submit").classList.add("hidden");
    } else {
      // 到达最后一题或全部作答完毕后，显示交卷按钮
      const allAnswered = quiz.answers.every(a => a >= 0);
      $("#quiz-submit").classList.toggle("hidden", !(isLast || allAnswered));
    }
  }

  function goQuiz(dir) {
    const next = quiz.index + dir;
    if (next < 0 || next >= quiz.pool.length) return;
    quiz.index = next;
    renderQuestion();
  }

  function submitQuiz() {
    const unanswered = quiz.answers.filter(a => a < 0).length;
    if (unanswered > 0) {
      if (!confirm(`还有 ${unanswered} 题未作答，确定交卷吗？`)) return;
    }
    quiz.submitted = true;
    state.quizAnswered += quiz.pool.length;
    persist();
    updateStats();

    // 计算分数
    const correct = quiz.pool.reduce((n, q, i) => n + (quiz.answers[i] === q.answer ? 1 : 0), 0);
    const total = quiz.pool.length;
    const pct = Math.round((correct / total) * 100);

    $("#quiz-running").classList.add("hidden");
    $("#quiz-result").classList.remove("hidden");
    $("#quiz-score").textContent = `${correct} / ${total}  ·  ${pct}分`;
    const wrong = total - correct;
    $("#quiz-summary").textContent = `共 ${total} 题，答对 ${correct} 题，答错 ${wrong} 题。${
      pct >= 80 ? "很棒，继续保持！" : pct >= 60 ? "还需巩固薄弱知识点。" : "建议回到知识点复习后重练。"
    }`;

    // 渲染错题列表
    const wrongList = $("#quiz-wrong-list");
    const wrongItems = quiz.pool
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => quiz.answers[i] !== q.answer);
    if (!wrongItems.length) {
      wrongList.innerHTML = `<p class="muted">全部答对，没有错题！🎉</p>`;
    } else {
      wrongList.innerHTML = wrongItems.map(({ q, i }) => {
        const my = quiz.answers[i] >= 0 ? q.options[quiz.answers[i]] : "（未作答）";
        return `<div class="wrong-item">
          <div class="w-stem">${escapeHtml(q.stem)}</div>
          <div class="w-ans">正确答案：<b>${String.fromCharCode(65 + q.answer)}. ${escapeHtml(q.options[q.answer])}</b></div>
          <div class="w-ans my">你的答案：${escapeHtml(my)}</div>
          <div class="w-ans muted">${escapeHtml(q.explain)}</div>
        </div>`;
      }).join("");
    }
  }

  function toggleWrong() {
    $("#quiz-wrong-list").classList.toggle("hidden");
  }

  function resetQuiz() {
    $("#quiz-result").classList.add("hidden");
    $("#quiz-wrong-list").classList.add("hidden");
    $("#quiz-setup").classList.remove("hidden");
  }

  /* ============================================================
   *  记忆卡片模块（简化艾宾浩斯：3 个记忆盒）
   *    box 0: 新卡/需复习
   *    box 1: 已记住一次
   *    box 2: 掌握（不再出现）
   * ============================================================ */
  const cards = { queue: [], current: null };

  function initCards() {
    const sel = $("#cards-subject");
    const all = document.createElement("option");
    all.value = "all"; all.textContent = "全部科目";
    sel.appendChild(all);
    SUBJECTS.forEach(s => {
      const o = document.createElement("option");
      o.value = s.id; o.textContent = s.name;
      sel.appendChild(o);
    });
    sel.addEventListener("change", renderCards);

    const fc = $("#flashcard");
    fc.addEventListener("click", flipCard);
    fc.addEventListener("keydown", e => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flipCard(); }
    });
    document.addEventListener("keydown", e => {
      if (!isCardsView()) return;
      if (e.key === "ArrowLeft") markCard(false);
      if (e.key === "ArrowRight") markCard(true);
    });
    $("#card-forgot").addEventListener("click", () => markCard(false));
    $("#card-known").addEventListener("click", () => markCard(true));
    $("#card-reset-subject").addEventListener("click", resetCardSubject);
  }

  function isCardsView() { return !$("#view-cards").classList.contains("hidden"); }

  function buildQueue() {
    const subject = $("#cards-subject").value;
    return CARDS.filter(c => {
      if (subject !== "all" && c.subject !== subject) return false;
      const st = state.cardStates[c.id];
      // 未学过或未掌握的进入队列
      return !st || st.box < 2;
    });
  }

  function renderCards() {
    cards.queue = shuffle(buildQueue());
    cards.current = cards.queue[0] || null;

    const total = CARDS.filter(c => {
      const subject = $("#cards-subject").value;
      return subject === "all" || c.subject === subject;
    }).length;
    const mastered = CARDS.filter(c => state.cardStates[c.id]?.box >= 2).length;
    $("#cards-meta").textContent = `本组待复习 ${cards.queue.length} 张 · 已掌握 ${mastered} / ${total}`;

    if (!cards.current) {
      $("#flashcard").classList.add("hidden");
      $(".cards-actions").classList.add("hidden");
      $("#cards-empty").classList.remove("hidden");
      return;
    }
    $("#flashcard").classList.remove("hidden");
    $(".cards-actions").classList.remove("hidden");
    $("#cards-empty").classList.add("hidden");
    showCard(cards.current);
  }

  function showCard(card) {
    $("#fc-term").textContent = card.term;
    $("#fc-def").textContent = card.def;
    $("#flashcard").classList.remove("flipped");
  }

  function flipCard() {
    if (!cards.current) return;
    $("#flashcard").classList.toggle("flipped");
  }

  function markCard(known) {
    if (!cards.current) return;
    const id = cards.current.id;
    const prev = state.cardStates[id] || { box: 0 };
    let box = prev.box;
    if (known) {
      box = Math.min(2, box + 1);
      if (box === 2) state.cardsLearned += 1; // 首次掌握
    } else {
      box = 0; // 没记住回到第一格
    }
    state.cardStates[id] = { box, due: Date.now() };
    persist();
    updateStats();

    // 下一张
    cards.queue.shift();
    cards.current = cards.queue[0] || null;
    if (!cards.current) {
      renderCards();
      return;
    }
    showCard(cards.current);
    $("#cards-meta").textContent = `本组待复习 ${cards.queue.length} 张`;
  }

  function resetCardSubject() {
    const subject = $("#cards-subject").value;
    CARDS.forEach(c => {
      if (subject === "all" || c.subject === subject) delete state.cardStates[c.id];
    });
    persist();
    renderCards();
  }

  /* ============================================================
   *  统计与重置
   * ============================================================ */
  function updateStats() {
    $("#stat-quiz").textContent = state.quizAnswered || 0;
    $("#stat-cards").textContent = state.cardsLearned || 0;
  }

  $("#reset-progress").addEventListener("click", () => {
    if (!confirm("确定要清空全部练习与背诵进度吗？此操作不可恢复。")) return;
    state.quizAnswered = 0;
    state.cardsLearned = 0;
    state.cardStates = {};
    persist();
    updateStats();
    if (isCardsView()) renderCards();
  });

  /* ---------- 安全转义 ---------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- 启动 ---------- */
  initKnowledgeChips();
  initQuiz();
  initCards();
  updateStats();
  renderKnowledge();
})();
