const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'pages', 'OtherPages.tsx');

let content = fs.readFileSync(filePath, 'utf8');

const fixes = {
  'BÃ¡sico': 'B\u00e1sico',
  'bÃ¡sico': 'b\u00e1sico',
  'comeÃ§ar': 'come\u00e7ar',
  'organizaÃ§Ã£o': 'organiza\u00e7\u00e3o',
  'anÃ¡lises': 'an\u00e1lises',
  'AtÃ©': 'At\u00e9',
  'atÃ©': 'at\u00e9',
  'usuÃ¡rios': 'usu\u00e1rios',
  'mÃªs': 'm\u00eas',
  'preÃ§o': 'pre\u00e7o',
  'estratÃ©gia': 'estrat\u00e9gia',
  'estratÃ©gico': 'estrat\u00e9gico',
  'estratÃ©gicos': 'estrat\u00e9gicos',
  'precificaÃ§Ã£o': 'precifica\u00e7\u00e3o',
  'relatÃ³rios': 'relat\u00f3rios',
  'operaÃ§Ã£o': 'opera\u00e7\u00e3o',
  'investigaÃ§Ã£o': 'investiga\u00e7\u00e3o',
  'avanÃ§ado': 'avan\u00e7ado',
  'avanÃ§ados': 'avan\u00e7ados',
  'CatÃ¡logo': 'Cat\u00e1logo',
  'nÃ£o': 'n\u00e3o',
  'NÃ£o': 'N\u00e3o',
  'vÃ¡lida': 'v\u00e1lida',
  'FaÃ§a': 'Fa\u00e7a',
  'estÃ¡': 'est\u00e1',
  'indisponÃveis': 'indispon\u00edveis',
  'possÃvel': 'poss\u00edvel',
  'preÃ§os': 'pre\u00e7os',
  'serÃ¡': 'ser\u00e1',
  'licitaÃ§Ãµes': 'licita\u00e7\u00f5es',
  'sÃ£o': 's\u00e3o',
  'tÃªm': 't\u00eam',
  'seguranÃ§a': 'seguran\u00e7a',
  'CobranÃ§a': 'Cobran\u00e7a',
  'Ã©': '\u00e9',
  'jÃ¡': 'j\u00e1',
  'vendÃ¡vel': 'vend\u00e1vel',
  'frequÃªncia': 'frequ\u00eancia',
  'mÃºltiplas': 'm\u00faltiplas'
};

for (const [broken, fixed] of Object.entries(fixes)) {
  content = content.split(broken).join(fixed);
}

fs.writeFileSync(filePath, content, 'utf8');

console.log('Acentos corrigidos com segurança em OtherPages.tsx.');