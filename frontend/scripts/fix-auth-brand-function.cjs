const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/AuthPages.tsx',
  'src/pages/LandingPage.tsx',
];

function ensureBrandLogoImport(content) {
  if (content.includes("@components/brand/BrandLogo")) {
    return content;
  }

  const lastImportMatch = [...content.matchAll(/^import .*?;\n/gm)].pop();

  if (!lastImportMatch) {
    return `import BrandLogo from '@components/brand/BrandLogo';\n${content}`;
  }

  const insertAt = lastImportMatch.index + lastImportMatch[0].length;
  return `${content.slice(0, insertAt)}import BrandLogo from '@components/brand/BrandLogo';\n${content.slice(insertAt)}`;
}

function cleanBrandBlock(content, file) {
  const start = content.indexOf('function Brand(');
  const next = content.indexOf('function AuthShell', start);

  if (start === -1 || next === -1) {
    console.log(`${file}: bloco Brand/AuthShell nao encontrado, ignorado.`);
    return content;
  }

  const cleanBrand = `function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className="inline-flex items-center rounded-xl focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-4"
      aria-label={'EXPERTISE, p\\u00e1gina inicial'}
    >
      <BrandLogo
        imageClassName={inverse ? 'h-16 w-auto max-w-[260px]' : 'h-14 w-auto max-w-[240px]'}
        showTagline
      />
    </Link>
  );
}

`;

  return `${content.slice(0, start)}${cleanBrand}${content.slice(next)}`;
}

for (const file of files) {
  const filePath = path.join(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    console.log(`${file}: nao encontrado.`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  content = ensureBrandLogoImport(content);
  content = cleanBrandBlock(content, file);

  fs.writeFileSync(filePath, content, 'utf8');

  console.log(`${file}: Brand corrigido.`);
}