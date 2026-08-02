const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(process.cwd(), 'src', 'components', 'layout', 'Sidebar.tsx');

let content = fs.readFileSync(sidebarPath, 'utf8');

if (!content.includes("@components/brand/BrandLogo")) {
  const importAnchor = "import type { SystemModule } from '@services/api';";

  if (content.includes(importAnchor)) {
    content = content.replace(
      importAnchor,
      `${importAnchor}\nimport BrandLogo from '@components/brand/BrandLogo';`,
    );
  } else {
    content = `import BrandLogo from '@components/brand/BrandLogo';\n${content}`;
  }
}

const headerRegex =
  /<div className="flex h-20 items-center border-b border-slate-200 px-6">[\s\S]*?<\/div>\s*\n\s*<nav/;

const newHeader = `<div className="flex h-24 items-center border-b border-slate-200 px-5">
        <Link
          to="/fornecedor/dashboard"
          className="inline-flex w-full items-center rounded-xl focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-4"
          aria-label="EXPERTISE, painel operacional"
        >
          <BrandLogo imageClassName="h-16 w-auto max-w-[220px]" showTagline />
        </Link>
      </div>

      <nav`;

if (!headerRegex.test(content)) {
  console.error('Nao encontrei o bloco antigo do topo da Sidebar.');
  process.exit(1);
}

content = content.replace(headerRegex, newHeader);

fs.writeFileSync(sidebarPath, content, 'utf8');

console.log('Sidebar atualizada para usar /logo.png.');