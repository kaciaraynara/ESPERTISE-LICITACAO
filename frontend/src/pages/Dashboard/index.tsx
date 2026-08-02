import { motion } from 'framer-motion';

export default function DashboardPage() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-blue mb-2">Visão Geral</h1>
        <p className="text-slate-500">Acompanhe seus resultados e novas oportunidades.</p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
      >
        <motion.div variants={item} className="bg-white rounded-xl p-6 border border-slate-200 shadow-[0_4px_20px_rgba(0,39,135,0.05)]">
          <h3 className="text-sm font-semibold text-slate-500 mb-1">LicitaÃ§Ãµes Ganhas</h3>
          <div className="text-3xl font-bold text-brand-blue">12</div>
          <p className="text-xs text-emerald-600 mt-2 font-medium">â†‘ 2 este mÃªs</p>
        </motion.div>

        <motion.div variants={item} className="bg-white rounded-xl p-6 border border-slate-200 shadow-[0_4px_20px_rgba(0,39,135,0.05)]">
          <h3 className="text-sm font-semibold text-slate-500 mb-1">Faturamento Estimado</h3>
          <div className="text-3xl font-bold text-brand-orange">R$ 1.2M</div>
          <p className="text-xs text-emerald-600 mt-2 font-medium">â†‘ 15% vs mÃªs anterior</p>
        </motion.div>

        <motion.div variants={item} className="bg-white rounded-xl p-6 border border-slate-200 shadow-[0_4px_20px_rgba(0,39,135,0.05)]">
          <h3 className="text-sm font-semibold text-slate-500 mb-1">Alertas do Radar</h3>
          <div className="text-3xl font-bold text-brand-blue">8</div>
          <p className="text-xs text-brand-orange mt-2 font-medium">Novos editais no seu nicho</p>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(0,39,135,0.05)]"
        >
          <h2 className="text-lg font-bold text-brand-blue mb-4">Radar Recente</h2>
          <div className="space-y-4">
            <div className="p-4 border border-slate-100 rounded-lg hover:border-brand-orange transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold bg-brand-orange/10 text-brand-orange px-2 py-1 rounded">PregÃ£o EletrÃ´nico</span>
                <span className="text-xs text-slate-400">Há 2 horas</span>
              </div>
              <h4 className="font-semibold text-slate-700 mb-1">Aquisição de Equipamentos de TI</h4>
              <p className="text-sm text-slate-500 mb-2">Prefeitura Municipal de São Paulo</p>
              <div className="text-sm font-bold text-brand-blue">Est. R$ 450.000,00</div>
            </div>
            <div className="p-4 border border-slate-100 rounded-lg hover:border-brand-orange transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold bg-brand-orange/10 text-brand-orange px-2 py-1 rounded">Dispensa</span>
                <span className="text-xs text-slate-400">Há 5 horas</span>
              </div>
              <h4 className="font-semibold text-slate-700 mb-1">Fornecimento de Material de Escritório</h4>
              <p className="text-sm text-slate-500 mb-2">Ministério da Educação</p>
              <div className="text-sm font-bold text-brand-blue">Est. R$ 45.000,00</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(0,39,135,0.05)]"
        >
          <h2 className="text-lg font-bold text-brand-blue mb-4">Status das Certidões</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-medium text-slate-700">Receita Federal</span>
              </div>
              <span className="text-xs text-slate-500">Vence em 45 dias</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-brand-orange"></div>
                <span className="text-sm font-medium text-brand-orange">FGTS (Caixa)</span>
              </div>
              <span className="text-xs font-bold text-brand-orange">Vence em 5 dias!</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-medium text-slate-700">Trabalhista (CNDT)</span>
              </div>
              <span className="text-xs text-slate-500">Vence em 120 dias</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

