
export function Footer() {
  return (
    <footer className="w-full py-6 mt-auto bg-white border-t border-slate-200">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Expertise LicitatÃ³ria. Todos os direitos reservados.
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <a href="/termos" className="hover:text-brand-blue transition-colors">Termos de Uso</a>
          <a href="/privacidade" className="hover:text-brand-blue transition-colors">Política de Privacidade</a>
          <a href="#" className="hover:text-brand-blue transition-colors">Contato</a>
        </div>
        
        <div className="text-xs text-slate-400 font-medium">
          Desenvolvido pela <span className="text-brand-orange font-bold">DIGITAL DAY</span>
        </div>
      </div>
    </footer>
  );
}

