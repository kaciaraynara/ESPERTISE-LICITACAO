import http from 'k6/http';
import { check, sleep } from 'k6';

// Define configuration for the load test
export let options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 users
    { duration: '1m', target: 200 },  // Spike to 200 users simulating high national traffic
    { duration: '30s', target: 500 }, // Stress with 500 concurrent users
    { duration: '1m', target: 500 },  // Sustain stress level
    { duration: '30s', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
  },
};

const BASE_URL = 'http://localhost:3001/api/v1';

export default function () {
  // Test notices search endpoint (public / cached endpoint)
  let res1 = http.get(`${BASE_URL}/notices/search?q=saude&pagina=1&tamanhoPagina=10`);
  check(res1, {
    'search status is 200': (r) => r.status === 200,
    'search returns data': (r) => r.json('data') !== undefined,
  });

  sleep(1);

  // Test Webhook Endpoint to simulate Mercado Pago async calls
  let payload = JSON.stringify({
    type: 'subscription_preapproval',
    data: { id: 'test_preapproval_id' }
  });
  
  let params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  let res2 = http.post(`${BASE_URL}/pagamentos/webhook`, payload, params);
  check(res2, {
    'webhook status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
