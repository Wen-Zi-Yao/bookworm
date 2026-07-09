// Railway 通过 Dashboard 设置环境变量，本地开发用 .env
try { require("dotenv").config(); } catch (e) {}

const express = require("express");
const cors = require("cors");

// 延迟加载，避免启动时崩溃
let store, ai, uuid;
try {
  store = require("./store");
  ai = require("./ai");
  uuid = require("uuid").v4;
} catch (err) {
  console.error("模块加载失败:", err.message);
  console.error(err.stack);
}

const app = express();

// 健康检查
app.get("/health", (req, res) => res.json({ ok: true }));

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// 如果模块加载失败，返回降级信息
if (!store || !ai) {
  app.get("/api/books", (req, res) => {
    res.json([{ id: "demo", title: "模块加载失败", author: "请查看日志", notes: [] }]);
  });
} else {

// ==================== 书籍接口 ====================

// 获取所有书籍
app.get("/api/books", (req, res) => {
  try {
    const books = store.getAllBooks();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单本书
app.get("/api/books/:id", (req, res) => {
  try {
    const book = store.getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "书籍不存在" });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加书籍
app.post("/api/books", (req, res) => {
  try {
    const { title, author } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "书名不能为空" });
    }
    const book = store.addBook({ id: uuid(), title: title.trim(), author });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除书籍
app.delete("/api/books/:id", (req, res) => {
  try {
    store.deleteBook(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 笔记接口 ====================

// 添加笔记 + AI 分析
app.post("/api/books/:id/notes", async (req, res) => {
  try {
    const { chapter, content } = req.body;
    if (!content || content.trim().length < 20) {
      return res.status(400).json({ error: "笔记内容至少20个字" });
    }

    const book = store.getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "书籍不存在" });

    // 收集该读者其他书籍的笔记摘要（用于关联分析）
    const allBooks = store.getAllBooks();
    const otherBooks = allBooks
      .filter(b => b.id !== book.id && b.notes.length > 0)
      .map(b => ({
        title: b.title,
        summary: b.notes.slice(0, 2).map(n => n.content.slice(0, 150)).join(" | "),
      }));

    // 调用 AI 分析
    const analysis = await ai.analyzeNote(book.title, content, otherBooks);

    // 保存笔记和分析结果
    const note = store.addNote(req.params.id, {
      id: uuid(),
      chapter: chapter || "",
      content: content.trim(),
      analysis,
    });

    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除笔记
app.delete("/api/books/:id/notes/:noteId", (req, res) => {
  try {
    store.deleteNote(req.params.id, req.params.noteId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AI 功能接口 ====================

// 生成知识星图
app.post("/api/books/:id/graph", async (req, res) => {
  try {
    const book = store.getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "书籍不存在" });
    if (book.notes.length === 0) {
      return res.status(400).json({ error: "请先添加至少一篇笔记" });
    }

    const allNotes = book.notes.map(n => `[${n.chapter || "笔记"}]\n${n.content}`).join("\n\n---\n\n");
    const graph = await ai.generateKnowledgeGraph(book.title, allNotes);
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 生成阅读画像
app.post("/api/profile", async (req, res) => {
  try {
    const books = store.getAllBooks().filter(b => b.notes.length > 0);
    if (books.length === 0) {
      return res.status(400).json({ error: "还没有任何读书笔记" });
    }

    const profile = await ai.generateProfile(books);
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 寻找书友
app.post("/api/match", async (req, res) => {
  try {
    const books = store.getAllBooks().filter(b => b.notes.length > 0);
    if (books.length === 0) {
      return res.status(400).json({ error: "还没有任何读书笔记" });
    }

    // 先生成我的画像
    const myProfile = await ai.generateProfile(books);

    // 预设一些候选人（MVP 阶段用虚拟数据）
    const candidates = [
      {
        name: "林知远",
        books: [
          { title: "局外人", notes: "存在主义的核心不是虚无，而是对荒诞的清醒认知。默尔索的冷漠不是无情，而是拒绝表演。" },
          { title: "西西弗神话", notes: "诸神认为没有比徒劳无功更可怕的惩罚了，但西西弗是幸福的——他的幸福在于他意识到了自己的命运。" },
        ],
      },
      {
        name: "陈思然",
        books: [
          { title: "百年孤独", notes: "魔幻现实主义的本质是用神话的视角看历史。香蕉公司事件不是魔幻，是哥伦比亚真实的惨案。" },
          { title: "霍乱时期的爱情", notes: "马尔克斯说这是一本关于爱情的书。但我看到的是时间的暴力——它比爱情更强大，比死亡更耐心。" },
        ],
      },
      {
        name: "王语晴",
        books: [
          { title: "活着", notes: "福贵不是英雄，他没有反抗，他只是承受。但这种承受本身就已经是中国农民最伟大的品质。" },
          { title: "许三观卖血记", notes: "卖血是中国底层人最后的资本。余华用'卖血'这个意象把贫穷写到了极致。" },
        ],
      },
    ];

    const matches = await ai.matchReaders(myProfile, candidates);

    res.json({ myProfile, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 读书报告 ====================

app.post("/api/books/:id/report", async (req, res) => {
  try {
    const book = store.getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "书籍不存在" });
    if (book.notes.length === 0) {
      return res.status(400).json({ error: "请先添加至少一篇笔记" });
    }

    const report = await ai.generateReport(book.title, book.notes);
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 课堂讨论 ====================

app.post("/api/books/:id/discussion", async (req, res) => {
  try {
    const book = store.getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "书籍不存在" });
    if (book.notes.length === 0) {
      return res.status(400).json({ error: "请先添加至少一篇笔记" });
    }

    const points = await ai.generateDiscussionPoints(book.title, book.notes);
    res.json({ points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 苏格拉底模式 ====================

app.post("/api/socratic", async (req, res) => {
  try {
    const { bookTitle, thought, round, history } = req.body;
    if (!thought || thought.trim().length < 10) {
      return res.status(400).json({ error: "请写下你的思考（至少10个字）" });
    }

    const result = await ai.socraticDialogue(
      bookTitle || "未知书籍",
      thought,
      round || 1,
      history || []
    );
    res.json({ reply: result, round: round || 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 笔记标签 + 关联 ====================

app.post("/api/notes/tag-link", async (req, res) => {
  try {
    const { content, bookTitle } = req.body;
    if (!content) return res.status(400).json({ error: "笔记内容不能为空" });

    const allBooks = store.getAllBooks();
    const result = await ai.tagAndLinkNotes(content, bookTitle, allBooks);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 跨书概念追踪 ====================

app.post("/api/concept-track", async (req, res) => {
  try {
    const { concept } = req.body;
    if (!concept || concept.trim().length < 2) {
      return res.status(400).json({ error: "请输入要追踪的概念（至少2个字）" });
    }

    const allBooks = store.getAllBooks().filter(b => b.notes.length > 0);
    if (allBooks.length === 0) {
      return res.status(400).json({ error: "还没有任何读书笔记" });
    }

    const result = await ai.trackConcept(concept.trim(), allBooks);
    res.json({ track: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 跨文本对比 ====================

app.post("/api/compare", async (req, res) => {
  try {
    const { bookIdA, bookIdB } = req.body;
    if (!bookIdA || !bookIdB) return res.status(400).json({ error: "请选择两本书" });
    if (bookIdA === bookIdB) return res.status(400).json({ error: "请选择两本不同的书" });

    const bookA = store.getBook(bookIdA);
    const bookB = store.getBook(bookIdB);
    if (!bookA || !bookB) return res.status(404).json({ error: "书籍不存在" });
    if (bookA.notes.length === 0 || bookB.notes.length === 0) {
      return res.status(400).json({ error: "两本书都需要至少一篇笔记" });
    }

    const report = await ai.compareBooks(bookA, bookB);
    res.json({ report, bookA: bookA.title, bookB: bookB.title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 理解力检测 ====================

app.post("/api/books/:id/quiz", async (req, res) => {
  try {
    const book = store.getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "书籍不存在" });
    if (book.notes.length === 0) return res.status(400).json({ error: "请先添加至少一篇笔记" });

    const quiz = await ai.generateQuiz(book.title, book.notes);
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 词云 ====================

app.post("/api/wordcloud", async (req, res) => {
  try {
    const { bookId } = req.body;

    let notesText;
    if (bookId) {
      const book = store.getBook(bookId);
      if (!book) return res.status(404).json({ error: "书籍不存在" });
      notesText = book.notes.map(n => n.content).join("\n");
    } else {
      const books = store.getAllBooks();
      notesText = books.flatMap(b => b.notes.map(n => n.content)).join("\n");
    }

    if (!notesText.trim()) return res.status(400).json({ error: "还没有读书笔记" });

    const words = await ai.generateWordCloud(notesText);
    res.json({ words });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

} // end of if (store && ai)

// ==================== 启动 ====================
process.on("uncaughtException", (err) => console.error("CRASH:", err));
process.on("unhandledRejection", (err) => console.error("REJECT:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`书虫启动成功 port=${PORT}`);
});
