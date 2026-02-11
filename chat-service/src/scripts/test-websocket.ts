
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

const PORT = 4004;
const SECRET = 'adL83nDhF9sd8JmKe92jQl39vWp0ZxvT'; // From .env
const USER_ID = 'test-user-A';

const token = jwt.sign({ userId: USER_ID }, SECRET);

const url = `ws://localhost:${PORT}/api/v1/chat?token=${token}`;

console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('✅ Connected!');
    
    // Keep alive for a bit to see heartbeat
    setTimeout(() => {
        console.log('Closing...');
        ws.close();
        process.exit(0);
    }, 5000);
});

ws.on('message', (data) => {
    console.log('📩 Received:', data.toString());
});

ws.on('error', (err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log(`Disconnected: ${code} ${reason}`);
});
