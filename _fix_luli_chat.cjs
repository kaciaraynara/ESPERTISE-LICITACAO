const fs = require('fs');

// 1. Permitir stream?: boolean no lexApi.chat do api.ts
const apiPath = 'frontend/src/services/api.ts';
if (fs.existsSync(apiPath)) {
  let api = fs.readFileSync(apiPath, 'utf8');
  api = api.replace(
    "chat: (body: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; contextoEdital?: string }) =>",
    "chat: (body: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; contextoEdital?: string; stream?: boolean }) =>"
  );
  fs.writeFileSync(apiPath, api, 'utf8');
}

// 2. Atualizar LexFloatingWidget.tsx: stream: false + ler campos de groundedResponse + Luli em branco
const lexPath = 'frontend/src/components/LexFloatingWidget.tsx';
if (fs.existsSync(lexPath)) {
  let lex = fs.readFileSync(lexPath, 'utf8');

  // Titulo Luli em branco nitido
  lex = lex.replace(
    '<h3 className="text-sm font-extrabold leading-tight">Luli</h3>',
    '<h3 className="text-sm font-extrabold leading-tight" style={{ color: "#FFFFFF" }}>Luli</h3>'
  );

  // Passar stream: false
  lex = lex.replace(
    'contextoEdital,\n      });',
    'contextoEdital,\n        stream: false,\n      });'
  );

  // Ler todos os campos possiveis do groundedResponse (answer, text, resposta, etc.)
  lex = lex.replace(
    `const respostaTexto =
        payload.reply ||
        payload.response ||
        payload.resposta ||
        payload.message ||
        payload.content ||
        payload.text ||
        (typeof payload === 'string' ? payload : '');`,
    `const respostaTexto =
        payload.answer ||
        payload.resposta ||
        payload.reply ||
        payload.response ||
        payload.text ||
        payload.content ||
        payload.message ||
        resp?.data?.answer ||
        resp?.data?.text ||
        (typeof payload === 'string' ? payload : '');`
  );

  fs.writeFileSync(lexPath, lex, 'utf8');
  console.log('Luli conectada com stream:false e titulo branco!');
}
