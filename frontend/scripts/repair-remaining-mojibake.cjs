const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/LicitacoesPage.tsx',
  'src/services/api.ts',
];

const cp1252Specials = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function markerCount(value) {
  return (value.match(/Ã|Â|Ãƒ|Ã‚|â€|�/g) || []).length;
}

function encodeCp1252(value) {
  const bytes = [];

  for (const char of value) {
    const code = char.codePointAt(0);

    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    if (cp1252Specials.has(code)) {
      bytes.push(cp1252Specials.get(code));
      continue;
    }

    return null;
  }

  return Buffer.from(bytes);
}

function decodeLine(line) {
  let current = line;

  for (let pass = 0; pass < 8; pass += 1) {
    const beforeMarkers = markerCount(current);

    if (beforeMarkers === 0) {
      break;
    }

    const bytes = encodeCp1252(current);

    if (!bytes) {
      break;
    }

    const decoded = bytes.toString('utf8');

    if (decoded.includes('\ufffd')) {
      break;
    }

    const afterMarkers = markerCount(decoded);

    if (afterMarkers > beforeMarkers) {
      break;
    }

    if (decoded === current) {
      break;
    }

    current = decoded;
  }

  return current;
}

for (const file of files) {
  const filePath = path.join(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    console.log(`Ignorado: ${file}`);
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const before = markerCount(original);

  const repaired = original
    .split(/\r?\n/)
    .map((line) => (markerCount(line) > 0 ? decodeLine(line) : line))
    .join('\n');

  const after = markerCount(repaired);

  fs.writeFileSync(filePath, repaired, 'utf8');

  console.log(`${file}: antes=${before}, depois=${after}`);
}