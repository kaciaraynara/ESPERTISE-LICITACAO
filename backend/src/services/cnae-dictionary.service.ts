const GRUPOS_CNAE: Array<{ gatilhos: string[]; termos: string[] }> = [
  {
    gatilhos: ['62', '63', 'software', 'sistema', 'informatica', 'tecnologia', 'dados', 'nuvem', 'ti', 'suporte'],
    termos: ['software', 'sistema', 'licenca', 'informatica', 'tecnologia', 'suporte tecnico', 'desenvolvimento', 'computador'],
  },
  {
    gatilhos: ['14', '4781', 'vestuario', 'roupa', 'calcado', 'tenis', 'tecido', 'confeccao', 'uniforme'],
    termos: ['vestuario', 'uniforme', 'fardamento', 'roupa', 'calcado', 'tenis', 'confeccao', 'camiseta', 'jaleco'],
  },
  {
    gatilhos: ['41', '42', '43', '71', 'engenharia', 'construcao', 'reforma', 'obra', 'eletrica', 'hidraulica'],
    termos: ['obra', 'engenharia', 'reforma', 'construcao', 'manutencao predial', 'pavimentacao', 'instalacao'],
  },
  {
    gatilhos: ['4644', '4771', '86', 'saude', 'hospitalar', 'medicamento', 'odonto', 'laboratorio', 'medico'],
    termos: ['medicamento', 'hospitalar', 'medico', 'odontologico', 'enfermagem', 'laboratorial', 'insumo'],
  },
  {
    gatilhos: ['10', '4721', '56', 'alimento', 'alimenticio', 'merenda', 'refeicao', 'cesta', 'bebida'],
    termos: ['alimento', 'alimenticio', 'merenda', 'refeicao', 'hortifruti', 'carne', 'leite', 'lanche'],
  },
  {
    gatilhos: ['4761', '4789', 'papelaria', 'escritorio', 'escolar', 'mobiliario', 'movel', 'grafica'],
    termos: ['papelaria', 'expediente', 'material escolar', 'mobiliario', 'cadeira', 'mesa', 'impressao'],
  },
  {
    gatilhos: ['8121', 'limpeza', 'conservacao', 'higiene', 'asseio', 'zeladoria'],
    termos: ['limpeza', 'higiene', 'desinfetante', 'conservacao', 'asseio', 'zeladoria'],
  },
  {
    gatilhos: ['49', '45', 'transporte', 'veiculo', 'locacao', 'combustivel', 'frete', 'automotivo'],
    termos: ['transporte', 'locacao de veiculo', 'frete', 'combustivel', 'pecas automotivas', 'manutencao veicular'],
  },
];

export function expandirTermosCnae(cnaeInput?: string | null): string[] {
  const texto = String(cnaeInput || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!texto) return [];

  const encontrados = new Set<string>();
  for (const grupo of GRUPOS_CNAE) {
    if (grupo.gatilhos.some((g) => texto.includes(g))) {
      grupo.termos.forEach((t) => encontrados.add(t));
    }
  }

  if (encontrados.size === 0) {
    texto
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !['comercio', 'varejista', 'atacadista', 'servicos', 'artigos', 'outros'].includes(w))
      .slice(0, 5)
      .forEach((w) => encontrados.add(w));
  }

  return Array.from(encontrados);
}
