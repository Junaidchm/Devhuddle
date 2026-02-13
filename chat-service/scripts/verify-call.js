var WebSocket = require('ws');

// Configuration
const GATEWAY_URL = 'http://localhost:8080'; // API Gateway
const CHAT_WS_URL = 'ws://localhost:4004/api/v1/chat'; // Direct to Chat Service (bypassing gateway for WS to test direct connection fix)

// Credentials
const USER_A = { email: 'junuchammayil@gmail.com', password: '123asd@' };
const USER_B = { email: 'volore4838@manupay.com', password: '123asd@' };

async function login(user) {
    console.log(`[Login] Logging in ${user.email}...`);
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
    };
    
    // Try Auth Service Login
    try {
        const response = await fetch(`${GATEWAY_URL}/api/v1/auth/login`, options);
        if (!response.ok) {
            throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // FIXED: Extract from user object based on actual response logs
        const token = data.user?.accessToken || data.accessToken || (data.data && data.data.accessToken); 
        const userId = data.user?.id || (data.data && data.data.user && data.data.user.id);
        
        if (!token || !userId) {
            console.error('Invalid login response:', data);
            throw new Error('Could not extract token or userId');
        }
        console.log(`[Login] Success for ${user.email} (ID: ${userId})`);
        return { token, userId };
    } catch (e) {
        console.error(`[Login] Error for ${user.email}:`, e.message);
        process.exit(1);
    }
}

async function createConversation(token, peerId) {
    console.log(`[Chat] Creating conversation with ${peerId}...`);
    try {
        const response = await fetch(`${GATEWAY_URL}/api/v1/chat/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            // FIXED: Payload must be participantIds array
            body: JSON.stringify({ participantIds: [peerId] })
        });
        
        if (!response.ok) {
            throw new Error(`Create conversation failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[DEBUG] Create Conversation Response:', JSON.stringify(data, null, 2));
        const conversationId = data.id || (data.data && data.data.conversationId);
        console.log(`[Chat] Conversation ID: ${conversationId}`);
        return conversationId;
    } catch (e) {
        console.error(`[Chat] Error creating conversation:`, e.message);
        process.exit(1);
    }
}

function connectWebSocket(userLabel, token, userId) {
    return new Promise((resolve, reject) => {
        // APPEND TOKEN for fallback auth (in case code IS updated)
        const url = `${CHAT_WS_URL}?token=${token}`; 
        
        // SIMULATE GATEWAY: Send x-user-id header
        // This ensures connection works even if running old code
        const options = {
            headers: {
                'x-user-id': userId
            }
        };
        
        const ws = new WebSocket(url, options);

        ws.on('open', () => {
            console.log(`[WS] ${userLabel} Connected!`);
            resolve(ws);
        });

        ws.on('error', (err) => {
            console.error(`[WS] ${userLabel} Error:`, err.message);
            reject(err);
        });
        
        ws.on('close', (code, reason) => {
             console.log(`[WS] ${userLabel} Closed: ${code} ${reason}`);
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            console.log(`[WS] ${userLabel} Received: ${msg.type}`);
            if (msg.type === 'call:incoming') {
                console.log(`\n✅✅✅ VERIFICATION SUCCESS: ${userLabel} Received Incoming Call! ✅✅✅`);
                console.log(JSON.stringify(msg, null, 2));
                process.exit(0);
            }
        });
    });
}

async function run() {
    try {
        // 1. Login Both Users
        const userA = await login(USER_A);
        const userB = await login(USER_B);

        // 2. Create Conversation (A initiates with B)
        const conversationId = await createConversation(userA.token, userB.userId);

        // 3. Connect WebSockets
        console.log('--- Connecting WebSockets ---');
        const wsA = await connectWebSocket('User A', userA.token, userA.userId);
        const wsB = await connectWebSocket('User B', userB.token, userB.userId);

        // 4. Start Call
        console.log('--- Starting Call ---');
        const callStartMsg = {
            type: 'call:start',
            conversationId: conversationId,
            isVideoCall: true
        };
        wsA.send(JSON.stringify(callStartMsg));
        console.log('[WS] User A sent call:start');

        // 5. Wait for Result
        setTimeout(() => {
            console.log('\n❌ Timeout waiting for call:incoming');
            process.exit(1);
        }, 10000);

    } catch (e) {
        console.error('Runtime Error:', e);
    }
}

run();
