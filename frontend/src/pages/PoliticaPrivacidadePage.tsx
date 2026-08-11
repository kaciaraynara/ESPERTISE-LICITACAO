import React from 'react';
import { ArrowLeft, ShieldCheck, Lock, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PoliticaPrivacidadePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <div className="bg-[#0B1736] text-white py-12 px-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center text-blue-400 hover:text-blue-300 transition-colors mb-4 font-medium text-sm"
            >
              <ArrowLeft size={16} className="mr-2" /> Voltar
            </button>
            <h1 className="text-4xl font-bold mb-2 flex items-center">
              <Lock className="mr-4 text-emerald-400" size={36} />
              Política de Privacidade
            </h1>
            <p className="text-slate-400">Em conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018)</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12 prose prose-slate max-w-none">
          
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg my-6 flex items-start">
            <ShieldCheck className="shrink-0 mr-3 mt-1 text-emerald-600" />
            <div>
              <strong>Seus dados estão seguros.</strong> A nossa maior prioridade é proteger o sigilo das suas informações de mercado e de seus dados pessoais. O Expertise Licitatória não vende, não aluga e não compartilha seus dados pessoais para terceiros para fins de marketing.
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">1. O Papel da Expertise Licitatória (SaaS B2G)</h2>
          <p>
            O Expertise atua no processamento de editais licitatórios, gestão de contratos (CRM), e na geração de minutas utilizando inteligência artificial. Conforme a <strong>LGPD (Lei nº 13.709/2018)</strong>, atuamos predominantemente como <strong>Operadores</strong> dos dados inseridos ativamente por Você na plataforma para a finalidade de gestão de suas licitações, e como <strong>Controladores</strong> apenas no que se refere aos seus dados básicos de cadastro (Nome, E-mail, Telefone) necessários para a manutenção de sua conta e faturamento.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">2. Quais Dados Coletamos?</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Dados de Cadastro:</strong> Nome completo, e-mail, telefone, CPF/CNPJ e senha (hasheada e criptografada, irreversível).</li>
            <li><strong>Dados de Navegação e Auditoria:</strong> Endereço de IP, <em>User-Agent</em> (navegador/dispositivo) e logs de ações (login, aceite de termos) para fins estritos de segurança cibernética e auditoria de conformidade.</li>
            <li><strong>Dados de Integração:</strong> Certificados digitais ou tokens de APIs inseridos por você para o módulo Cofre ficam estritamente armazenados através de criptografia simétrica de ponta-a-ponta (KMS).</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">3. Uso da Inteligência Artificial e Sigilo</h2>
          <p>
            A Expertise Licitatória utiliza IA proprietária e parceira para ler Acórdãos, Manuais do TCU/CGU, e para revisar seus atestados. É importante destacar:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Os dados inseridos no painel do <strong>Robô Lex</strong> para compor sua proposta NÃO são utilizados para treinar modelos abertos ao público.</li>
            <li>Os servidores (workers) que processam as predições de faturamento e de risco são isolados logicamente por <em>Tenant</em> (sua empresa isolada das outras).</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">4. Retenção, Anonimização e Exclusão</h2>
          <p>
            Retemos os seus dados pessoais apenas pelo tempo necessário para cumprir com as finalidades descritas nesta política. Como titular de dados, você possui o direito de:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Portabilidade e Acesso:</strong> Baixar todos os seus dados estruturados.</li>
            <li><strong>Direito ao Esquecimento (Exclusão):</strong> Deletar sua conta diretamente no painel de <em>Configurações &gt; Privacidade (LGPD)</em>.</li>
          </ul>
          <p>
            Ao solicitar a exclusão de conta, a Expertise revogará seu acesso imediatamente. Por razões de prevenção a fraudes, segurança e exigências fiscais/judiciais, os dados entram num período de quarentena sob bloqueio lógico (Soft Delete). Em seguida, um serviço automatizado procede com a <strong>Anonimização Irreversível</strong> das informações sensíveis.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">5. Medidas de Segurança Adotadas</h2>
          <p>
            Empregamos padrões rigorosos, incluindo conexões seguras (HTTPS/TLS), criptografia de banco de dados (TDE), <em>firewalls</em> de aplicação web (WAF) contra ataques DDoS, auditoria de código contínua e políticas rígidas de controle de acesso Baseado em Cargos (RBAC).
          </p>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">6. Contato com o DPO</h2>
          <p>
            Para qualquer dúvida, reclamação ou solicitação relacionada aos seus dados e a LGPD, nosso Encarregado pelo Tratamento de Dados Pessoais (DPO) pode ser contatado pelo e-mail: <strong>lgpd@expertiselicitatoria.com.br</strong>
          </p>

        </div>
      </div>
    </div>
  );
}
