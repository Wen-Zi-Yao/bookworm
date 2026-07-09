/**
 * 书虫 — 前端应用
 * 纯原生 JS，按视图模块组织
 */

// ==================== 全局状态 ====================

const state = {
  currentView: "shelf",
  currentBook: null,
  books: [],
};

// ==================== DOM 工具 ====================

function $(sel, parent) { return (parent || document).querySelector(sel); }
function $$(sel, parent) { return Array.from((parent || document).querySelectorAll(sel)); }

// ==================== Toast 通知 ====================

function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ==================== 弹窗 ====================

function showModal(title, content, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>${title}</h2>
      <div>${content}</div>
      <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-ghost" id="modal-cancel">取消</button>
        <button class="btn btn-primary" id="modal-confirm">确定</button>
      </div>
    </div>
  `;
  document.getElementById("modal-container").appendChild(overlay);

  $("#modal-cancel", overlay).onclick = () => overlay.remove();
  $("#modal-confirm", overlay).onclick = () => {
    const result = onConfirm(overlay);
    if (result !== false) overlay.remove();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ==================== 视图切换 ====================

function switchView(view, data = {}) {
  state.currentView = view;
  state.currentBook = data.book || null;

  // 导航高亮
  $$(".nav-links a").forEach(a => a.classList.remove("active"));
  const navLink = $(`.nav-links a[data-view="${view}"]`);
  if (navLink) navLink.classList.add("active");

  // 路由
  const routes = {
    shelf: renderShelf,
    book: renderBook,
    socratic: renderSocratic,
    quiz: renderQuiz,
    compare: renderCompare,
    concept: renderConcept,
    profile: renderProfile,
    match: renderMatch,
  };

  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  (routes[view] || renderShelf)(data).then(html => {
    app.innerHTML = html;
    afterRender(view);
  }).catch(err => {
    app.innerHTML = `<div class="empty"><div class="icon">😵</div><p>${err.message}</p></div>`;
  });
}

function afterRender(view) {
  // 绑定各视图的事件
  if (view === "shelf") bindShelfEvents();
  if (view === "book") bindBookEvents();
  if (view === "socratic") bindSocraticEvents();
  if (view === "quiz") bindQuizEvents();
  if (view === "compare") bindCompareEvents();
  if (view === "concept") bindConceptEvents();
  if (view === "profile") bindProfileEvents();
  if (view === "match") bindMatchEvents();
}

// ==================== 导航事件 ====================

document.getElementById("nav-home").addEventListener("click", () => switchView("shelf"));
$$(".nav-links a").forEach(a => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    switchView(a.dataset.view);
  });
});

// ==================== 视图一：书架 ====================

async function renderShelf() {
  const res = await fetch("/api/books");
  state.books = await res.json();

  if (state.books.length === 0) {
    return `
      <div class="empty">
        <div class="icon">📚</div>
        <p>书架还是空的</p>
        <p style="font-size:13px;">把正在读的书加进来，书虫帮你读得更深</p>
      </div>
      <div class="bookshelf">
        <div class="add-book-card" id="btn-add-book">+</div>
      </div>
    `;
  }

  const cards = state.books.map(b => `
    <div class="book-card" data-id="${b.id}">
      <div class="book-emoji">${getBookEmoji(b.title)}</div>
      <div class="book-title">${escapeHtml(b.title)}</div>
      <div class="book-author">${escapeHtml(b.author)}</div>
      <div class="book-meta">${b.notes.length} 篇笔记</div>
    </div>
  `).join("");

  return `
    <div class="bookshelf">
      ${cards}
      <div class="add-book-card" id="btn-add-book">+</div>
    </div>
  `;
}

function bindShelfEvents() {
  // 点击书籍卡片 → 进入书籍详情
  $$(".book-card").forEach(card => {
    card.addEventListener("click", () => {
      const book = state.books.find(b => b.id === card.dataset.id);
      if (book) switchView("book", { book });
    });
  });

  // 添加书籍弹窗
  $("#btn-add-book")?.addEventListener("click", () => {
    showModal("添加一本书", `
      <div class="form-group">
        <label>书名</label>
        <input class="input" id="new-book-title" placeholder="比如：文心雕龙">
      </div>
      <div class="form-group">
        <label>作者</label>
        <input class="input" id="new-book-author" placeholder="比如：刘勰">
      </div>
    `, async (overlay) => {
      const title = $("#new-book-title", overlay).value.trim();
      const author = $("#new-book-author", overlay).value.trim();
      if (!title) { toast("请输入书名", "error"); return false; }

      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author }),
      });
      const book = await res.json();
      if (book.error) { toast(book.error, "error"); return; }
      toast(`📚 《${book.title}》已加入书架`);
      switchView("shelf");
    });
  });
}

// ==================== 视图二：书籍详情 ====================

async function renderBook({ book }) {
  const res = await fetch(`/api/books/${book.id}`);
  const fresh = await res.json();
  state.currentBook = fresh;

  const notesHtml = fresh.notes.length === 0
    ? `<div class="empty"><div class="icon">📝</div><p>还没有笔记</p><p style="font-size:13px;">读到有感触的地方，随手记下来。AI 会帮你挖出你没注意到的角度。</p></div>`
    : fresh.notes.slice().reverse().map(n => `
      <div class="note-item ${n.analysis ? "" : "open"}">
        <div class="note-item-header">
          <span>${n.chapter ? "📖 " + escapeHtml(n.chapter) : "📝 笔记"} · ${timeAgo(n.createdAt)}</span>
          <span style="font-size:12px;color:var(--text-light);">${n.analysis ? "✅ AI 已分析" : "⏳ 点击分析"}</span>
        </div>
        <div class="note-item-body">
          <div class="note-content">${escapeHtml(n.content)}</div>
          ${n.analysis ? `<div class="analysis-block">${markdownToHtml(n.analysis)}</div>` : ""}
          <div style="margin-top:10px;display:flex;gap:8px;">
            ${n.analysis ? "" : `<button class="btn btn-primary btn-sm analyze-note-btn" data-note-id="${n.id}">🔍 AI 深度分析</button>`}
            <button class="btn btn-ghost btn-sm delete-note-btn" data-note-id="${n.id}">删除</button>
          </div>
        </div>
      </div>
    `).join("");

  return `
    <button class="btn btn-ghost" id="btn-back" style="margin-bottom:12px;">← 返回书架</button>

    <div class="book-header">
      <h1>${getBookEmoji(fresh.title)} ${escapeHtml(fresh.title)}</h1>
      <div class="author">${escapeHtml(fresh.author)}</div>
    </div>

    <!-- 工具箱 -->
    ${fresh.notes.length > 0 ? `
    <div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <span style="font-size:13px;color:var(--text-light);font-weight:600;">🛠 工具箱</span>
      <button class="btn btn-outline btn-sm" id="btn-gen-report">📋 生成读书报告</button>
      <button class="btn btn-outline btn-sm" id="btn-gen-discussion">💬 准备课堂讨论</button>
      <button class="btn btn-outline btn-sm" id="btn-socratic">🗣️ 苏格拉底对话</button>
      <button class="btn btn-outline btn-sm" id="btn-gen-quiz">✅ 理解力检测</button>
      <button class="btn btn-outline btn-sm" id="btn-gen-graph">✨ 知识星图</button>
      <button class="btn btn-outline btn-sm" id="btn-gen-wordcloud">☁️ 词云</button>
    </div>
    ` : ""}

    <div class="card">
      <div class="form-group">
        <label>写笔记</label>
        <input class="input" id="note-chapter" placeholder="章节（可选）：第一章 魔幻与现实" style="margin-bottom:8px;">
        <textarea class="input" id="note-content" placeholder="不要只摘抄。写下你的想法、质疑、联想。&#10;&#10;好的笔记是这样的：&#10;'作者在这里用循环时间打破了线性叙事，这让我想到xxx…但我怀疑他回避了xxx这个问题。'&#10;&#10;AI 会基于你的思考做深度分析，而不是帮你写摘要。"></textarea>
      </div>
      <button class="btn btn-primary" id="btn-save-note">💾 保存并分析</button>
    </div>

    ${fresh.notes.length > 0 ? `<h3 style="margin:20px 0 10px;">📝 读书笔记 (${fresh.notes.length}篇)</h3>` : ""}
    <div class="note-list">${notesHtml}</div>

    <!-- 读书报告区域 -->
    <div id="report-section" style="display:none;">
      <h3 style="margin:20px 0 10px;">📋 读书报告</h3>
      <div class="analysis-block" id="report-content"></div>
    </div>

    <!-- 讨论问题区域 -->
    <div id="discussion-section" style="display:none;">
      <h3 style="margin:20px 0 10px;">💬 课堂讨论准备</h3>
      <div class="analysis-block" id="discussion-content"></div>
    </div>

    <!-- 星图区域 -->
    <div id="graph-section" style="display:none;">
      <h3 style="margin:20px 0 10px;">✨ 知识星图</h3>
      <div class="graph-container" id="graph-container"></div>
    </div>
  `;
}

function bindBookEvents() {
  $("#btn-back")?.addEventListener("click", () => switchView("shelf"));

  // 保存笔记
  $("#btn-save-note")?.addEventListener("click", async () => {
    const chapter = $("#note-chapter").value.trim();
    const content = $("#note-content").value.trim();

    if (content.length < 20) { toast("笔记至少20个字，写写你的思考吧", "error"); return; }

    const btn = $("#btn-save-note");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> AI 分析中...';

    try {
      const res = await fetch(`/api/books/${state.currentBook.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter, content }),
      });
      const note = await res.json();
      if (note.error) throw new Error(note.error);

      toast("✅ 笔记已保存，AI 分析完成");

      // 同时获取标签和跨书关联
      fetch(`/api/notes/tag-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, bookTitle: state.currentBook.title }),
      }).then(r => r.json()).then(linkData => {
        if (linkData.tags?.length > 0) {
          toast(`🏷️ 标签：${linkData.tags.join(" · ")}`);
        }
      }).catch(() => {});

      switchView("book", { book: state.currentBook });
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
      btn.textContent = "💾 保存笔记";
    }
  });

  // 生成星图
  $("#btn-gen-graph")?.addEventListener("click", async () => {
    const graphSection = document.getElementById("graph-section");
    graphSection.style.display = "block";

    const container = document.getElementById("graph-container");
    container.innerHTML = '<div class="loading"><div class="spinner"></div>AI 正在构建知识网络...</div>';

    try {
      const res = await fetch(`/api/books/${state.currentBook.id}/graph`, { method: "POST" });
      const graph = await res.json();
      if (graph.error) throw new Error(graph.error);

      drawGraph(container, graph);
      graphSection.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      container.innerHTML = `<div class="empty"><p>😵 ${err.message}</p></div>`;
    }
  });

  // 苏格拉底对话
  $("#btn-socratic")?.addEventListener("click", () => {
    switchView("socratic", { book: state.currentBook });
  });

  // 理解力检测
  $("#btn-gen-quiz")?.addEventListener("click", () => {
    switchView("quiz", { book: state.currentBook });
  });

  // 词云
  $("#btn-gen-wordcloud")?.addEventListener("click", async () => {
    const section = document.getElementById("graph-section");
    const container = document.getElementById("graph-container");
    section.style.display = "block";
    container.innerHTML = '<div class="loading"><div class="spinner"></div>AI 正在分析关键词...</div>';
    section.scrollIntoView({ behavior: "smooth" });

    try {
      const res = await fetch("/api/wordcloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: state.currentBook.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      container.innerHTML = `<canvas class="graph-canvas" id="wordcloud-canvas"></canvas>`;
      drawWordCloud(document.getElementById("wordcloud-canvas"), data.words);
    } catch (err) {
      container.innerHTML = `<div class="empty"><p>😵 ${err.message}</p></div>`;
    }
  });

  // 生成读书报告
  $("#btn-gen-report")?.addEventListener("click", async () => {
    const section = document.getElementById("report-section");
    const content = document.getElementById("report-content");
    section.style.display = "block";
    content.innerHTML = '<div class="loading"><div class="spinner"></div>正在撰写读书报告...</div>';
    section.scrollIntoView({ behavior: "smooth" });

    try {
      const res = await fetch(`/api/books/${state.currentBook.id}/report`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      content.innerHTML = markdownToHtml(data.report);
    } catch (err) {
      content.innerHTML = `<div class="empty"><p>😵 ${err.message}</p></div>`;
    }
  });

  // 生成课堂讨论
  $("#btn-gen-discussion")?.addEventListener("click", async () => {
    const section = document.getElementById("discussion-section");
    const content = document.getElementById("discussion-content");
    section.style.display = "block";
    content.innerHTML = '<div class="loading"><div class="spinner"></div>正在设计讨论问题...</div>';
    section.scrollIntoView({ behavior: "smooth" });

    try {
      const res = await fetch(`/api/books/${state.currentBook.id}/discussion`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      content.innerHTML = markdownToHtml(data.points);
    } catch (err) {
      content.innerHTML = `<div class="empty"><p>😵 ${err.message}</p></div>`;
    }
  });

  // 折叠/展开笔记
  $$(".note-item-header").forEach(header => {
    header.addEventListener("click", () => {
      header.parentElement.classList.toggle("open");
    });
  });

  // AI 分析未分析的笔记
  $$(".analyze-note-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const noteId = btn.dataset.noteId;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      // 重新调用分析：添加一条同样的笔记触发分析
      const note = state.currentBook.notes.find(n => n.id === noteId);
      if (!note) return;

      try {
        await fetch(`/api/books/${state.currentBook.id}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapter: note.chapter, content: note.content }),
        });
        // 删掉旧笔记
        await fetch(`/api/books/${state.currentBook.id}/notes/${noteId}`, { method: "DELETE" });
        toast("✅ 分析完成");
        switchView("book", { book: state.currentBook });
      } catch (err) {
        toast(err.message, "error");
        btn.disabled = false;
        btn.textContent = "🔍 AI 分析";
      }
    });
  });

  // 删除笔记
  $$(".delete-note-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const noteId = btn.dataset.noteId;
      if (!confirm("确定删除这篇笔记？")) return;

      await fetch(`/api/books/${state.currentBook.id}/notes/${noteId}`, { method: "DELETE" });
      toast("已删除");
      switchView("book", { book: state.currentBook });
    });
  });
}

// ==================== 星图绘制 (Canvas) ====================

function drawGraph(container, graph) {
  container.innerHTML = `<canvas class="graph-canvas" id="graph-canvas"></canvas>`;
  const canvas = document.getElementById("graph-canvas");
  const ctx = canvas.getContext("2d");

  // 适配容器大小
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * 2;   // 高清
  canvas.height = 500 * 2;
  canvas.style.width = rect.width + "px";
  canvas.style.height = "500px";
  ctx.scale(2, 2);

  const W = rect.width;
  const H = 500;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.32;

  // 节点布局：围绕中心排列
  const nodes = graph.nodes.map((node, i) => {
    const angle = i === 0 && node.id === graph.centralConcept
      ? -Math.PI / 2  // 中心节点放顶部
      : (i / graph.nodes.length) * Math.PI * 2 - Math.PI / 2;
    // 中心节点靠近圆心
    const dist = node.id === graph.centralConcept ? radius * 0.1 : radius * (0.55 + 0.45 * Math.random());
    return {
      ...node,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  });

  // 画边
  (graph.edges || []).forEach(edge => {
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return;

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = "#e0d5c0";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 边的标签
    if (edge.label) {
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y + tgt.y) / 2;
      ctx.fillStyle = "#b0a590";
      ctx.font = "11px 'PingFang SC', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(edge.label, mx, my - 4);
    }
  });

  // 画节点
  nodes.forEach(node => {
    const isCentral = node.id === graph.centralConcept;
    const r = isCentral ? 32 : 18 + node.weight * 3;

    // 节点圆
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

    // 颜色：按 category
    const colors = {
      "主题": "#d4753e",
      "人物": "#5b8c5a",
      "事件": "#c0392b",
      "理论": "#4a7fb5",
      "概念": "#8e6cb5",
    };
    const fillColor = colors[node.category] || "#d4753e";
    ctx.fillStyle = fillColor;
    ctx.fill();

    if (isCentral) {
      ctx.strokeStyle = "#2c2416";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 标签
    ctx.fillStyle = isCentral ? "#fff" : "#2c2416";
    ctx.font = `${isCentral ? "bold 13px" : "12px"} 'PingFang SC', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = node.label.length > 6 ? node.label.slice(0, 6) + "…" : node.label;
    ctx.fillText(label, node.x, node.y);

    // 非中心节点的完整标签显示在下方
    if (!isCentral && node.label.length > 6) {
      ctx.fillStyle = "#8b7e6a";
      ctx.font = "10px 'PingFang SC', sans-serif";
      ctx.fillText(node.label, node.x, node.y + r + 14);
    }
    if (isCentral) {
      ctx.fillStyle = "#2c2416";
      ctx.font = "bold 13px 'PingFang SC', sans-serif";
      ctx.fillText(node.label, node.x, node.y + r + 16);
    }
  });

  // 图例
  const legendY = H - 30;
  const categories = [...new Set(nodes.map(n => n.category))];
  let lx = 20;
  categories.forEach(cat => {
    const catColor = {
      "主题": "#d4753e",
      "人物": "#5b8c5a",
      "事件": "#c0392b",
      "理论": "#4a7fb5",
      "概念": "#8e6cb5",
    }[cat] || "#d4753e";

    ctx.fillStyle = catColor;
    ctx.beginPath();
    ctx.arc(lx, legendY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8b7e6a";
    ctx.font = "11px 'PingFang SC', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(cat, lx + 10, legendY);

    lx += ctx.measureText(cat).width + 30;
  });
}

// ==================== 视图三：苏格拉底对话 ====================

async function renderSocratic({ book }) {
  state.currentBook = book;
  return `
    <button class="btn btn-ghost" id="btn-back-book" style="margin-bottom:12px;">← 返回《${escapeHtml(book.title)}》</button>

    <div class="book-header">
      <h1>🗣️ 苏格拉底对话</h1>
      <div class="author">正在读：《${escapeHtml(book.title)}》</div>
    </div>

    <div class="card" style="background:linear-gradient(135deg,#fefdf9 0%,#fdf7f0 100%);border:1px solid #e8d5b7;">
      <p style="font-size:13px;color:var(--text-light);margin-bottom:8px;">
        💡 AI 不会给你答案，而是通过追问帮你把思考推向深处。共 3 轮对话。
      </p>
      <div class="form-group">
        <label>写下你对这本书的思考</label>
        <textarea class="input" id="socratic-input" placeholder="不要只是概括书中内容。写下你真正的思考——你对作者的观点有什么质疑？你联想到了什么？你觉得哪里不对？&#10;&#10;好的开头：'作者在这里隐含了一个前提……'、'如果换一个角度……'、'我不确定我是否同意……'" style="min-height:120px;"></textarea>
      </div>
      <button class="btn btn-primary" id="btn-start-socratic">开始对话</button>
    </div>

    <div id="socratic-history"></div>
  `;
}

function bindSocraticEvents() {
  $("#btn-back-book")?.addEventListener("click", () => {
    switchView("book", { book: state.currentBook });
  });

  let dialogueHistory = [];
  let currentRound = 1;

  $("#btn-start-socratic")?.addEventListener("click", async () => {
    const thought = $("#socratic-input").value.trim();
    if (thought.length < 10) { toast("请至少写10个字，写下你真正的思考", "error"); return; }

    const btn = $("#btn-start-socratic");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> AI 思考中...';

    try {
      const res = await fetch("/api/socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookTitle: state.currentBook.title,
          thought,
          round: currentRound,
          history: dialogueHistory,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      dialogueHistory.push({ user: thought, question: data.reply });

      const historyEl = document.getElementById("socratic-history");
      const roundLabel = currentRound < 3 ? `第 ${currentRound} / 3 轮` : "最后一轮";
      historyEl.innerHTML += `
        <div class="card" style="border-left:3px solid var(--accent);margin-top:12px;">
          <div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:8px;">${roundLabel}</div>
          <div style="background:#fdfaf6;padding:12px;border-radius:8px;margin-bottom:10px;font-size:14px;">
            <strong>你说：</strong>${escapeHtml(thought)}
          </div>
          <div style="padding:12px;border-radius:8px;font-size:14px;line-height:1.9;">
            ${markdownToHtml(data.reply)}
          </div>
        </div>
      `;

      currentRound++;

      if (currentRound > 3) {
        // 3轮结束
        btn.style.display = "none";
        document.getElementById("socratic-input").style.display = "none";
        historyEl.innerHTML += `
          <div class="card" style="text-align:center;margin-top:16px;background:#fefdf9;">
            <p style="font-size:15px;font-weight:600;">对话结束</p>
            <p style="font-size:13px;color:var(--text-light);">3 轮追问完成。如果你想继续深入某个方向，把新的思考写下来，可以重新开始一轮对话。</p>
            <button class="btn btn-primary" id="btn-restart-socratic">重新开始</button>
          </div>
        `;
        document.getElementById("btn-restart-socratic")?.addEventListener("click", () => {
          dialogueHistory = [];
          currentRound = 1;
          switchView("socratic", { book: state.currentBook });
        });
      } else {
        // 更新输入区标签
        document.querySelector("#socratic-history").previousElementSibling.querySelector("label").textContent =
          `第 ${currentRound} 轮：回应 AI 的追问`;
        $("#socratic-input").value = "";
        $("#socratic-input").placeholder = "AI 在追问你。不要简单回答'是'或'不是'——解释你的理由，或者质疑这个追问本身……";
        btn.textContent = `回应追问（第 ${currentRound} 轮）`;
      }
    } catch (err) {
      toast(err.message, "error");
    }

    btn.disabled = false;
  });
}

// ==================== 词云绘制 ====================

function drawWordCloud(canvas, words) {
  if (!words || words.length === 0) {
    canvas.parentElement.innerHTML = '<div class="empty"><p>没有提取到关键词</p></div>';
    return;
  }

  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  const W = rect.width;
  const H = 500;

  canvas.width = W * 2;
  canvas.height = H * 2;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  // 颜色方案 — 暖色系
  const colors = ["#d4753e", "#b85d2e", "#8e6cb5", "#4a7fb5", "#5b8c5a", "#c0392b", "#8b5e3c"];
  const maxWeight = Math.max(...words.map(w => w.weight));
  const minWeight = Math.min(...words.map(w => w.weight));

  // 按权重排序，高权重的放中间
  words.sort((a, b) => b.weight - a.weight);

  // 简单螺旋布局
  const cx = W / 2, cy = H / 2;
  let angle = 0, radius = 10;
  const placed = [];

  words.forEach((word, idx) => {
    const fontSize = 14 + ((word.weight - minWeight) / (maxWeight - minWeight || 1)) * 28;
    ctx.font = `${fontWeight(word.weight, maxWeight)} ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = colors[idx % colors.length];

    // 螺旋找位置
    let x, y;
    const metrics = ctx.measureText(word.text);
    const tw = metrics.width;
    const th = fontSize;

    for (let attempt = 0; attempt < 200; attempt++) {
      x = cx + radius * Math.cos(angle);
      y = cy + radius * Math.sin(angle);
      angle += 0.5;
      radius += 2;

      // 碰撞检测
      const overlap = placed.some(p => {
        return !(x + tw / 2 < p.x - p.w / 2 || x - tw / 2 > p.x + p.w / 2 ||
                 y + th / 2 < p.y - p.h / 2 || y - th / 2 > p.y + p.h / 2);
      });

      if (!overlap || attempt === 199) {
        placed.push({ x, y, w: tw, h: th });
        break;
      }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(word.text, x, y);
  });
}

function fontWeight(weight, max) {
  if (weight >= max * 0.8) return "bold 900";
  if (weight >= max * 0.5) return "bold 700";
  return "500";
}

// ==================== 视图四：理解力检测 ====================

async function renderQuiz({ book }) {
  state.currentBook = book;
  return `
    <button class="btn btn-ghost" id="btn-back-book" style="margin-bottom:12px;">← 返回《${escapeHtml(book.title)}》</button>
    <div class="book-header">
      <h1>✅ 理解力检测</h1>
      <div class="author">《${escapeHtml(book.title)}》· 检测你是否真的读懂了</div>
    </div>
    <button class="btn btn-primary" id="btn-start-quiz">开始出题</button>
    <div id="quiz-area"></div>
    <div id="quiz-result"></div>
  `;
}

function bindQuizEvents() {
  $("#btn-back-book")?.addEventListener("click", () => {
    switchView("book", { book: state.currentBook });
  });

  $("#btn-start-quiz")?.addEventListener("click", async () => {
    const btn = $("#btn-start-quiz");
    const area = document.getElementById("quiz-area");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> AI 正在出题...';

    try {
      const res = await fetch(`/api/books/${state.currentBook.id}/quiz`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      state.quizData = data.questions;
      btn.style.display = "none";

      let html = `<form id="quiz-form">`;
      data.questions.forEach((q, i) => {
        if (q.type === "choice") {
          html += `
            <div class="card" style="margin-top:12px;">
              <div style="font-weight:700;margin-bottom:8px;">${i + 1}. [选择题] ${escapeHtml(q.question)}</div>
              ${q.options.map((opt, oi) => `
                <label style="display:block;padding:6px 0;cursor:pointer;font-size:14px;">
                  <input type="radio" name="q${i}" value="${String.fromCharCode(65 + oi)}"> ${escapeHtml(opt)}
                </label>
              `).join("")}
            </div>`;
        } else {
          html += `
            <div class="card" style="margin-top:12px;">
              <div style="font-weight:700;margin-bottom:8px;">${i + 1}. [简答题] ${escapeHtml(q.question)}</div>
              <textarea class="input" name="q${i}" style="min-height:80px;" placeholder="写下你的理解..."></textarea>
            </div>`;
        }
      });
      html += `<button class="btn btn-primary" type="submit" style="margin-top:16px;">提交答案</button></form>`;
      area.innerHTML = html;

      $("#quiz-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const resultEl = document.getElementById("quiz-result");
        let resultHtml = `<h3 style="margin-top:20px;">📊 检测结果</h3>`;

        data.questions.forEach((q, i) => {
          if (q.type === "choice") {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            const userAnswer = selected ? selected.value : "未作答";
            const isCorrect = userAnswer === q.answer;
            resultHtml += `
              <div class="card" style="border-left:3px solid ${isCorrect ? '#5b8c5a' : '#c0392b'};margin-top:10px;">
                <div><strong>${i + 1}.</strong> ${isCorrect ? '✅' : '❌'} ${escapeHtml(q.question)}</div>
                <div style="font-size:13px;margin-top:4px;">你的答案：<strong>${userAnswer}</strong> | 正确答案：<strong>${q.answer}</strong></div>
                <div style="font-size:13px;color:var(--text-light);margin-top:4px;">${escapeHtml(q.explanation)}</div>
              </div>`;
          } else {
            resultHtml += `
              <div class="card" style="margin-top:10px;">
                <div><strong>${i + 1}.</strong> 📝 ${escapeHtml(q.question)}</div>
                <div style="font-size:13px;margin-top:4px;">你的回答：${escapeHtml(document.querySelector(\`textarea[name="q${i}"]\`)?.value || "未作答")}</div>
                <div style="font-size:13px;color:var(--text-light);margin-top:4px;">参考要点：${escapeHtml(q.referenceAnswer)}</div>
                <div style="font-size:12px;color:var(--accent);margin-top:4px;">${escapeHtml(q.scoringGuide)}</div>
              </div>`;
          }
        });

        resultEl.innerHTML = resultHtml;
      });
    } catch (err) {
      area.innerHTML = `<div class="empty"><p>😵 ${err.message}</p></div>`;
    }
    btn.disabled = false;
    btn.textContent = "开始出题";
  });
}

// ==================== 视图五：跨文本对比 ====================

async function renderCompare() {
  const res = await fetch("/api/books");
  const books = await res.json();
  const withNotes = books.filter(b => b.notes.length > 0);

  if (withNotes.length < 2) {
    return `<div class="empty"><div class="icon">⚖️</div><p>至少需要两本有笔记的书才能进行对比分析</p><p style="font-size:13px;">先去写几篇笔记吧</p></div>`;
  }

  const options = withNotes.map(b =>
    `<option value="${b.id}">${escapeHtml(b.title)}（${b.notes.length}篇笔记）</option>`
  ).join("");

  return `
    <h2 style="margin-bottom:6px;">⚖️ 跨文本对比分析</h2>
    <p style="color:var(--text-light);font-size:13px;margin-bottom:20px;">选择两本书，AI 分析它们在主题、方法和观点上的异同</p>

    <div class="card">
      <div class="form-group">
        <label>第一本书</label>
        <select class="input" id="compare-book-a">${options}</select>
      </div>
      <div class="form-group">
        <label>第二本书</label>
        <select class="input" id="compare-book-b">${options}</select>
      </div>
      <button class="btn btn-primary" id="btn-do-compare">生成对比报告</button>
    </div>
    <div id="compare-result"></div>
  `;
}

function bindCompareEvents() {
  $("#btn-do-compare")?.addEventListener("click", async () => {
    const bookIdA = $("#compare-book-a").value;
    const bookIdB = $("#compare-book-b").value;
    if (bookIdA === bookIdB) { toast("请选两本不同的书", "error"); return; }

    const btn = $("#btn-do-compare");
    const resultEl = document.getElementById("compare-result");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> AI 正在对比分析...';
    resultEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookIdA, bookIdB }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      resultEl.innerHTML = `<div class="analysis-block" style="margin-top:16px;">${markdownToHtml(data.report)}</div>`;
    } catch (err) {
      resultEl.innerHTML = `<div class="empty"><p>😵 ${err.message}</p></div>`;
    }
    btn.disabled = false;
    btn.textContent = "生成对比报告";
  });
}

// ==================== 视图六：概念追踪 ====================

async function renderConcept() {
  // 获取所有有笔记的书籍
  const res = await fetch("/api/books");
  const books = await res.json();
  const booksWithNotes = books.filter(b => b.notes.length > 0);

  if (booksWithNotes.length === 0) {
    return `<div class="empty"><div class="icon">🔍</div><p>还没有读书笔记，无法进行概念追踪</p><p style="font-size:13px;">先添加一些笔记再来吧</p></div>`;
  }

  const bookList = booksWithNotes.map(b =>
    `<span style="display:inline-block;background:#f5f0e8;padding:3px 10px;border-radius:12px;font-size:12px;margin:2px;">${escapeHtml(b.title)}（${b.notes.length}篇笔记）</span>`
  ).join(" ");

  return `
    <h2 style="margin-bottom:6px;">🔍 跨书概念追踪</h2>
    <p style="color:var(--text-light);font-size:13px;margin-bottom:20px;">
      追踪一个概念在不同著作中的演变脉络。比如追踪"荒诞"从加缪到卡夫卡的变化。
    </p>

    <div style="margin-bottom:16px;font-size:13px;color:var(--text-light);">
      当前可追踪的书目：${bookList}
    </div>

    <div class="card">
      <div class="form-group">
        <label>输入你想追踪的概念</label>
        <input class="input" id="concept-input" placeholder="比如：荒诞 · 权力 · 自由意志 · 阶级斗争 · 循环时间 · 沉默……">
      </div>
      <button class="btn btn-primary" id="btn-track-concept">🔍 开始追踪</button>
    </div>

    <div id="concept-result"></div>
  `;
}

function bindConceptEvents() {
  $("#btn-track-concept")?.addEventListener("click", async () => {
    const concept = $("#concept-input").value.trim();
    if (concept.length < 2) { toast("请输入至少2个字的概念", "error"); return; }

    const btn = $("#btn-track-concept");
    const resultEl = document.getElementById("concept-result");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 追踪中...';
    resultEl.innerHTML = '<div class="loading"><div class="spinner"></div>AI 正在跨书追踪这个概念...</div>';

    try {
      const res = await fetch("/api/concept-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      resultEl.innerHTML = `<div class="analysis-block" style="margin-top:16px;">${markdownToHtml(data.track)}</div>`;
    } catch (err) {
      resultEl.innerHTML = `<div class="empty"><p>😵 ${err.message}</p></div>`;
    }

    btn.disabled = false;
    btn.textContent = "🔍 开始追踪";
  });
}

// ==================== 视图五：阅读画像 ====================

async function renderProfile() {
  try {
    const res = await fetch("/api/profile", { method: "POST" });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    return `
      <h2 style="margin-bottom:6px;">🧠 我的阅读画像</h2>
      <p style="color:var(--text-light);font-size:13px;margin-bottom:20px;">AI 根据你的笔记分析你的阅读风格和思想倾向</p>
      <div class="profile-block">${markdownToHtml(data.profile)}</div>
      <div style="margin-top:16px;text-align:center;">
        <button class="btn btn-primary" id="btn-go-match">🤝 去找气味相投的书友 →</button>
      </div>
    `;
  } catch (err) {
    return `<div class="empty"><div class="icon">📭</div><p>还没有足够的数据生成阅读画像</p><p style="font-size:13px;">至少读完一本书、写几篇笔记再来吧</p></div>`;
  }
}

function bindProfileEvents() {
  $("#btn-go-match")?.addEventListener("click", () => switchView("match"));
}

// ==================== 视图四：发现书友 ====================

async function renderMatch() {
  try {
    const res = await fetch("/api/match", { method: "POST" });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const matchesHtml = data.matches.map((m, i) => `
      <div class="match-card">
        <div class="match-avatar">${["📚","📖","📕","📘","📙"][i % 5]}</div>
        <div class="match-info">
          <div class="match-name">${escapeHtml(m.name)}</div>
          <div class="match-reason">${escapeHtml(m.reason)}</div>
          <div class="match-topic">💬 ${escapeHtml(m.topic)}</div>
        </div>
        <div class="match-score">${m.score}%</div>
      </div>
    `).join("");

    return `
      <h2 style="margin-bottom:6px;">🤝 发现书友</h2>
      <p style="color:var(--text-light);font-size:13px;margin-bottom:20px;">不只匹配读了什么书，更匹配怎么思考问题</p>

      <div class="card" style="margin-bottom:20px;">
        <h3 style="margin-bottom:12px;">📊 你的阅读画像摘要</h3>
        <div style="font-size:14px;line-height:1.8;">${markdownToHtml(data.myProfile)}</div>
      </div>

      <h3 style="margin-bottom:12px;">气味相投的书友</h3>
      <div class="match-list">${matchesHtml}</div>
    `;
  } catch (err) {
    return `<div class="empty"><div class="icon">🔍</div><p>${err.message}</p><p style="font-size:13px;">先添加一些读书笔记再来匹配吧</p></div>`;
  }
}

function bindMatchEvents() {
  // 匹配页面暂无特殊交互
}

// ==================== 工具函数 ====================

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

function getBookEmoji(title) {
  const map = {
    "百年孤独": "🦋", "活着": "🐂", "局外人": "☀️",
    "三体": "🌌", "红楼梦": "🏮", "围城": "🏰",
    "1984": "👁️", "小王子": "🌹", "挪威的森林": "🌲",
    "平凡的世界": "🏔️", "人类简史": "🗺️", "骆驼祥子": "🐪",
    "杀死一只知更鸟": "🐦", "霍乱时期的爱情": "💛",
  };
  return map[title] || "📖";
}

/**
 * 简易 Markdown → HTML
 */
function markdownToHtml(md) {
  if (!md) return "";
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[\-\*] (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/^---$/gm, "<hr>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

// ==================== 启动 ====================

(async function init() {
  // 预加载书籍列表
  try {
    const res = await fetch("/api/books");
    state.books = await res.json();
  } catch (err) {
    // 服务未启动，静默
  }
  switchView("shelf");
})();
