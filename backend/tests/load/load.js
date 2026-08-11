const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const payload = JSON.stringify({
  email: 'stress-test@example.com',
  senha: 'WrongPassword123!',
});

async function runRequest() {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', (e) => {
      resolve(500);
    });
    req.write(payload);
    req.end();
  });
}

async function stress() {
  console.log('Starting stress test on auth/login...');
  const start = Date.now();
  const promises = [];
  
  for(let i=0; i<100; i++) {
    promises.push(runRequest());
  }
  
  const results = await Promise.all(promises);
  const end = Date.now();
  console.log('Completed 100 requests in ' + (end - start) + 'ms');
  console.log('Status Codes: ', results.reduce((acc, code) => {
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {}));
}

stress();
