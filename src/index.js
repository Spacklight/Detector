import initSqlJs from 'https://esm.sh/sql.js@1.10.3';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(htmlUI, { 
        headers: { 'content-type': 'text/html;charset=UTF-8' } 
      });
    }

    if (request.method === 'POST' && url.pathname === '/run') {
      try {
        const { sql } = await request.json();
        if (!sql || !sql.trim()) {
          return new Response(JSON.stringify({ error: "No SQL provided" }), { status: 400 });
        }

        const repoId = "Spacklight/ai-command-storage";
        const fileName = "database.db";
        const fileUrl = "https://huggingface.co/datasets/" + repoId + "/resolve/main/" + fileName;
        const uploadUrl = "https://huggingface.co/api/datasets/" + repoId + "/upload/main/" + fileName;

        let dbBytes = null;
        try {
          const downloadRes = await fetch(fileUrl, {
            headers: { "Authorization": "Bearer " + env.HF_TOKEN }
          });
          if (downloadRes.ok) {
            dbBytes = new Uint8Array(await downloadRes.arrayBuffer());
          }
        } catch (e) { /* File doesn't exist yet, start fresh */ }

        const SQL = await initSqlJs({
          locateFile: function(file) { return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + file; }
        });
        
        const db = new SQL.Database(dbBytes);

        let results = [];
        let error = null;
        try {
          const stmt = db.prepare(sql);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
        } catch (e) {
          error = e.message;
        }

        if (!error) {
          const newBytes = db.export();
          const formData = new FormData();
          formData.append("file", new Blob([newBytes]), fileName);

          await fetch(uploadUrl, {
            method: "POST",
            headers: { "Authorization": "Bearer " + env.HF_TOKEN },
            body: formData
          });
        }

        db.close();

        return new Response(JSON.stringify({ 
          success: !error,
          results: results,
          error: error 
        }), { 
          headers: { 'content-type': 'application/json' } 
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    return new Response("404 - Not Found", { status: 404 });
  }
};

const htmlUI = `<!DOCTYPE html>
<html>
<head>
    <title>HF-Backed SQLite Runner</title>
    <style>
        body { font-family: sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; background: #f4f6f8; }
        h1 { color: #ff9d00; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        textarea { width: 100%; height: 120px; font-family: monospace; font-size: 15px; padding: 15px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; }
        button { padding: 12px 24px; font-size: 16px; font-weight: bold; background: #ff9d00; color: white; border: none; cursor: pointer; border-radius: 5px; margin-top: 10px; }
        button:hover { background: #e68a00; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
        th, td { border: 1px solid #e1e4e8; padding: 10px; text-align: left; }
        th { background: #f6f8fa; font-weight: 600; }
        .error { color: #d73a49; background: #ffeef0; padding: 15px; border-radius: 5px; margin-top: 15px; font-family: monospace; }
        .success { color: #28a745; background: #e6ffed; padding: 15px; border-radius: 5px; margin-top: 15px; }
        .warning { color: #856404; background: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 15px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤗 Hugging Face + SQLite Runner</h1>
        <div class="warning">⚠️ <strong>Proof of Concept:</strong> This downloads the DB from HF, runs the query, and uploads it back.</div>
        <textarea id="sqlInput" placeholder="CREATE TABLE test (id INTEGER, name TEXT);"></textarea>
        <br>
        <button id="runBtn" onclick="runQuery()">▶ Run Query</button>
        <div id="resultArea"></div>
    </div>
    <script>
        async function runQuery() {
            var sql = document.getElementById('sqlInput').value;
            var resultArea = document.getElementById('resultArea');
            var btn = document.getElementById('runBtn');
            
            btn.disabled = true;
            btn.innerText = "Downloading DB, Running Query, Uploading...";
            resultArea.innerHTML = "";

            try {
                var response = await fetch('/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql: sql })
                });
                var data = await response.json();

                if (data.error) {
                    resultArea.innerHTML = '<div class="error">❌ SQL Error: ' + data.error + '</div>';
                } else {
                    var html = '<div class="success">✅ Query executed and saved to Hugging Face!</div>';
                    if (data.results && data.results.length > 0) {
                        var headers = Object.keys(data.results[0]);
                        var table = '<table><tr>' + headers.map(function(h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
                        data.results.forEach(function(row) {
                            table += '<tr>' + headers.map(function(h) { return '<td>' + (row[h] !== null ? row[h] : 'NULL') + '</td>'; }).join('') + '</tr>';
                        });
                        table += '</table>';
                        html += table;
                    }
                    resultArea.innerHTML = html;
                }
            } catch (err) {
                resultArea.innerHTML = '<div class="error">❌ Network Error: ' + err.message + '</div>';
            } finally {
                btn.disabled = false;
                btn.innerText = "▶ Run Query";
            }
        }
    </script>
</body>
</html>`;
