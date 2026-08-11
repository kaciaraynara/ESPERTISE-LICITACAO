import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Mail } from 'lucide-react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000', // adjust for production
  // you would add auth headers here with a super admin token
});

function Sidebar() {
  return (
    <div className="w-64 bg-slate-900 h-screen border-r border-slate-800 flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Expertise Admin</h1>
        <p className="text-xs text-slate-500 mt-1">Super Backoffice</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        <Link to="/" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
          <LayoutDashboard size={20} className="mr-3 text-blue-400" />
          <span className="font-medium">Métricas Gerais</span>
        </Link>
        <Link to="/users" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
          <Users size={20} className="mr-3 text-emerald-400" />
          <span className="font-medium">Gestão de Clientes</span>
        </Link>
        <Link to="/health" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
          <Activity size={20} className="mr-3 text-rose-400" />
          <span className="font-medium">Logs & Saúde</span>
        </Link>
      </nav>
      
      <div className="p-4 border-t border-slate-800 text-center text-xs text-slate-500">
        Expertise © 2026
      </div>
    </div>
  );
}

function Layout() {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/super/metrics')
      .then(res => setMetrics(res.data.data))
      .catch(console.error);
  }, []);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <h2 className="text-3xl font-semibold mb-2">Visão Geral do SaaS</h2>
      <p className="text-slate-400 mb-8">Acompanhe as métricas de faturamento e uso da plataforma.</p>
      
      {metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Faturamento (MRR)" value={`R$ ${metrics.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={<Activity />} color="border-l-emerald-500" />
          <MetricCard title="Assinantes Ativos" value={metrics.activeSubscribers} icon={<Users />} color="border-l-blue-500" />
          <MetricCard title="Usuários em Teste" value={metrics.trialUsers} icon={<Activity />} color="border-l-amber-500" />
          <MetricCard title="Cancelamentos" value={metrics.cancellations} icon={<Activity />} color="border-l-rose-500" />
        </div>
      ) : (
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-slate-800 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-800 rounded"></div>
              <div className="h-4 bg-slate-800 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 ${color} border-l-4 rounded-xl p-6 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function UsersList() {
  const [users, setUsers] = useState<any[]>([]);
  const [emailModal, setEmailModal] = useState<{ isOpen: boolean, userId: string, email: string } | null>(null);

  useEffect(() => {
    api.get('/admin/super/users')
      .then(res => setUsers(res.data.data.users))
      .catch(console.error);
  }, []);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModal) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;

    try {
      await api.post('/admin/super/email', {
        userId: emailModal.userId,
        subject,
        message
      });
      alert('E-mail disparado com sucesso!');
      setEmailModal(null);
    } catch (err) {
      alert('Erro ao enviar e-mail');
    }
  };

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-semibold mb-2">Gestão de Clientes</h2>
          <p className="text-slate-400">Lista completa de usuários registrados e planos ativos.</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 text-slate-300 text-sm uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Usuário</th>
              <th className="px-6 py-4 font-medium">Plano / Role</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-200">{u.nome || 'Sem nome'}</div>
                  <div className="text-sm text-slate-500">{u.email}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 mr-2 border border-blue-500/20">
                    {u.plano}
                  </span>
                  <span className="text-xs text-slate-500">{u.role}</span>
                </td>
                <td className="px-6 py-4">
                  {u.subscriptions?.[0]?.status === 'active' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ativo</span>
                  ) : u.subscriptions?.[0]?.status === 'trialing' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Trial</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">Sem Assinatura</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setEmailModal({ isOpen: true, userId: u.id, email: u.email })}
                    className="inline-flex items-center justify-center p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors border border-indigo-500/20"
                    title="Disparar E-mail"
                  >
                    <Mail size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {emailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Mail className="mr-2 text-indigo-400" size={18} />
                Enviar e-mail para cliente
              </h3>
              <button onClick={() => setEmailModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSendEmail} className="p-6">
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-1">Destinatário</label>
                <input type="text" disabled value={emailModal.email} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-300 focus:outline-none" />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-1">Assunto</label>
                <input name="subject" required type="text" placeholder="Ex: Notificação Importante" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors" />
              </div>
              <div className="mb-6">
                <label className="block text-sm text-slate-400 mb-1">Mensagem</label>
                <textarea name="message" required rows={5} placeholder="Digite a mensagem..." className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"></textarea>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEmailModal(null)} className="px-4 py-2 rounded-lg font-medium text-slate-300 hover:bg-slate-800 transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">Disparar E-mail</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<UsersList />} />
          <Route path="health" element={<div className="p-10"><h2 className="text-2xl font-bold">Health & Logs</h2><p className="text-slate-400">Em breve</p></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
