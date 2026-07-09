/**
 * DeepSeek API 封装 + 所有 AI Prompt 模板
 * 书虫的核心大脑
 */

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
const API_URL = "https://api.deepseek.com/v1/chat/completions";

/**
 * 基础调用函数
 */
async function chat(systemPrompt, userMessage, options = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`DeepSeek API: ${data.error.message}`);
  return data.choices[0].message.content;
}

// ==================== Prompt 模板 ====================

/**
 * 模块一：笔记深度分析
 * 输入用户的一段读书笔记，输出多维度分析
 */
async function analyzeNote(bookTitle, noteContent, readingHistory = []) {
  const historyText = readingHistory.length > 0
    ? `\n该读者之前读过以下书籍（含笔记摘要）：\n${readingHistory.map(h => `-《${h.title}》：${h.summary}`).join("\n")}`
    : "";

  const system = `你是「书虫」的 AI 阅读导师。你的任务是帮助大学生把书读深。

你的分析风格：
- 不做简单的摘要复述（那是机器干的事）
- 你要做的是认知升级：帮读者发现自己没注意到的角度、关联和问题
- 语气温暖但不油腻，像一位博学的学长/学姐
- 敢于提出不同观点，但不说教

输出格式（严格按此结构，用 Markdown）：

## 💡 你关注的核心
（用1-2句话提炼这位读者在这段笔记中最关心的主题）

## 🔗 思想关联
（如果有阅读历史，找出这段笔记跟之前读过的书之间的观点联系。如果没有历史，就关联这本书内部不同章节可能存在的联系，或者关联到更广泛的思想流派/历史背景。至少2条。）

## 🧭 你没注意到的角度
（提出1-2个读者可能忽略的视角：可以是作者的潜在意图、历史背景、反面论点、跨学科视角等）

## ❓ 值得追问的问题
（列出3个能引导深度思考的问题。不要那种"你怎么看"的敷衍问题，要具体、有指向性。）

## 📚 延伸阅读
（推荐1-2本与这段笔记相关的书，简单说明为什么推荐）`;

  const user = `书名：《${bookTitle}》\n\n读书笔记：\n${noteContent}${historyText}\n\n请分析。`;

  const result = await chat(system, user);
  return result;
}

/**
 * 模块二：生成知识星图
 * 输入一本书的所有笔记，输出该书的知识节点和关系
 */
async function generateKnowledgeGraph(bookTitle, allNotes) {
  const system = `你是知识图谱专家。根据读者的笔记，提取这本书的核心概念和它们之间的关系。

请输出一个 JSON 对象（不要其他内容，只输出 JSON）：

{
  "nodes": [
    { "id": "概念ID", "label": "概念名称", "weight": 关联笔记数量, "category": "主题/人物/事件/理论" }
  ],
  "edges": [
    { "source": "起点概念ID", "target": "终点概念ID", "label": "关系描述" }
  ],
  "centralConcept": "最核心的概念ID"
}

要求：
- 节点数量 6-12 个
- 边的数量 8-18 条
- 概念命名要具体，不要用"主题1""概念2"这种敷衍名字
- 关系描述用简短中文`;

  const user = `书名：《${bookTitle}》\n\n读书笔记汇总：\n${allNotes}\n\n请生成知识星图 JSON。`;

  const result = await chat(system, user);
  // 尝试提取 JSON（有时候模型会多输出点别的东西）
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error("知识星图解析失败");
}

/**
 * 模块三：生成阅读画像
 * 输入读者所有笔记，输出阅读风格分析
 */
async function generateProfile(allBooks) {
  const booksText = allBooks.map(b =>
    `《${b.title}》| 笔记数量：${b.notes.length}篇 | 笔记内容摘要：${b.notes.slice(0, 3).map(n => n.content.slice(0, 200)).join("...")}`
  ).join("\n---\n");

  const system = `你是阅读心理分析师。根据一个人的读书笔记，分析他/她的阅读风格和思想倾向。

输出格式（Markdown）：

## 🧠 阅读画像

### 偏爱的主题
（列举3-5个经常关注的主题领域）

### 阅读风格
（用一段话描述：是喜欢追问本质的哲学型？还是关注社会现实的关怀型？还是擅长联想比较的跨界型？）

### 典型思维特征
- 特征1：xxx
- 特征2：xxx
- 特征3：xxx

### 一句话标签
「xxx」（用一句有画面感的话概括这个人的阅读气质，比如"在字里行间寻找存在主义的答案"）`;

  const user = `以下是一位读者的读书笔记记录：\n${booksText}\n\n请生成阅读画像。`;

  const result = await chat(system, user);
  return result;
}

/**
 * 模块四：计算阅读品味匹配度
 * 用 AI 做语义层面的匹配，比余弦相似度更准
 */
async function matchReaders(myProfile, candidates) {
  const system = `你是阅读社区匹配算法。你要判断两个读者的阅读品味有多"神似"。

不要只看他们读了什么相同的书，要关注：
- 他们关注的问题意识是否相似
- 思考方式是否接近（比如都喜欢追问"为什么"，都喜欢跨学科联想）
- 阅读深度是否匹配

对于每位候选人，给出：
1. 匹配度分数（0-100）
2. 一句话匹配理由（要有说服力，不要说空话）
3. 一个共同话题建议（具体到可以开启一场讨论的程度）

输出严格 JSON：
[{"name":"姓名","score":85,"reason":"理由","topic":"建议话题"}]`;

  const user = `我的阅读画像：\n${myProfile}\n\n候选人列表：\n${JSON.stringify(candidates, null, 2)}`;

  const result = await chat(system, user);
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error("匹配结果解析失败");
}

/**
 * 模块五：读书报告生成（人文学科刚需）
 * 输入一本书的所有笔记 + 分析 → 输出结构化的读书报告
 */
async function generateReport(bookTitle, notes) {
  const notesWithAnalysis = notes.map((n, i) => `
[笔记${i + 1}${n.chapter ? "：" + n.chapter : ""}]
原文笔记：${n.content.slice(0, 500)}
AI分析摘要：${(n.analysis || "").slice(0, 300)}
`).join("\n---\n");

  const system = `你是人文社科专业的学术写作导师。你的任务是帮学生把零散的读书笔记整合成一篇规范的读书报告。

要求：
1. 学术性：有核心论点，有文本证据支撑，有批判性思考
2. 可读性：不是堆砌笔记，而是有逻辑主线的叙述
3. 适合作业提交：格式规范，语言学术但不晦涩

输出格式（严格按此结构）：

# 《书名》读书报告

## 一、核心论点
（用一段话概括你对这本书的整体判断。这个判断必须是你自己思考的结果，不能是"这是一本伟大的作品"这种空话。要有态度、有角度。）

## 二、文本分析
（选择2-3个关键场景/章节/概念进行深入分析。每个分析要：引用原文细节→阐释你的理解→关联到核心论点。）

## 三、思想关联
（把这本书放到更大的知识图景中。它回应了什么思想传统？反驳了什么流行观点？与你读过的其他书有什么对话关系？）

## 四、批判性反思
（这本书的局限是什么？作者在哪些地方回避了问题？如果换一个视角会看到什么不同的东西？——不要为了批判而批判，要指出具体的盲点。）

## 五、延伸思考
（这本书对你理解当下的世界有什么启发？它打开了什么新的问题？你接下来想沿着哪个方向继续阅读？）

写作风格：既不是冷冰冰的论文腔，也不是随意的读后感。应该像一位认真对待阅读的人写出的有质量的文字。`;

  const user = `请根据以下读书笔记，撰写《${bookTitle}》的读书报告。\n\n${notesWithAnalysis}`;

  const result = await chat(system, user, { maxTokens: 6000 });
  return result;
}

/**
 * 模块六：课堂讨论问题生成
 * 人文学科课堂讨论是常态，帮学生准备讨论发言
 */
async function generateDiscussionPoints(bookTitle, notes) {
  const system = `你是大学人文课程的讨论课主持人。你要根据学生的阅读笔记，设计3个能引发高质量课堂讨论的问题。

每个问题需要：
- 有争议空间（不是一个显而易见的答案）
- 需要用到文本细节（不能脱离原著空谈）
- 能够联系到更大的社会/历史/哲学议题

输出格式：

## 🔥 讨论问题

### 问题1：[问题标题]
**核心张力**：（这个问题为什么不好回答？两边各有什么道理？）
**文本依据**：（原著中哪些段落跟这个问题有关？）
**延伸方向**：（可以从这个问题走向哪些更大的讨论？）

（问题2、3 同上格式）`;

  const notesText = notes.map(n => n.content.slice(0, 300)).join("\n---\n");
  const user = `书名：《${bookTitle}》\n\n读书笔记：\n${notesText}`;

  const result = await chat(system, user);
  return result;
}

/**
 * 模块七：AI 苏格拉底模式（温和版）
 * 学生写感悟 → AI 追问 3 轮 → 给出引导性总结
 * 核心：不替代思考，而是激发更深层的思考
 */
async function socraticDialogue(bookTitle, userThought, round = 1, previousExchanges = []) {
  const historyText = previousExchanges.map((ex, i) =>
    `[第${i + 1}轮]\n学生：${ex.user}\n追问：${ex.question}`
  ).join("\n\n");

  const system = `你是苏格拉底式的哲学对话者。学生正在读《${bookTitle}》，写下了自己的思考。你的任务是帮 TA 把思考推得更深。

你的对话原则：
1. 不夸奖、不总结、不直接给答案
2. 每次只问一个问题，但要精准击中对方论述中的薄弱环节
3. 追问可以指向：论据不充分的地方、隐含的前提假设、逻辑跳跃、可替代的解释、反例
4. 语气是好奇的、平等的，像一个也在思考的同伴，不是一个考试官
5. 问题要具体引用学生说的话，不要泛泛而问

当前是第 ${round} 轮（共 3 轮）。

${round < 3 ? `
**第 ${round} 轮的策略**：
- 第1轮：挑战前提 — "你说的这个观点，隐含了一个什么假设？这个假设成立吗？"
- 第2轮：寻找反例 — "有没有什么情况，会让你的这个判断失效？"
- 第3轮：视角转换 — "如果换一个理论框架来看同一段文本，会得出完全不同的结论吗？"

现在，请基于学生的原始感悟和之前的对话历史，提出你的第 ${round} 轮追问。只问一个问题，不要多。
` : `
**第 3 轮（最后一轮）**：
先提出最后一个追问。然后，在追问下方用一个简短段落（不超过 150 字），给一个温和的引导——不是"正确答案"，而是一个值得探索的方向。用这样的开头："如果你还想继续深入，可以想想……"
`}

你的回复格式：
第 ${round} 轮追问：
[你的问题]

${round === 3 ? '\n引导：\n[你的引导]' : ''}`;

  const user = `我在读《${bookTitle}》，我的思考是：\n\n${userThought}\n\n${historyText ? "之前的对话：\n" + historyText : ""}`;

  const result = await chat(system, user, { temperature: 0.8 });
  return result;
}

/**
 * 模块八：笔记自动标签 + 跨书关联
 * 输入新笔记 → AI 提取关键词 → 跨所有书籍寻找相关笔记
 */
async function tagAndLinkNotes(newNoteContent, bookTitle, allNotesAcrossBooks) {
  const otherNotesText = allNotesAcrossBooks
    .filter(b => b.notes.length > 0)
    .map(b => b.notes.map(n => `[《${b.title}》] ${n.content.slice(0, 200)}`).join("\n---\n"))
    .join("\n=== 其他书 ===\n");

  const system = `你是学术知识管理专家。你的任务有两个：

1. 为一篇读书笔记提取 3-5 个精准的学术关键词/标签（不要泛泛的"文学""哲学"，要具体如"存在主义荒诞""循环时间叙事""阶级流动性"）
2. 从其他书籍的笔记中，找出与新笔记在**观点层面**有实质性关联的笔记（不是关键词相同，而是思想上有对话关系）

输出 JSON：
{
  "tags": ["标签1", "标签2", "标签3"],
  "links": [
    {"source": "《书名》", "noteSummary": "笔记摘要（20字以内）", "relation": "关联说明：互补/冲突/延续/质疑"}
  ]
}

最多返回 3 个关联。如果没有有意义的关联，links 为空数组。`;

  const user = `新笔记（来自《${bookTitle}》）：\n${newNoteContent}\n\n其他书籍的所有笔记：\n${otherNotesText || "（无）"}`;

  const result = await chat(system, user);
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return { tags: [], links: [] };
}

/**
 * 模块九：跨书概念追踪
 * 输入一个概念 → 在所有书籍笔记中追踪这个概念的演变
 */
async function trackConcept(concept, allBooks) {
  const booksData = allBooks
    .filter(b => b.notes.length > 0)
    .map(b => ({
      title: b.title,
      author: b.author,
      snippets: b.notes.map(n => n.content.slice(0, 300)).join(" | ")
    }));

  const system = `你是跨文本分析专家。你要追踪一个概念在不同著作中的脉络。

输入一个概念和所有读书笔记，你需要：
1. 判断这个概念在每本书中是否被讨论（即使没有直接出现这个词）
2. 分析每本书对这个概念的处理方式和独特贡献
3. 绘制概念在不同著作之间的演变路径

输出格式（Markdown）：

## 🔍 概念追踪：「${concept}」

### 概念地图
（用文字描述这个概念在不同著作之间的流动：谁继承谁？谁反驳谁？谁转换了这个问题的框架？）

### 各书分析
（为每本相关的书写一个简短分析：该书中这个概念的核心洞见是什么？与其他书的关键差异在哪？）

### 思考方向
（这个概念还有哪些讨论盲区？推荐沿着哪个方向继续深挖？）`;

  const user = `概念：「${concept}」\n\n所有读书笔记：\n${JSON.stringify(booksData, null, 2)}`;

  const result = await chat(system, user);
  return result;
}

/**
 * 模块十：跨文本对比报告
 * 选择两本书，AI 基于笔记生成对比分析
 */
async function compareBooks(bookA, bookB) {
  const system = `你是比较文学与跨学科研究的专家。你要比较两本书在主题、方法、观点上的异同。

要求：
1. 不泛泛而谈，必须引用具体的文本细节
2. 不只是找"相同"和"不同"，还要分析背后的原因：为什么不同？是方法论的差异还是世界观的冲突？
3. 指出两本书之间可能的"对话"——即使它们来自不同时代、不同学科

输出格式（Markdown）：

# 「${bookA.title}」vs「${bookB.title}」对比分析

## 一、核心议题对照
（两本书各自在回应什么问题？它们的核心关切相同还是相斥？）

## 二、方法论与方法
（两本书处理问题的方式有何不同？一个在分析结构，一个在描述体验？）

## 三、关键分歧
（两本书在什么地方给出了互相矛盾的答案？这不是简单的"对错"，而是不同视角下的不同真相。）

## 四、意想不到的共鸣
（尽管表面不同，两本书在哪个深层问题上达成了默契？）

## 五、综合思考
（如果把这两本书放在一起读，会产生什么单独读其中任何一本都无法获得的洞见？）`;

  const notesA = bookA.notes.map(n => `[《${bookA.title}》] ${n.content.slice(0, 400)}`).join("\n---\n");
  const notesB = bookB.notes.map(n => `[《${bookB.title}》] ${n.content.slice(0, 400)}`).join("\n---\n");

  const user = `请比较以下两本书的读书笔记：\n\n=== ${bookA.title} ===\n${notesA}\n\n=== ${bookB.title} ===\n${notesB}`;

  const result = await chat(system, user, { maxTokens: 6000 });
  return result;
}

/**
 * 模块十一：理解力检测
 * 根据读书笔记生成理解测试题，检测读者是否真正读懂了
 */
async function generateQuiz(bookTitle, notes) {
  const notesText = notes.map((n, i) => `[笔记${i + 1}]\n${n.content.slice(0, 500)}`).join("\n\n");

  const system = `你是大学人文课程的命题专家。根据学生的读书笔记，设计一套理解力检测题。

要求：
1. 题目不能是简单的"记不记得"（那是记忆测试），要检测"有没有读懂"
2. 题目应该覆盖：文本理解、逻辑推理、批判性评估 三个层次
3. 每题给出标准答案和简短解析

输出严格 JSON：
{
  "questions": [
    {
      "type": "choice",
      "question": "题目（选择题）",
      "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
      "answer": "A",
      "explanation": "解析：为什么A是正确的，其他选项为什么不对"
    },
    {
      "type": "short",
      "question": "题目（简答题）",
      "referenceAnswer": "参考答案要点",
      "scoringGuide": "得分要点说明"
    }
  ]
}

共出5道题：3道选择题 + 2道简答题。`;

  const user = `书名：《${bookTitle}》\n\n读书笔记：\n${notesText}`;

  const result = await chat(system, user);
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error("题目解析失败");
}

/**
 * 模块十二：关键词词云数据
 * 输入一本或所有书的笔记 → 返回词云所需的词频数据
 */
async function generateWordCloud(notesText) {
  const system = `你是文本分析专家。从以下读书笔记中提取 15-25 个关键词，计算每个词的权重（根据该概念在笔记中的重要性和出现频率，权重 1-10）。

输出严格 JSON：
[{"text":"关键词","weight":8},{"text":"另一个词","weight":6},...]

规则：
- 不要提取"的""了""是""和"等虚词
- 关键词应该是学术概念、人物名、理论术语、核心意象
- 按权重降序排列`;

  const user = `请提取关键词：\n${notesText.slice(0, 3000)}`;

  const result = await chat(system, user);
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return [];
}

module.exports = {
  chat,
  analyzeNote,
  generateKnowledgeGraph,
  generateProfile,
  matchReaders,
  generateReport,
  generateDiscussionPoints,
  socraticDialogue,
  tagAndLinkNotes,
  trackConcept,
  compareBooks,
  generateQuiz,
  generateWordCloud,
};
