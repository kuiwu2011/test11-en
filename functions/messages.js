// functions/messages.js
async function hashPassword(password, salt) {
  const utf8 = new TextEncoder().encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest({name: 'SHA-256'}, utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  const SALT = env.SESSION_SECRET || "default_salt";

  // 注册接口
  if (path === '/messages/register') {
    try {
      const { username, password } = await request.json();
      if (!username || !password) return new Response('Missing fields', { status: 400 });
      
      const password_hash = await hashPassword(password, SALT);
      await env.DB.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
        .bind(username, password_hash).run();
      
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (err) {
      return new Response("Register Error: " + err.message, { status: 500 });
    }
  }

  // 登录接口
  if (path === '/messages/login') {
    try {
      const { username, password } = await request.json();
      const password_hash = await hashPassword(password, SALT);
      
      const { results } = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND password_hash = ?")
        .bind(username, password_hash).all();
      
      if (results.length > 0) {
        // 登录成功，设置 Cookie
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Set-Cookie': `session=${env.SESSION_SECRET}; Path=/; HttpOnly` }
        });
      } else {
        return new Response('Invalid credentials', { status: 401 });
      }
    } catch (err) {
      return new Response("Login Error: " + err.message, { status: 500 });
    }
  }

  // 提交留言接口
  if (path === '/messages') {
    try {
      const cookie = request.headers.get('Cookie') || '';
      if (!cookie.includes(env.SESSION_SECRET)) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const { name, content } = await request.json();
      if (!name || !content) return new Response('Missing fields', { status: 400 });
      
      await env.DB.prepare("INSERT INTO messages (name, content) VALUES (?, ?)")
        .bind(name, content).run();
      
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  }
  
  return new Response('Not Found', { status: 404 });
}

// 获取留言和登录状态
export async function onRequestGet(context) {
  try {
    const cookie = context.request.headers.get('Cookie') || '';
    const isLoggedIn = cookie.includes(context.env.SESSION_SECRET);
    
    const { results } = await context.env.DB.prepare(
      "SELECT name, content FROM messages ORDER BY id DESC LIMIT 50"
    ).all();
    
    return new Response(JSON.stringify({ loggedIn: isLoggedIn, messages: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}
