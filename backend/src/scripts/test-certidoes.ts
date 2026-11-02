import {
  CertidaoArquivoIndisponivelError,
  certidoesService,
} from '../services/certidoes.service';
import { prisma } from '../database/prisma';

async function verificarDownload(certidaoId: string, userId: string) {
  try {
    const arquivo = await certidoesService.obterArquivoCertidao(certidaoId, userId);
    console.log(`   - Arquivo salvo: ${arquivo.fileName}`);
    console.log(`   - Mime: ${arquivo.mimeType}`);
    console.log(`   - Tamanho Buffer: ${arquivo.buffer.length} bytes`);
  } catch (error) {
    if (!(error instanceof CertidaoArquivoIndisponivelError)) {
      throw error;
    }

    console.log(`   - Sem arquivo salvo: ${error.message}`);
  }
}

async function main() {
  console.log('=== TESTE DO MÓDULO DE CERTIDÕES ===\n');

  // 1. Obter usuário de teste
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('Nenhum usuário encontrado no banco.');
    process.exit(1);
  }

  console.log(`[1] Usuário de teste: ${user.email} (ID: ${user.id})`);

  // 2. Listar certidões
  const certidoes = await certidoesService.listarCertidoes(user.id);
  console.log(`[2] Total de certidões retornadas: ${certidoes.length}`);

  for (const c of certidoes) {
    console.log(`   - [${c.id}] ${c.nome.slice(0, 45)}...`);
    console.log(`     Emissão: ${c.urlEmissao ?? 'indisponível para a UF'}`);
    console.log(`     Validação: ${c.urlValidacao ?? 'indisponível para a UF'}`);
    console.log(`     Validade: ${c.validade} (${c.diasParaVencer} dias | ${c.status})`);

    if (c.urlEmissao?.includes('certidao1')) {
      throw new Error(`ERRO: URL quebrada detectada na certidão ${c.id}: ${c.urlEmissao}`);
    }
  }

  console.log('\n[3] Verificando arquivos efetivamente salvos no cofre...');
  await verificarDownload('cndt-tst', user.id);
  await verificarDownload('cnd-federal', user.id);

  console.log('\nVerificação do módulo de certidões concluída.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Falha no teste:', err);
  process.exit(1);
});
