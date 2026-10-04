export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || 'Unknown';
    // Cloudflare provides the real IP in this header!
    const ip = request.headers.get('cf-connecting-ip') || 'Unknown'; 
    
    let visitType = 'Direct Browser';
    if (/curl|wget|python-requests|httpx|git|scrapy|httrack|node-fetch/i.test(ua)) {
      visitType = 'Terminal/Script';
    } else if (!request.headers.get('accept')?.includes('text/html')) {
      visitType = 'Likely API/Script';
    }

    // Save to D1 database asynchronously (ctx.waitUntil ensures it finishes even after response is sent)
    ctx.waitUntil(
      env.DB.prepare(
        "INSERT INTO visits (timestamp, ip, visit_type, user_agent, path) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        new Date().toISOString(),
        ip,
        visitType,
        ua,
        url.pathname
      ).run().catch(err => console.error("D1 Error:", err))
    );

    // Return the HTML page
    const html = \`
      <!DOCTYPE html>
      <html>
      <head><title>Visit Detector</title></head>
      <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1>👋 Welcome to the Cloudflare Visit Detector!</h1>
        <p>Your visit has been securely logged to Cloudflare D1.</p>
        <p><strong>Your IP:</strong> \${ip}</p>
        <p><strong>Detected As:</strong> \${visitType}</p>
      </body>
      </html>
    \`;

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  }
};
