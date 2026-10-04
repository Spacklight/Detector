const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;
const LOG_FILE = path.join(__dirname, 'visits.log');

// CRITICAL: Trust the tunnel proxy to get the REAL visitor IP
app.set('trust proxy', true);

// --- THE DETECTION SYSTEM ---
app.use((req, res, next) => {
    const ua = req.headers['user-agent'] || 'Unknown';
    const accept = req.headers['accept'] || '';
    const ip = req.ip; // Now this will show the REAL public IP!
    let visitType = 'Direct Browser';

    if (/curl|wget|python-requests|httpx|git|scrapy|httrack|node-fetch/i.test(ua)) {
        visitType = 'Terminal/Script';
    } else if (!accept.includes('text/html') && !accept.includes('image/')) {
        visitType = 'Likely API/Script';
    }

    const timestamp = new Date().toLocaleString();
    const logEntry = `[${timestamp}] | IP: ${ip} | Type: ${visitType} | UA: ${ua} | Path: ${req.path}\n`;

    console.log('\n🔔 [VISIT DETECTED & SAVED]');
    console.log('Real IP: ' + ip);
    console.log('Type: ' + visitType);
    console.log('User-Agent: ' + ua);
    console.log('-------------------------\n');

    fs.appendFileSync(LOG_FILE, logEntry);

    req.visitType = visitType;
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server is running on http://0.0.0.0:' + PORT);
    console.log('📝 Visits are being saved to: ' + LOG_FILE);
});
