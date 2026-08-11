import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Bell, ShieldCheck, Save, LogOut } from '@components/icons/phosphor-compat';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';

export default function ConfiguracoesPage() {
  const [salvando, setSalvando] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [nome, setNome] = useState(user?.nome ?? '');
  const [telefone, setTelefone] = useState(user?.telefone ?? '');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [exportando, setExportando] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha && senha !== confirmSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSalvando(true);
    try {
      const { authApi } = await import('@services/api');
      const response = await authApi.updateProfile({ 
        nome: nome || undefined, 
        telefone: telefone || undefined, 
        senha: senha || undefined 
      });
      
      // Update global auth store
      useAuthStore.getState().setAuth(response.data.data, useAuthStore.getState().accessToken!);
      
      toast.success('Configurações atualizadas com sucesso!', {
        style: { background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0' }
      });
      setSenha('');
      setConfirmSenha('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar configurações');
    } finally {
      setSalvando(false);
    }
  };

  const handleSair = () => {
    logout();
    toast.success('Sessão encerrada com segurança.');
    navigate('/login');
  };

  const handleExportarDados = async () => {
    setExportando(true);
    try {
      const { authApi } = await import('@services/api');
      const response = await authApi.exportData(); // Need to ensure api is exported properly, or use fetch
      const dataStr = JSON.stringify(response.data.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus_dados_expertise_${new Date().getTime()}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download dos seus dados iniciado.');
    } catch (err) {
      toast.error('Erro ao exportar dados. Tente novamente.');
    } finally {
      setExportando(false);
    }
  };

  const handleExcluirConta = async () => {
    setDeleting(true);
    try {
      const { authApi } = await import('@services/api');
      await authApi.deleteAccount();
      toast.success('Sua conta foi excluída e seus dados serão anonimizados.');
      logout();
      navigate('/login');
    } catch (err) {
      toast.error('Erro ao excluir conta.');
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 bg-white min-h-screen text-brand-blue">
      
      {/* CABEÇALHO */}
      <div className="border-b border-gray-100 pb-6">
        <h1 className="text-2xl font-bold text-brand-blue tracking-tight">Configurações da Conta</h1>
        <p className="text-brand-blue/70 mt-1 text-sm">
          Gerencie seus dados pessoais, segurança, alertas e acesso da sua conta Expertise.
        </p>
      </div>

      <form onSubmit={handleSalvar} className="space-y-6">
        
        {/* SESSÃO: DADOS DO PERFIL */}
        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-brand-blue flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-brand-blue" />
            Dados do Perfil
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-brand-blue mb-2">Nome Completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-white border border-gray-100 text-brand-blue text-sm rounded-lg focus:ring-brand-blue/10 focus:border-brand-blue/20 block p-2.5 outline-none transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-blue mb-2">E-mail de Acesso</label>
              <input
                type="email"
                value={user?.email ?? ''}
                className="w-full bg-white border border-gray-100 text-brand-blue/70 text-sm rounded-lg block p-2.5 cursor-not-allowed" 
                disabled
              />
              <p className="text-xs text-brand-blue/70 mt-1">Para alterar o e-mail, contate o suporte.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-blue mb-2">Telefone / WhatsApp</label>
              <input
                type="text"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full bg-white border border-gray-100 text-brand-blue text-sm rounded-lg focus:ring-brand-blue/10 focus:border-brand-blue/20 block p-2.5 outline-none transition-colors" 
              />
            </div>
          </div>
        </div>

        {/* SESSÃO: SEGURANÇA */}
        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-brand-blue flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-brand-blue" />
            Segurança
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-brand-blue mb-2">Nova Senha</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-white border border-gray-100 text-brand-blue text-sm rounded-lg focus:ring-brand-blue/10 focus:border-brand-blue/20 block p-2.5 outline-none transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-blue mb-2">Confirmar Nova Senha</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={confirmSenha}
                onChange={(e) => setConfirmSenha(e.target.value)}
                className="w-full bg-white border border-gray-100 text-brand-blue text-sm rounded-lg focus:ring-brand-blue/10 focus:border-brand-blue/20 block p-2.5 outline-none transition-colors" 
              />
            </div>
          </div>
          
          <div className="mt-6 flex items-start gap-3 p-4 bg-white border border-brand-blue/20 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-brand-blue flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-brand-blue">Autenticação em Duas Etapas (2FA)</p>
              <p className="text-sm text-brand-blue mt-1">Aumente a segurança da sua conta exigindo um código enviado para o seu celular.</p>
              <button type="button" className="mt-3 text-sm font-bold text-brand-blue hover:text-brand-blue">
                Ativar 2FA
              </button>
            </div>
          </div>
        </div>

        {/* SESSÃO: NOTIFICAÇÕES */}
        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-brand-blue flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-brand-blue" />
            Preferências de Alertas
          </h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-white cursor-pointer transition-colors">
              <div>
                <p className="font-semibold text-brand-blue text-sm">Resumo Diário do LEX</p>
                <p className="text-xs text-brand-blue/70">Receba um e-mail toda manhã com os editais filtrados pelas regras da conta.</p>
              </div>
              <input type="checkbox" className="w-4 h-4 text-brand-blue bg-white border-gray-100 rounded focus:ring-brand-blue/10" defaultChecked />
            </label>
          </div>
        </div>

        {/* SESSÃO: PRIVACIDADE E LGPD */}
        <div className="bg-white p-6 rounded-lg border border-red-100 shadow-sm">
          <h2 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            Privacidade e Exclusão de Conta (LGPD)
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Você tem o direito de exportar uma cópia dos seus dados ou solicitar a exclusão permanente de sua conta.
          </p>
          
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleExportarDados}
              disabled={exportando}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-lg transition-colors"
            >
              {exportando ? 'Preparando...' : 'Exportar Meus Dados'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg transition-colors border border-red-200"
            >
              Excluir Conta Permanentemente
            </button>
          </div>
        </div>

        {/* BOTÃO DE SALVAR */}
        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleSair}
            className="flex items-center justify-center gap-2 border border-brand-orange/50 bg-white px-6 py-3 rounded-lg text-sm font-bold text-brand-blue transition-all hover:bg-brand-orange/10 hover:border-brand-orange/50"
          >
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </button>

          <button
            type="submit"
            disabled={salvando}
            className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue active:scale-95 disabled:bg-white text-white px-8 py-3 rounded-lg text-sm font-bold transition-all shadow-md"
          >
            <Save className="w-4 h-4" />
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      {/* Modal de Exclusão de Conta */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-red-600 p-4 text-center">
              <h3 className="text-lg font-bold text-white">Zona de Risco: Excluir Conta</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700 mb-4 font-medium">
                Esta ação é <strong className="text-red-600">irreversível</strong>. 
                Sua conta será desativada instantaneamente e seus dados entrarão em processo automático de anonimização, conforme a LGPD.
              </p>
              <p className="text-sm text-slate-700 mb-6 font-medium">
                Você tem certeza absoluta que deseja excluir a sua conta?
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExcluirConta}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
                >
                  {deleting ? 'Excluindo...' : 'Sim, Excluir Minha Conta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
