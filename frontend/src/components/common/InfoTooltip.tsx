import React, { useId, useState } from 'react';

export interface InfoTooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'right';
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  text,
  position = 'top',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  const positionClasses: Record<'top' | 'bottom' | 'right', string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label={`Ajuda: ${text}`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-[#0B192C] focus:text-[#0B192C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] transition-colors cursor-help"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M10 9V14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="10" cy="6.25" r="1" fill="currentColor" />
        </svg>
      </button>

      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#E2E8F0',
          }}
          className={`pointer-events-none absolute z-50 w-64 max-w-xs rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-left text-[11px] font-medium normal-case tracking-normal leading-relaxed text-[#334155] shadow-lg ${positionClasses[position]}`}
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default InfoTooltip;

