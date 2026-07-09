/**
 * JSON 文件数据库
 * MVP 阶段不用装数据库，直接读写 JSON 文件
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function writeJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
}

// ==================== 书籍操作 ====================

function getAllBooks() {
  const books = readJSON("books.json");
  return books.sort((a, b) => b.updatedAt - a.updatedAt); // 最近更新的排前面
}

function getBook(id) {
  const books = readJSON("books.json");
  return books.find(b => b.id === id) || null;
}

function addBook(book) {
  const books = readJSON("books.json");
  const newBook = {
    id: book.id,
    title: book.title,
    author: book.author || "未知作者",
    cover: book.cover || "",        // 封面图 URL（可选）
    notes: [],                       // 读书笔记列表
    starCount: 0,                    // 星图节点数
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  books.push(newBook);
  writeJSON("books.json", books);
  return newBook;
}

function deleteBook(id) {
  const books = readJSON("books.json");
  const filtered = books.filter(b => b.id !== id);
  writeJSON("books.json", filtered);
}

// ==================== 笔记操作 ====================

function addNote(bookId, note) {
  const books = readJSON("books.json");
  const book = books.find(b => b.id === bookId);
  if (!book) throw new Error("书籍不存在");

  const newNote = {
    id: note.id,
    chapter: note.chapter || "",
    content: note.content,
    analysis: note.analysis || "",  // AI 分析结果（Markdown）
    createdAt: Date.now(),
  };
  book.notes.push(newNote);
  book.updatedAt = Date.now();
  writeJSON("books.json", books);
  return newNote;
}

function deleteNote(bookId, noteId) {
  const books = readJSON("books.json");
  const book = books.find(b => b.id === bookId);
  if (!book) throw new Error("书籍不存在");
  book.notes = book.notes.filter(n => n.id !== noteId);
  book.updatedAt = Date.now();
  writeJSON("books.json", books);
}

// ==================== 预置数据（演示用） ====================

function seedDemoData() {
  const books = readJSON("books.json");
  if (books.length > 0) return; // 已有数据就跳过

  const { v4: uuid } = require("uuid");

  const demoBooks = [
    {
      id: uuid(),
      title: "百年孤独",
      author: "加西亚·马尔克斯",
      cover: "",
      notes: [
        {
          id: uuid(),
          chapter: "第一章",
          content: "马孔多是一个由何塞·阿尔卡蒂奥·布恩迪亚创建的村庄，这里的一切都那么新，许多东西甚至连名字都还没有。吉普赛人梅尔基亚德斯带来了磁铁、望远镜、放大镜等新奇玩意儿，何塞被这些发明深深吸引。他试图用磁铁寻找黄金，用放大镜制造武器，但都以失败告终。最终他意识到地球是圆的，像一个橙子。",
          analysis: "",
          createdAt: Date.now() - 86400000 * 14,
        },
        {
          id: uuid(),
          chapter: "第二章",
          content: "布恩迪亚家族的历史就像一条被诅咒的河流。失眠症席卷马孔多，人们开始失去记忆。他们不得不在每样东西上写下名字：这是门，这是窗，这是奶牛，每天早上要挤奶。但奥雷里亚诺意识到，即使这样也不够——他们可能会忘记文字本身的意义。",
          analysis: "",
          createdAt: Date.now() - 86400000 * 10,
        },
      ],
      starCount: 0,
      createdAt: Date.now() - 86400000 * 14,
      updatedAt: Date.now() - 86400000 * 10,
    },
    {
      id: uuid(),
      title: "局外人",
      author: "阿尔贝·加缪",
      cover: "",
      notes: [
        {
          id: uuid(),
          chapter: "第一部",
          content: "今天，妈妈死了。也许是昨天，我不知道。默尔索的冷静令人不安——他没有在母亲的葬礼上哭泣，第二天就和女友去看喜剧电影、游泳、做爱。他不是没有感情，他只是觉得一切都无所谓。这种'无所谓'是存在主义的核心吗？还是他只是在诚实地面对生活的荒诞？",
          analysis: "",
          createdAt: Date.now() - 86400000 * 7,
        },
      ],
      starCount: 0,
      createdAt: Date.now() - 86400000 * 7,
      updatedAt: Date.now() - 86400000 * 7,
    },
    {
      id: uuid(),
      title: "活着",
      author: "余华",
      cover: "",
      notes: [
        {
          id: uuid(),
          chapter: "全书",
          content: "福贵的一生是中国近代史的一个缩影。从地主少爷到一贫如洗，从战场上的逃兵到失去所有亲人的老人。余华用极简的文字写出了极重的苦难。但书名却是'活着'——不是'生存'，不是'挣扎'，而是'活着'。福贵最后和一头老牛相依为命，他给牛起了和自己一样的名字。这让我想到一个问题：当一个人失去了一切，他为什么还要活着？",
          analysis: "",
          createdAt: Date.now() - 86400000 * 3,
        },
      ],
      starCount: 0,
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 86400000 * 3,
    },
  ];

  writeJSON("books.json", demoBooks);
  console.log("📚 已添加 3 本演示书籍");
}

// 应用启动时自动添加 Demo 数据
seedDemoData();

module.exports = {
  getAllBooks,
  getBook,
  addBook,
  deleteBook,
  addNote,
  deleteNote,
  seedDemoData,
};
