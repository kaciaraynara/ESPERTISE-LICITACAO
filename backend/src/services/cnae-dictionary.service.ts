interface CnaeGrupoConfig {
  id: string;
  codigosPrefixo: string[];
  palavrasGatilho: string[];
  termos: string[];
}

const GRUPOS_CNAE: CnaeGrupoConfig[] = [
  {
    id: 'software_ti',
    codigosPrefixo: ['62', '63', '9511', '582', '262', '4651', '4751'],
    palavrasGatilho: ['software', 'sistema', 'informatica', 'tecnologia', 'dados', 'nuvem', 'ti', 'tic', 'saas', 'cloud', 'hardware', 'notebook', 'computador', 'servidor', 'rede', 'ciberseguranca', 'suporte'],
    termos: ['software', 'sistema', 'licenca', 'informatica', 'tecnologia', 'suporte tecnico', 'desenvolvimento', 'computador', 'tic', 'saas', 'nuvem', 'hardware', 'notebook', 'servidor'],
  },
  {
    id: 'vestuario_uniformes',
    codigosPrefixo: ['14', '13', '15', '4641', '4642', '4781', '4782'],
    palavrasGatilho: ['vestuario', 'roupa', 'calcado', 'tenis', 'tecido', 'confeccao', 'uniforme', 'fardamento', 'epi', 'textil', 'malharia', 'camisa', 'bota', 'luva'],
    termos: ['vestuario', 'uniforme', 'fardamento', 'roupa', 'calcado', 'tenis', 'confeccao', 'camiseta', 'jaleco', 'epi', 'textil', 'bota'],
  },
  {
    id: 'eletrica_instalacoes',
    codigosPrefixo: ['432', '271', '273', '274', '351'],
    palavrasGatilho: ['eletrica', 'eletrico', 'iluminacao', 'subestacao', 'cabeamento', 'hidraulica', 'solar', 'fotovoltaico', 'fotovoltaica', 'climatizacao', 'ar condicionado', 'refrigeracao'],
    termos: ['eletrica', 'instalacao', 'iluminacao', 'cabeamento', 'quadro eletrico', 'lampada', 'subestacao', 'manutencao', 'energia solar', 'fotovoltaico', 'climatizacao', 'ar condicionado'],
  },
  {
    id: 'obras_engenharia',
    codigosPrefixo: ['41', '42', '43', '71'],
    palavrasGatilho: ['engenharia', 'construcao', 'reforma', 'obra', 'pavimentacao', 'edificacao', 'arquitetura', 'terraplenagem', 'drenagem', 'asfalto', 'saneamento'],
    termos: ['obra', 'engenharia', 'reforma', 'construcao', 'manutencao predial', 'pavimentacao', 'instalacao', 'edificacao', 'projeto executivo', 'infraestrutura'],
  },
  {
    id: 'saude_hospitalar',
    codigosPrefixo: ['4644', '4645', '4664', '3250', '4771', '4773', '86', '21'],
    palavrasGatilho: ['saude', 'hospitalar', 'medicamento', 'odonto', 'odontologico', 'laboratorio', 'laboratorial', 'medico', 'cirurgico', 'enfermagem', 'farmacia', 'reagente', 'ambulancia'],
    termos: ['medicamento', 'hospitalar', 'medico', 'odontologico', 'enfermagem', 'laboratorial', 'insumo', 'cirurgico', 'equipamento medico', 'reagente'],
  },
  {
    id: 'alimentos_merenda',
    codigosPrefixo: ['10', '11', '463', '4711', '4712', '4721', '4729', '56'],
    palavrasGatilho: ['alimento', 'alimenticio', 'alimentacao', 'merenda', 'refeicao', 'cesta', 'bebida', 'generos', 'hortifruti', 'padaria', 'panificacao', 'catering', 'coffee break'],
    termos: ['alimento', 'alimenticio', 'merenda', 'refeicao', 'hortifruti', 'carne', 'leite', 'lanche', 'generos alimenticios', 'cesta basica'],
  },
  {
    id: 'moveis_escritorio',
    codigosPrefixo: ['3101', '3102', '3103', '4649404', '4754'],
    palavrasGatilho: ['mobiliario', 'movel', 'moveis', 'cadeira', 'estacao de trabalho', 'armario', 'poltrona', 'longarina', 'marcenaria'],
    termos: ['mobiliario', 'movel', 'cadeira', 'mesa', 'armario', 'estante', 'escritorio', 'poltrona', 'longarina'],
  },
  {
    id: 'papelaria_suprimentos',
    codigosPrefixo: ['4647', '4761', '4789', '173', '181'],
    palavrasGatilho: ['papelaria', 'escritorio', 'escolar', 'grafica', 'suprimentos', 'expediente', 'toner', 'cartucho', 'impressao', 'encadernacao', 'didatico'],
    termos: ['papelaria', 'expediente', 'material escolar', 'suprimentos', 'impresso', 'toner', 'grafica', 'papel', 'cartucho'],
  },
  {
    id: 'limpeza_conservacao',
    codigosPrefixo: ['8121', '8129', '8130', '4649408', '206', '78'],
    palavrasGatilho: ['limpeza', 'conservacao', 'higiene', 'asseio', 'zeladoria', 'desinfetante', 'facilities', 'jardinagem', 'poda', 'capina', 'dedetizacao', 'pragas', 'portaria', 'recepcao'],
    termos: ['limpeza', 'higiene', 'desinfetante', 'conservacao', 'asseio', 'zeladoria', 'detergente', 'sanitizacao', 'jardinagem', 'controle de pragas'],
  },
  {
    id: 'transporte_logistica',
    codigosPrefixo: ['49', '45', '52', '53', '7711'],
    palavrasGatilho: ['transporte', 'veiculo', 'locacao', 'combustivel', 'frete', 'automotivo', 'logistica', 'frota', 'pneu', 'lubrificante', 'onibus', 'van', 'caminhao'],
    termos: ['transporte', 'locacao de veiculo', 'frete', 'combustivel', 'pecas automotivas', 'manutencao veicular', 'logistica', 'gestao de frota', 'pneus'],
  },
  {
    id: 'seguranca_cftv',
    codigosPrefixo: ['801', '802', '803', '432150099'],
    palavrasGatilho: ['seguranca', 'vigilancia', 'cftv', 'camera', 'alarme', 'monitoramento', 'controle de acesso', 'catraca', 'biometria', 'escolta', 'patrimonial'],
    termos: ['vigilancia', 'seguranca patrimonial', 'cftv', 'monitoramento eletronico', 'camera de seguranca', 'controle de acesso', 'alarme'],
  },
  {
    id: 'consultoria_eventos',
    codigosPrefixo: ['702', '731', '749', '823', '691', '692', '859'],
    palavrasGatilho: ['consultoria', 'assessoria', 'auditoria', 'treinamento', 'capacitacao', 'evento', 'sonorizacao', 'palco', 'publicidade', 'comunicacao', 'contabil', 'juridica'],
    termos: ['consultoria', 'assessoria tecnica', 'treinamento', 'capacitacao', 'organizacao de eventos', 'sonorizacao', 'comunicacao', 'auditoria'],
  },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesWordBoundary(texto: string, termo: string): boolean {
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(termo)}(?:$|[^a-z0-9])`);
  return re.test(texto);
}

export function expandirTermosCnae(cnaeInput?: string | null): string[] {
  const texto = String(cnaeInput || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!texto) return [];

  const leadingCodeMatch = texto.match(/^\D*(\d[\d./\-\s]{1,12})/);
  const codigoDigitos = leadingCodeMatch ? leadingCodeMatch[1].replace(/\D/g, '') : '';

  const encontrados = new Set<string>();
  let matchedSpecificGroup = false;

  for (const grupo of GRUPOS_CNAE) {
    const matchedCode = Boolean(
      codigoDigitos && grupo.codigosPrefixo.some((prefixo) => codigoDigitos.startsWith(prefixo)),
    );
    const matchedKeyword = grupo.palavrasGatilho.some((palavra) => matchesWordBoundary(texto, palavra));

    // Evita que grupo genérico de obras ("43") sobrescreva eletrica ("432") com ruído desnecessário se já casou grupo específico
    if (matchedCode || matchedKeyword) {
      if (grupo.id === 'obras_engenharia' && matchedSpecificGroup && codigoDigitos.startsWith('432')) {
        continue;
      }
      if (grupo.id === 'eletrica_instalacoes' && matchedCode) {
        matchedSpecificGroup = true;
      }
      grupo.termos.forEach((t) => encontrados.add(t));
    }
  }

  if (encontrados.size === 0) {
    texto
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !['comercio', 'varejista', 'atacadista', 'servicos', 'artigos', 'outros'].includes(w))
      .slice(0, 5)
      .forEach((w) => encontrados.add(w));
  }

  return Array.from(encontrados);
}
