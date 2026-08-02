
interface LogoProps {
  className?: string;
}

export function Logo({ className = 'h-10' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src="/logo.png" 
        alt="Expertise LicitatÃ³ria" 
        className="h-full object-contain"
      />
    </div>
  );
}

