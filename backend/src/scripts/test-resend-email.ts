import dotenv from 'dotenv';
import path from 'path';

// Carrega as variáveis do .env do backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Resend } from 'resend';

async function main() {
    const apiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'Expertise Licitações <contato@expertiselicitatoria.com.br>';

    // Destinatário do teste
    const emailDestino = 'contato.expertiselicitatoria@gmail.com';

    console.log('--- TESTE DE DISPARO RESEND ---');
    console.log(`Remetente (From): ${emailFrom}`);
    console.log(`Destinatário (To): ${emailDestino}`);

    if (!apiKey) {
        console.error('ERRO: RESEND_API_KEY não foi encontrada no arquivo .env!');
        process.exit(1);
    }

    const resend = new Resend(apiKey);

    try {
        const { data, error } = await resend.emails.send({
            from: emailFrom,
            to: [emailDestino],
            subject: 'Teste de Recuperação de Senha - Expertise Licitações',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e3a8a;">Sucesso! Configuração Concluída</h2>
          <p>Olá,</p>
          <p>Se você recebeu esta mensagem, o <strong>Resend</strong> e o <strong>Registro.br</strong> estão devidamente autenticados com SPF, DKIM e DMARC!</p>
          <p>O fluxo de <strong>recuperação de senha</strong> e os <strong>alertas diários de editais por CNAE</strong> estão prontos para envio oficial pela plataforma.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Expertise Licitações - Inteligência em Licitações Públicas</p>
        </div>
      `,
        });

        if (error) {
            console.error('Erro retornado pela API do Resend:', error);
            process.exit(1);
        }

        console.log('E-mail enviado com sucesso!');
        console.log('ID do envio no Resend:', data?.id);
    } catch (err) {
        console.error(' Falha na execução do script:', err);
        process.exit(1);
    }
}

main();
