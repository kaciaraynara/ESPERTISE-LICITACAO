import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatCNPJ,
  truncate,
  getRecomendacaoLabel,
} from './utils';

describe('formatCurrency', () => {
  it('formats BRL', () => {
    expect(formatCurrency(1500)).toMatch(/1\.500/);
    expect(formatCurrency(1500)).toMatch(/R\$/);
  });

  it('handles null', () => {
    expect(formatCurrency(null)).toBe('Não informado');
  });
});

describe('formatDate', () => {
  it('formats ISO date', () => {
    expect(formatDate('2025-01-15')).toBe('15/01/2025');
  });

  it('handles empty', () => {
    expect(formatDate(undefined)).toBe('—');
  });
});

describe('formatCNPJ', () => {
  it('masks 14 digits', () => {
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('truncate', () => {
  it('shortens long text', () => {
    expect(truncate('a'.repeat(200), 10)).toHaveLength(13);
    expect(truncate('a'.repeat(200), 10)).toContain('...');
  });
});

describe('getRecomendacaoLabel', () => {
  it('returns labels', () => {
    expect(getRecomendacaoLabel('participar')).toBe('Participar');
    expect(getRecomendacaoLabel(undefined)).toBe('—');
  });
});
