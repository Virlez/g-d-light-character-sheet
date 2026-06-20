const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
};

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.createReadStream(filePath)
        .on('open', () => {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store'
            });
        })
        .on('error', () => {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Internal server error');
        })
        .pipe(res);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const requestedPath = decodeURIComponent(url.pathname);
    const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
    const filePath = path.resolve(rootDir, relativePath);

    if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (error, stats) => {
        if (!error && stats.isFile()) {
            sendFile(res, filePath);
            return;
        }

        sendFile(res, path.join(rootDir, 'index.html'));
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Static server listening on port ${port}`);
});
