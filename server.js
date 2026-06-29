const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const allowedRootFiles = new Set([
    'favicon.svg',
    'index.html',
    'script.js',
    'styles.css'
]);
const allowedDirectories = new Set(['js']);

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

const securityHeaders = {
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
        "font-src https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'"
    ].join('; '),
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
};

function writeHead(res, statusCode, headers = {}) {
    res.writeHead(statusCode, {
        ...securityHeaders,
        ...headers
    });
}

function sendText(res, statusCode, message) {
    writeHead(res, statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(message);
}

function isAllowedPublicPath(relativePath) {
    if (!relativePath || relativePath.includes('\0')) return false;
    const normalized = relativePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.some((part) => part.startsWith('.'))) return false;

    if (parts.length === 1) {
        return allowedRootFiles.has(parts[0]);
    }

    return (
        parts.length === 2 &&
        allowedDirectories.has(parts[0]) &&
        path.extname(parts[1]).toLowerCase() === '.js'
    );
}

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.createReadStream(filePath)
        .on('open', () => {
            writeHead(res, 200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store'
            });
        })
        .on('error', () => {
            sendText(res, 500, 'Internal server error');
        })
        .pipe(res);
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendText(res, 405, 'Method not allowed');
        return;
    }

    let url;
    let requestedPath;
    try {
        url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        requestedPath = decodeURIComponent(url.pathname);
    } catch (error) {
        sendText(res, 400, 'Bad request');
        return;
    }

    const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
    const filePath = path.resolve(rootDir, relativePath);

    if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
        sendText(res, 403, 'Forbidden');
        return;
    }

    if (!isAllowedPublicPath(relativePath)) {
        const hasExtension = path.extname(relativePath) !== '';
        const hasDirectory = relativePath.replace(/\\/g, '/').includes('/');
        if (hasExtension || hasDirectory) {
            sendText(res, 404, 'Not found');
            return;
        }

        sendFile(res, path.join(rootDir, 'index.html'));
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
