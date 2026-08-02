const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'pages', 'OtherPages.tsx');

function decodeLatin1Bytes(sequence) {
  const bytes = Array.from(sequence).map((char) => char.charCodeAt(0));
  const decoded = Buffer.from(bytes).toString('utf8');

  if (decoded.includes('\ufffd')) {
    return sequence;
  }

  return decoded;
}

function markerCount(value) {
  let total = 0;

  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code === 0x00c2 || code === 0x00c3 || code === 0x00e2) {
      total += 1;
    }
  }

  return total;
}

function repair(content) {
  let current = content;

  for (let pass = 0; pass < 10; pass += 1) {
    const before = current;

    current = current.replace(/[\u00e2][\u0080-\u00bf][\u0080-\u00bf]/g, decodeLatin1Bytes);
    current = current.replace(/[\u00c2-\u00df][\u0080-\u00bf]/g, decodeLatin1Bytes);

    if (current === before) {
      break;
    }
  }

  return current;
}

const original = fs.readFileSync(filePath, 'utf8');
const beforeMarkers = markerCount(original);

const repaired = repair(original);
const afterMarkers = markerCount(repaired);

fs.writeFileSync(filePath, repaired, 'utf8');

console.log(`Marcadores antes: ${beforeMarkers}`);
console.log(`Marcadores depois: ${afterMarkers}`);
console.log('Reparo automatico concluido.');