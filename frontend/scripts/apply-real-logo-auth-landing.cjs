const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/LandingPage.tsx',
  'src/pages/AuthPages.tsx',
];

function ensureBrandLogoImport(content) {
  if (content.includes("@components/brand/BrandLogo")) {
    return content;
  }

  const importLines = content.match(/^import[\s\S]*?;\n\n/);

  if (!importLines) {
    return `import BrandLogo from '@components/brand/BrandLogo';\n${content}`;
  }

  return content.replace(
    importLines[0],
    `${importLines[0]}import BrandLogo from '@components/brand/BrandLogo';\n`,
  );
}

function replaceBrandFunction(content, file) {
  const functionStart = content.search(/function\s+Brand\s*\(/);

  if (functionStart === -1) {
    console.log(`${file}: funcao Brand nao encontrada, ignorado.`);
    return content;
  }

  const firstBrace = content.indexOf('{', functionStart);

  if (firstBrace === -1) {
    throw new Error(`${file}: nao encontrei abertura da funcao Brand.`);
  }

  let depth = 0;
  let end = -1;

  for (let index = firstBrace; index < content.length; index += 1) {
    const char = content[index];

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      end = index + 1;
      break;
    }
  }

  if (end === -1) {
    throw new Error(`${file}: nao encontrei fechamento da funcao Brand.`);
  }

  const newFunction = `function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className="inline-flex items-center rounded-xl focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-4"
      aria-label="EXPERTISE, página inicial"
    >
      <BrandLogo
        imageClassName={inverse ? 'h-16 w-auto max-w-[260px]' : 'h-14 w-auto max-w-[240px]'}
        showTagline
      />
    </Link>
  );
}`;

  return `${content.slice(0, functionStart)}${newFunction}${content.slice(end)}`;
}

for (const file of files) {
  const filePath = path.join(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    console.log(`${file}: nao encontrado.`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  content = ensureBrandLogoImport(content);
  content = replaceBrandFunction(content, file);

  fs.writeFileSync(filePath, content, 'utf8');

  console.log(`${file}: logo real aplicada no Brand.`);
}