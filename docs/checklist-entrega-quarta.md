# Checklist operacional de entrega da Expertise até quarta-feira

## Objetivo
Executar a entrega completa da Expertise em modo de corrida, com foco em estabilidade, valor real e funcionamento ponta a ponta.

---

## 1. Estabilidade técnica
- [ ] Corrigir todos os erros de build do backend
- [ ] Garantir que o backend suba sem falhas
- [ ] Validar o Prisma com o Neon
- [ ] Garantir migrations e seed corretos
- [ ] Confirmar health check e readiness
- [ ] Ajustar variáveis de ambiente de produção
- [ ] Confirmar que a API responde corretamente

---

## 2. Autenticação e conta
- [ ] Cadastro de usuário funcionando
- [ ] Login funcionando
- [ ] Recuperação de acesso funcionando
- [ ] Empresa vinculada ao usuário
- [ ] Perfil básico carregando corretamente

---

## 3. Empresa e dados
- [ ] Cadastro empresarial funcionando
- [ ] Dados cadastrais carregando corretamente
- [ ] Perfil da empresa persistindo no banco
- [ ] Segmento / CNAE / contexto carregando

---

## 4. Licitações e oportunidades
- [ ] Busca de licitações funcionando
- [ ] Detalhes do edital carregando
- [ ] Score de aderência disponível
- [ ] Resumo executivo disponível
- [ ] Risco e oportunidade claros

---

## 5. Documentos e compliance
- [ ] Upload de documentos funcionando
- [ ] Lista de documentos carregando
- [ ] Checklist de compliance funcionando
- [ ] Pendências visíveis
- [ ] Prazos e vencimentos exibidos

---

## 6. Estratégia e decisão
- [ ] Estratégia de participação disponível
- [ ] Proposta inicial gerada ou estruturada
- [ ] Recomendação de decisão funcionando
- [ ] Análise de risco exibida

---

## 7. IA assistente
- [ ] IA respondendo com contexto do sistema
- [ ] Busca de informação contextualizada
- [ ] Resumo de edital funcionando
- [ ] Sugestão de próximos passos funcionando

---

## 8. SaaS e planos
- [ ] Planos básicos definidos
- [ ] Permissões por plano funcionando
- [ ] Acesso por assinatura funcionando
- [ ] Cobrança / assinatura operando
- [ ] Estado do plano visível no painel

---

## 9. Operação e confiança
- [ ] Notificações funcionando
- [ ] Auditoria registrando ações
- [ ] Logs visíveis
- [ ] Erros tratados de forma clara
- [ ] Fallback ou estado vazio funcionando sem quebra

---

## 10. Validação final
- [ ] Fluxo completo testado: login → empresa → oportunidade → documento → estratégia
- [ ] Frontend e backend funcionando em produção
- [ ] Deploy final validado
- [ ] Produto pronto para uso real

---

## Ordem de execução recomendada
1. Backend e Neon
2. Autenticação e empresa
3. Dashboard e oportunidades
4. Documentos e compliance
5. Estratégia e análise
6. IA assistente
7. Planos e assinatura
8. Testes finais e deploy

---

## Regras para não perder tempo
- Não parar em refinamento estético antes do core funcionar
- Toda feature precisa ser validada em fluxo real
- Se uma integração externa falhar, o sistema deve mostrar erro claro e não quebrar tudo
- O lançamento precisa ser feito com o produto funcional, mesmo que alguns módulos fiquem em modo de validação parcial
