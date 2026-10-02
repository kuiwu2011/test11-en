// 初始化数据库表
const initDB = async (db) => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT, 
        content TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
};

export async function onRequest(context) {
    const db = context.env.DB;
    await initDB(db);
    
    // 验证登录状态 (简单版)
    const cookie = context.request.headers.get('Cookie') || '';
    const isLoggedIn = cookie.includes(context.env.SESSION_SECRET);

    if (context.request.method === 'GET') {
        // 获取留言
        const { results } = await db.prepare('SELECT name, content FROM messages ORDER BY id DESC').all();
        return new Response(JSON.stringify({ loggedIn: isLoggedIn, messages: results }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (context.request.method === 'POST') {
        // 提交留言 (需登录)
        if (!isLoggedIn) return new Response('Unauthorized', { status: 401 });
        
        const { name, content } = await context.request.json();
        if (!name || !content) return new Response('Missing fields', { status: 400 });
        
        await db.prepare('INSERT INTO messages (name, content) VALUES (?1, ?2)')
                 .bind(name, content).run();
                 
        return new Response(JSON.stringify({ success: true }), { status: 201 });
    }
}
