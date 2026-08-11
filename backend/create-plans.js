const https = require('https');
const token = 'APP_USR-5174607950507176-072513-2d0a938c86875962f3347026008911ad-700162786';

const plans = [
  { reason: "Assinatura EXPERTISE Pro", amount: 149.99 },
  { reason: "Assinatura EXPERTISE Master", amount: 249.99 }
];

async function createPlan(plan) {
  const data = JSON.stringify({
    reason: plan.reason,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: plan.amount,
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

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  for (const p of plans) {
    const res = await createPlan(p);
    console.log(p.reason, 'ID:', res.id);
  }
}
run();
