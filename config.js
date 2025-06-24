// Configuration endpoint to serve Firebase config
const http = require('http');
const url = require('url');

// Get Firebase config from environment
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID
};

// Simple config server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/config') {
        res.writeHead(200, {
            'Content-Type': 'application/javascript',
            'Access-Control-Allow-Origin': '*'
        });
        
        res.end(`
            window.FIREBASE_API_KEY = '${firebaseConfig.apiKey}';
            window.FIREBASE_PROJECT_ID = '${firebaseConfig.projectId}';
            window.FIREBASE_APP_ID = '${firebaseConfig.appId}';
            console.log('Firebase configuration loaded');
        `);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(3001, () => {
    console.log('Config server running on port 3001');
});