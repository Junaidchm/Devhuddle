const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign({ id: '80922465-c281-4331-b931-7932da62c316', email: 'junaid__cham@test.com' }, 'your-secure-secret-key-32-chars-long', { expiresIn: '1h' });

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/v1/chat/conversations',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token,
    'x-user-data': JSON.stringify({ id: '80922465-c281-4331-b931-7932da62c316' })
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const list = JSON.parse(data);
    if (list.data && list.data.length > 0) {
      const convId = list.data[0].conversationId || list.data[0].id;
      console.log('Got Conversation ID:', convId);
      
      const req2 = http.request({
        ...options, 
        path: '/api/v1/chat/conversations/' + convId
      }, (res2) => {
        let d2 = '';
        res2.on('data', c => d2 += c);
        res2.on('end', () => console.log('Response:', d2));
      });
      req2.end();
    } else {
        console.log('No conversations found', data);
    }
  });
});
req.end();
