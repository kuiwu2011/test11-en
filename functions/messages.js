// functions/messages.js
// 绑定: env.DB (D1 数据库)

async function ensureTable(db) {
  // 自动建表（如果不存在）
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  ).run();
}

export async function onRequestGet({ env }) {
  try {
    await ensureTable(env.DB);
    // 读取最新的50条留言
    const { results } = await env.DB.prepare(
      "SELECT id, name, content, created_at FROM messages ORDER BY id DESC LIMIT 50"
    ).all();
    
    // 简单验证登录状态
    const cookie = context.request.headers.get('Cookie') || '';
    const isLoggedIn = cookie.includes(env.SESSION_SECRET);

    return new Response(JSON.stringify({ loggedIn: isLoggedIn, messages: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    // 验证登录
    const cookie = request.headers.get('Cookie') || '';
    if (!cookie.includes(env.SESSION_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    await ensureTable(env.DB);
    const { name, content } = await request.json();
    if (!name || !content) {
      return new Response('Missing fields', { status: 400 });
    }
    
    // 插入留言
    await env.DB.prepare(
      "INSERT INTO messages (name, content) VALUES (?, ?)"
    ).bind(name, content).run();
    
    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}
