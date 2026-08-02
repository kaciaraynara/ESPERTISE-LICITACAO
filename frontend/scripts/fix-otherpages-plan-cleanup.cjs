const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'pages', 'OtherPages.tsx');

let content = fs.readFileSync(filePath, 'utf8');

function removeFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);

  if (start === -1) {
    return source;
  }

  const firstBrace = source.indexOf('{', start);

  if (firstBrace === -1) {
    return source;
  }

  let depth = 0;

  for (let index = firstBrace; index < source.length; index += 1) {
    const char = source[index];

    if (char === '{') {
      depth += 1;
    }

    if (char === '}') {
      depth -= 1;
    }

    if (depth === 0) {
      let end = index + 1;

      while (end < source.length && /\s/.test(source[end])) {
        end += 1;
      }

      return `${source.slice(0, start).trimEnd()}\n\n${source.slice(end).trimStart()}`;
    }
  }

  return source;
}

for (const functionName of ['roundMoney', 'formatPrice', 'normalizePlanoUsuario']) {
  content = removeFunction(content, functionName);
}

const replacements = {
  'operaÃ§Ã£o': 'operação',
  'investigaÃ§Ã£o': 'investigação',
  'relatÃ³rios': 'relatórios',
  'estratÃ©gicos': 'estratégicos',
  'indisponÃveis': 'indisponíveis',
  'licitaÃ§Ãµes': 'licitações',
  'nÃ£o': 'não',
  'NÃ£o': 'Não',
  'serÃ¡': 'será',
  'possÃvel': 'possível',
  'preÃ§os': 'preços',
  'usuÃ¡rios': 'usuários',
  'anÃ¡lises': 'análises',
  'mÃªs': 'mês',
  'atÃ©': 'até',
  'AtÃ©': 'Até',
  'CatÃ¡logo': 'Catálogo',
  'BÃ¡sico': 'Básico',
  'tÃªm': 'têm',
  'estÃ¡': 'está',
  'vÃ¡lida': 'válida',
  'FaÃ§a': 'Faça',
};

for (const [broken, fixed] of Object.entries(replacements)) {
  content = content.split(broken).join(fixed);
}

fs.writeFileSync(filePath, content, 'utf8');

console.log('OtherPages.tsx limpo com sucesso.');