export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const ip = request.headers.get('cf-connecting-ip') || 'Unknown';

    // --- 1. HANDLE /write/ COMMANDS ---
    if (path.startsWith('/write/')) {
      const message = decodeURIComponent(path.substring(7));
      
      await env.DB.prepare(
        "INSERT INTO tasks (timestamp, ip, task_type, payload, status) VALUES (?, ?, ?, ?, ?)"
      ).bind(new Date().toISOString(), ip, 'write', message, 'completed').run();

      return await renderDashboard(env, `✅ Wrote: "${message}"`);
    }

    // --- 2. HANDLE /delete/ COMMANDS ---
    if (path.startsWith('/delete/')) {
      const target = decodeURIComponent(path.substring(8));
      let deleteMsg = "";

      if (target === 'all') {
        await env.DB.prepare("DELETE FROM tasks").run();
        deleteMsg = "🗑️ All tasks have been wiped from the database!";
      } else {
        // Delete by ID or by exact payload match
        const result = await env.DB.prepare("DELETE FROM tasks WHERE id = ? OR payload = ?").bind(target, target).run();
        deleteMsg = `🗑️ Deleted task matching: "${target}"`;
      }

      return await renderDashboard(env, deleteMsg);
    }

    // --- 3. DEFAULT ROOT PAGE ---
    if (path === '/') {
      return await renderDashboard(env, "👋 Welcome to the AI Command Dashboard. Use /write/ or /delete/ commands.");
    }

    return new Response('404 - Path not found. Try /, /write/message, or /delete/all', { status: 404 });
  }
};

// --- HELPER FUNCTION TO RENDER THE DASHBOARD ---
async function renderDashboard(env, statusMessage) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM tasks ORDER BY timestamp DESC LIMIT 10"
  ).all();

  const rows = results.map(task => 
    `<tr>
      <td>${task.id}</td>
      <td>${task.timestamp}</td>
      <td><strong>${task.task_type}</strong></td>
      <td style="color: blue; font-family: monospace;">${task.payload}</td>
    </tr>`
  ).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Command Dashboard</title>
      <style>
        body { font-family: sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f4f4f4; }
        .status { color: green; font-weight: bold; font-size: 1.2em; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h1>🤖 AI Command Dashboard</h1>
      <p class="status">${statusMessage}</p>
      
      <h3>Recent Tasks in Database:</h3>
      <table>
        <tr><th>ID</th><th>Time</th><th>Type</th><th>Payload (Message)</th></tr>
        ${rows || '<tr><td colspan="4">Database is empty.</td></tr>'}
      </table>
    </body>
    </html>
  `;

  return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
}
