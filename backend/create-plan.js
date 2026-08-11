const https = require('https');
const token = 'APP_USR-5174607950507176-072513-2d0a938c86875962f3347026008911ad-700162786';

const data = JSON.stringify({
  reason: "Assinatura EXPERTISE Basico",
  auto_recurring: {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: 69.99,
    currency_id: "BRL"
  },
  back_url: "https://expertiselicitatoria.com.br"
});

const options = {
  hostname: 'api.mercadopago.com',
  path: '/preapproval_plan',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Create Plan Status:', res.statusCode, 'Body:', body));
});
req.on('error', console.error);
req.write(data);
req.end();
