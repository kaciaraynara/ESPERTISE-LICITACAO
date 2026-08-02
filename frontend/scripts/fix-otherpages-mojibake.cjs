const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'pages', 'OtherPages.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Corrige pares típicos de UTF-8 interpretado como Latin-1.
// Exemplo: "licitaÃ§Ãµes" -> "licitações".
content = content.replace(/[\u00C2-\u00DF][\u0080-\u00BF]/g, (match) => {
  return Buffer.from([match.charCodeAt(0), match.charCodeAt(1)]).toString('utf8');
});

const manualFixes = {
  '\u00E2\u20AC\u201C': '–',
  '\u00E2\u20AC\u201D': '—',
  '\u00E2\u20AC\u2122': '’',
  '\u00E2\u20AC\u0153': '“',
  '\u00E2\u20AC\u009D': '”',
};

for (const [broken, fixed] of Object.entries(manualFixes)) {
  content = content.split(broken).join(fixed);
}

fs.writeFileSync(filePath, content, 'utf8');

console.log('Mojibake corrigido em OtherPages.tsx.');