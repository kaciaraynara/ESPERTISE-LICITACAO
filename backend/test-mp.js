const https = require('https');
const token = 'APP_USR-5174607950507176-072513-2d0a938c86875962f3347026008911ad-700162786';
const options = {
  hostname: 'api.mercadopago.com',
  path: '/users/me',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', console.error);
req.end();
