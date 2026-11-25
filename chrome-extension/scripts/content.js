/**
 * Expertise Licitatória - Content Script Multi-Portais (Manifest V3)
 * Portais Suportados:
 * 1. Compras.gov.br (Novo e Legado)
 * 2. BLL Compras (bllcompras.com / bll.org.br)
 * 3. BNC (bnc.org.br)
 * 4. Portal de Compras Públicas (portaldecompraspublicas.com.br)
 * 5. Expertise Licitatória Web App
 */

(function () {
  const currentHost = window.location.hostname.toLowerCase();
  console.log('[Expertise Extension] Content script ativo em:', currentHost);

  // -------------------------------------------------------------
  // CASO 1: Página da Plataforma Expertise Licitatória
  // -------------------------------------------------------------
  if (currentHost.includes('localhost') || currentHost.includes('vercel.app') || currentHost.includes('onrender.com')) {
    // Responde ao PING da Mesa Estratégica
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'EXPERTISE_WEB_APP') {
        if (event.data?.type === 'PING') {
          chrome.storage.local.get(['lastSyncedPortal', 'itemsData'], (res) => {
            window.postMessage(
              {
                source: 'EXPERTISE_CHROME_EXTENSION',
                type: 'HEARTBEAT',
                portalName: res.lastSyncedPortal || 'Compras.gov.br',
                itens: res.itemsData || [],
              },
              '*'
            );
          });
        }

        if (event.data?.type === 'EMERGENCY_STOP') {
          chrome.runtime.sendMessage({ action: 'EMERGENCY_STOP' });
        }
      }
    });

    // Envia heartbeat inicial para a Mesa Estratégica
    chrome.storage.local.get(['lastSyncedPortal', 'itemsData'], (res) => {
      window.postMessage(
        {
          source: 'EXPERTISE_CHROME_EXTENSION',
          type: 'HEARTBEAT',
          portalName: res.lastSyncedPortal || 'Compras.gov.br',
          itens: res.itemsData || [],
        },
        '*'
      );
    });
    return;
  }

  // -------------------------------------------------------------
  // CASO 2: Aba de Portal de Compras Públicas
  // -------------------------------------------------------------
  let portalName = 'Portal de Compras';
  if (currentHost.includes('comprasnet.gov.br') || currentHost.includes('compras.gov.br')) {
    portalName = 'Compras.gov.br';
  } else if (currentHost.includes('bllcompras.com') || currentHost.includes('bll.org.br')) {
    portalName = 'BLL Compras';
  } else if (currentHost.includes('bnc.org.br')) {
    portalName = 'BNC Compras';
  } else if (currentHost.includes('portaldecompraspublicas.com.br')) {
    portalName = 'Portal de Compras Públicas';
  }

  // Função utilitária para converter texto monetário em número
  function parseMoedaBRL(texto) {
    if (!texto) return 0;
    const limpo = texto.replace(/[^\d,\.]/g, '').trim();
    if (!limpo) return 0;
    return parseFloat(limpo.replace(/\./g, '').replace(',', '.')) || 0;
  }

  // Detecção de CAPTCHA ou Desafio de Segurança
  function verificarCaptcha() {
    const temCaptcha =
      document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .cf-turnstile') !==
      null;
    if (temCaptcha) {
      console.warn('[Expertise Extension] CAPTCHA detectado na página. Pausando automação imediatamente.');
      chrome.runtime.sendMessage({ action: 'EMERGENCY_STOP' });
      return true;
    }
    return false;
  }

  // Extrator de Itens Genérico com Adaptadores Específicos
  function extrairItensDaTela() {
    if (verificarCaptcha()) return [];

    const itensExtraidos = [];

    // Adaptador 1: Compras.gov.br
    if (portalName === 'Compras.gov.br') {
      const linhas = document.querySelectorAll(
        'table.tabela-itens tr, .grid-itens .linha-item, table tbody tr[id*="item"]'
      );
      linhas.forEach((tr, idx) => {
        const textoNum = tr.querySelector('.col-numero, .item-numero, td:first-child')?.textContent || `${idx + 1}`;
        const numero = parseInt(textoNum.replace(/\D/g, ''), 10) || idx + 1;

        const textoMelhor =
          tr.querySelector('.col-melhor-lance, .valor-melhor, td.melhor-lance, td:nth-child(4)')?.textContent || '';
        const melhorLance = parseMoedaBRL(textoMelhor);

        const textoSeu =
          tr.querySelector('.col-seu-lance, .seu-lance, td.meu-lance, td:nth-child(5)')?.textContent || '';
        const seuLance = parseMoedaBRL(textoSeu);

        const textoPosicao = tr.querySelector('.col-posicao, .posicao')?.textContent || '';
        const posicao = textoPosicao.includes('1') ? 1 : 2;

        if (melhorLance > 0) {
          itensExtraidos.push({
            numero,
            melhorLance,
            seuLance: seuLance > 0 ? seuLance : null,
            posicao,
          });
        }
      });
    }

    // Adaptador 2: BLL Compras / BNC / Portal de Compras Públicas
    if (itensExtraidos.length === 0) {
      const tabelas = document.querySelectorAll('table');
      tabelas.forEach((tab) => {
        const linhas = tab.querySelectorAll('tbody tr');
        linhas.forEach((tr, idx) => {
          const colunas = tr.querySelectorAll('td');
          if (colunas.length >= 4) {
            const numero = parseInt(colunas[0]?.textContent?.replace(/\D/g, '') || `${idx + 1}`, 10) || idx + 1;
            const melhorLance = parseMoedaBRL(colunas[2]?.textContent || colunas[3]?.textContent || '');
            if (melhorLance > 0) {
              itensExtraidos.push({
                numero,
                melhorLance,
                seuLance: null,
                posicao: 2,
              });
            }
          }
        });
      });
    }

    return itensExtraidos;
  }

  // Sincronização periódica da leitura da tela (a cada 3 segundos)
  let ultimaLeituraTimestamp = 0;
  function sincronizarLeituraPortal() {
    const agora = Date.now();
    if (agora - ultimaLeituraTimestamp < 2500) return;
    ultimaLeituraTimestamp = agora;

    const itens = extrairItensDaTela();
    if (itens.length > 0) {
      chrome.runtime.sendMessage({
        action: 'SYNC_FROM_PORTAL',
        portal: portalName,
        items: itens,
      });
    }
  }

  // Inicia observador de mutações no DOM do portal para capturar lances em tempo real
  const observer = new MutationObserver(() => {
    sincronizarLeituraPortal();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Leitura inicial
  setTimeout(sincronizarLeituraPortal, 1500);

  // Listener para mensagens vindas do Popup ou Background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'REQUEST_PORTAL_STATE') {
      const itens = extrairItensDaTela();
      sendResponse({ portal: portalName, items: itens });
      return true;
    }

    if (request.action === 'EMERGENCY_STOP') {
      console.warn('[Expertise Extension] Parada de emergência recebida no portal.');
      sendResponse({ status: 'STOPPED' });
      return true;
    }
  });
})();
