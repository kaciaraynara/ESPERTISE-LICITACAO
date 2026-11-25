# Expertise Licitatória — Conector Oficial de Disputa (Google Chrome Extension)

Extensão oficial Manifest V3 para integração em tempo real entre a **Mesa Estratégica da Expertise Licitatória** e os principais portais públicos de compras do Brasil.

---

## 🎯 Portais Oficiais Suportados
- **Compras.gov.br** (Federal / ComprasNet novo e legado)
- **BLL Compras** (bllcompras.com / bll.org.br)
- **BNC Compras** (Bolsa Nacional de Compras - bnc.org.br)
- **Portal de Compras Públicas** (portaldecompraspublicas.com.br)

---

## 🔒 Princípios Invioláveis de Segurança & Conformidade Jurídica
1. **Trava Inviolável de Valor Mínimo (Sem Prejuízo)**:
   A extensão **NUNCA** envia lances abaixo do valor mínimo parametrizado pelo licitante na plataforma Expertise. Se o mercado ultrapassar o piso para baixo, a automação bloqueia o disparo e alerta o operador.
2. **Intervalo Regulamentar Anti-Flood**:
   Respeita rigorosamente o intervalo mínimo de segurança entre envios de lances exigido pelas regras dos portais (mínimo de 3 segundos), prevenindo penalidades ou bloqueios da sessão.
3. **Detecção e Pausa Automática por CAPTCHA**:
   Caso o portal apresente desafio de verificação humana (CAPTCHA, reCAPTCHA, Cloudflare), o robô assistido pausa a operação imediatamente para que o operador humano responda com tranquilidade.
4. **Parada de Emergência Global (STOP ALL)**:
   Botão de pânico em 1 clique disponível tanto no popup da extensão quanto na Mesa Estratégica Web, cancelando instantaneamente qualquer envio ativo.

---

## 🚀 Como Instalar no Google Chrome (Modo Desenvolvedor)

1. Abra o navegador Google Chrome.
2. Na barra de endereços, digite:
   ```text
   chrome://extensions
   ```
   e pressione Enter.
3. No canto superior direito da tela, ative a chave **"Modo do desenvolvedor"**.
4. No canto superior esquerdo, clique no botão **"Carregar sem compactação"**.
5. Selecione a pasta `chrome-extension` localizada no repositório do projeto:
   ```text
   EXPERTISE/chrome-extension
   ```
6. Pronto! O ícone da **Expertise Licitatória** aparecerá na barra de ferramentas do seu Chrome. Fixe-o na barra para acesso rápido durante certames.

---

## ⚡ Como Disputar com o Conector Ativo

1. Abra a **Mesa Estratégica de Disputa** na Expertise Licitatória (`/fornecedor/disputa-ao-vivo` ou `/fornecedor/robo-lances`).
2. Em outra aba do mesmo navegador, acesse o portal público (ex.: Compras.gov.br) e entre na sala de disputa do pregão.
3. O conector reconhecerá automaticamente a aba do portal:
   - A Mesa Estratégica exibirá o selo verde: **"Conector Ativo no Portal: [Nome do Portal]"**.
   - Os menores lances dos concorrentes e seu último lance serão lidos e atualizados na tela.
4. Para disparar lances manuais calculados pelo copiloto ou ligar a automação assistida com limite de segurança, clique nos botões de disparo da Mesa ou ative a chave no popup da extensão.
