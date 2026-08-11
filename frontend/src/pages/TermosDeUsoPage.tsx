import React from 'react';
import { ArrowLeft, ShieldCheck, FileText, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermosDeUsoPage() {
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
              <Scale className="mr-4 text-brand-orange" size={36} />
              Termos de Uso
            </h1>
            <p className="text-slate-400">Última atualização: 11 de Agosto de 2026</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12 prose prose-slate max-w-none">
          
          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6">1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e utilizar a plataforma <strong>Expertise Licitatória</strong> (doravante "Plataforma", "Nós", "Nosso"), o usuário ("Contratante", "Fornecedor", "Você") concorda irrevogavelmente com os presentes Termos de Uso. Caso não concorde com qualquer disposição aqui presente, o acesso e a utilização dos serviços devem ser imediatamente interrompidos.
          </p>
          <p>
            O aceite destes termos foi registrado através de log eletrônico auditável no momento do seu cadastro, em conformidade com as diretrizes do <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong>.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">2. Descrição dos Serviços e Natureza da Ferramenta</h2>
          <p>
            O Expertise Licitatória é um <em>Software as a Service (SaaS)</em> de Inteligência de Mercado e Automação de Processos focado em Licitações Públicas (B2G). Nossos serviços incluem, mas não se limitam a:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Automação na busca e leitura de editais públicos em portais como PNCP e Compras.gov.br.</li>
            <li>Monitoramento de prazos, impugnações e recursos.</li>
            <li>Uso de Inteligência Artificial (Robô Lex) para auxiliar na elaboração de propostas, impugnações e análises de risco baseadas nas legislações vigentes (como a Nova Lei de Licitações - Lei nº 14.333/2021).</li>
          </ul>
          <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg my-6 flex items-start">
            <ShieldCheck className="shrink-0 mr-3 mt-1 text-orange-600" />
            <div>
              <strong>Atenção:</strong> A Plataforma fornece <strong>subsídios e minutas automatizadas</strong> baseadas em dados públicos. <strong>Não substituímos</strong>, de forma alguma, a análise final, o crivo técnico ou a responsabilidade legal do corpo jurídico da sua empresa na submissão de peças e propostas em processos licitatórios. O envio de propostas para os portais do governo permanece sendo de sua exclusiva responsabilidade.
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">3. Obrigações e Responsabilidades do Usuário</h2>
          <p>
            Ao utilizar a Plataforma, Você se compromete a:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fornecer dados reais, válidos e atualizados durante o cadastro.</li>
            <li>Manter a confidencialidade de suas credenciais de acesso, sendo integralmente responsável por todas as atividades que ocorram sob sua conta.</li>
            <li>Não utilizar meios automatizados de terceiros (como spiders, crawlers, scripts ou robôs não autorizados) para raspar, extrair ou burlar a proteção do nosso banco de dados (CADE, CGU, TCU, etc).</li>
            <li>Não utilizar a plataforma para propósitos ilegais, fraude em licitações, conluio ou qualquer atividade que infrinja as leis anticorrupção vigentes.</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">4. Propriedade Intelectual</h2>
          <p>
            O código-fonte, layout, marcas, algoritmos de inteligência artificial, bancos de dados curados, textos e outros componentes do Expertise Licitatória são de propriedade exclusiva da nossa empresa e protegidos pela <strong>Lei de Direitos Autorais (Lei nº 9.610/98)</strong> e <strong>Lei da Propriedade Industrial (Lei nº 9.279/96)</strong>. O acesso à plataforma consiste apenas em uma licença de uso temporária, revogável, não-exclusiva e intransferível.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">5. Uso de Inteligência Artificial (Robô Lex)</h2>
          <p>
            Nossas ferramentas utilizam modelos de linguagem avançados (IA). Embora empreguemos extensa curadoria sobre Acórdãos (TCU, CGU) e normativas de Licitação, a inteligência artificial pode estar sujeita a alucinações (geração de conteúdo impreciso).
            Todo documento gerado (impugnações, defesas, recursos) deve ser lido, validado e assinado pelo representante legal ou advogado do Contratante antes da submissão a órgãos públicos.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">6. Disponibilidade (SLA) e Manutenção</h2>
          <p>
            Nosso compromisso é manter a Plataforma acessível 99,5% do tempo. Eventuais manutenções preventivas serão comunicadas previamente. A Expertise Licitatória não se responsabiliza por perdas de prazos licitatórios decorrentes de instabilidades sistêmicas externas (como falhas no PNCP ou Comprasnet) ou falhas na sua conexão de internet.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">7. Alteração destes Termos</h2>
          <p>
            Reservamo-nos o direito de modificar estes termos a qualquer momento. Notificaremos os usuários sobre mudanças materiais. O uso contínuo após as alterações constituirá sua aceitação das novas regras.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6 mt-10">8. Foro</h2>
          <p>
            Fica eleito o foro da comarca da sede da contratada para dirimir quaisquer dúvidas oriundas deste documento, com renúncia a qualquer outro, por mais privilegiado que seja.
          </p>

        </div>
      </div>
    </div>
  );
}
