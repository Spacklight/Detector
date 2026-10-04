export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const ip = request.headers.get('cf-connecting-ip') || 'Unknown';

    // --- 1. HANDLE /write/ COMMANDS ---
    if (path.startsWith('/write/')) {
      const message = decodeURIComponent(path.substring(7));
      
      // Save to D1
      await env.DB.prepare(
        "INSERT INTO tasks (timestamp, ip, task_type, payload, status) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        new Date().toISOString(),
        ip,
        'write',
        message,
        'completed'
      ).run();

      // Fetch recent tasks to display on the page
      const { results } = await env.DB.prepare(
        "SELECT * FROM tasks ORDER BY timestamp DESC LIMIT 10"
      ).all();

      // Build HTML table rows
      const rows = results.map(task => 
        `<tr>
          <td>${task.timestamp}</td>
          <td><strong>${task.task_type}</strong></td>
          <td style="color: blue; font-family: monospace;">${task.payload}</td>
          <td>${task.status}</td>
        </tr>`
      ).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>AI Command Dashboard</title>
          <style>
            body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f4f4f4; }
            .success { color: green; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>🤖 AI Command Dashboard</h1>
          <p class="success">✅ Command received and stored successfully!</p>
          <p><strong>Last Message Processed:</strong> ${message}</p>
          
          <h3>Recent Tasks in Database:</h3>
          <table>
            <tr><th>Time</th><th>Type</th><th>Payload (Message)</th><th>Status</th></tr>
            ${rows || '<tr><td colspan="4">No tasks yet.</td></tr>'}
          </table>
        </body>
        </html>
      `;

      return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
    }

    // --- 2. DEFAULT ROOT PAGE (Shows recent activity) ---
    if (path === '/') {
      const { results } = await env.DB.prepare(
        "SELECT * FROM tasks ORDER BY timestamp DESC LIMIT 10"
      ).all();

      const rows = results.map(task => 
        `<tr>
          <td>${task.timestamp}</td>
          <td><strong>${task.task_type}</strong></td>
          <td style="color: blue; font-family: monospace;">${task.payload}</td>
          <td>${task.status}</td>
        </tr>`
      ).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>AI Command Dashboard</title>
          <style>
            body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f4f4f4; }
          </style>
        </head>
        <body>
          <h1>👋 Welcome to the AI Command Dashboard</h1>
          <p>Send a command by visiting: <code>/write/your_message_here</code></p>
          
          <h3>Recent Tasks in Database:</h3>
          <table>
            <tr><th>Time</th><th>Type</th><th>Payload (Message)</th><th>Status</th></tr>
            ${rows || '<tr><td colspan="4">No tasks yet. Try visiting /write/hello</td></tr>'}
          </table>
        </body>
        </html>
      `;

      return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
    }

    // --- 3. FALLBACK FOR UNKNOWN PATHS ---
    return new Response('404 - Path not found. Try / or /write/message', { status: 404 });
  }
};
