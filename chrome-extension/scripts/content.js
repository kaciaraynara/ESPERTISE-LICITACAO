/**
 * Expertise Licitatória - Conector Multi-Portais (Manifest V3)
 * Portais Suportados:
 * 1. Compras.gov.br (cnetmobile.estaleiro.serpro.gov.br / comprasnet.gov.br / compras.gov.br)
 * 2. BLL Compras (bllcompras.com / bll.org.br)
 * 3. BNC (bnccompras.com / bnc.org.br)
 * 4. Portal de Compras Públicas (portaldecompraspublicas.com.br)
 * 5. Plataforma Expertise Licitatória
 */

(function () {
  const currentHost = window.location.hostname.toLowerCase();
  const HEARTBEAT_MAX_AGE_MS = 45000;

  // -------------------------------------------------------------
  // CASO 1: Aba da Plataforma Expertise Licitatória
  // -------------------------------------------------------------
  if (
    currentHost.includes('localhost') ||
    currentHost.includes('vercel.app') ||
    currentHost.includes('onrender.com')
  ) {
    function sendHeartbeatIfFresh() {
      chrome.storage.local.get(
        ['lastSyncedPortal', 'itemsData', 'portalStage', 'portalTimer', 'lastSyncTimestamp'],
        (res) => {
          const isFresh =
            Boolean(res.lastSyncedPortal) &&
            typeof res.lastSyncTimestamp === 'number' &&
            Date.now() - res.lastSyncTimestamp <= HEARTBEAT_MAX_AGE_MS;

          window.postMessage(
            {
              source: 'EXPERTISE_CHROME_EXTENSION',
              type: 'HEARTBEAT',
              connected: isFresh,
              portalName: isFresh ? res.lastSyncedPortal : '',
              itens: isFresh ? res.itemsData || [] : [],
              stage: isFresh ? res.portalStage : null,
              timer: isFresh ? res.portalTimer : null,
            },
            '*'
          );
        }
      );
    }

    window.addEventListener('message', (event) => {
      if (event.data?.source !== 'EXPERTISE_WEB_APP') return;

      if (event.data?.type === 'PING') {
        sendHeartbeatIfFresh();
      } else if (event.data?.type === 'SYNC_ITEM_RULES') {
        chrome.runtime.sendMessage({
          action: 'SYNC_ITEM_RULES',
          rules: event.data?.rules || {},
        });
      } else if (event.data?.type === 'AUTHORIZE_AUTO_BID') {
        chrome.runtime.sendMessage({
          action: 'AUTHORIZE_AUTO_BID',
          itemNumero: event.data?.itemNumero,
          valorLance: event.data?.valorLance,
          pisoMinimo: event.data?.pisoMinimo,
          decrementoMinimo: event.data?.decrementoMinimo,
        });
      } else if (event.data?.type === 'EMERGENCY_STOP') {
        chrome.runtime.sendMessage({ action: 'EMERGENCY_STOP' });
      }
    });

    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'PORTAL_STATE_UPDATE') {
        window.postMessage(
          {
            source: 'EXPERTISE_CHROME_EXTENSION',
            type: 'SYNC_PORTAL_STATE',
            connected: true,
            portalName: request.portal || 'Portal de Compras',
            itens: request.items || [],
            stage: request.stage || null,
            timer: request.timer || null,
          },
          '*'
        );
      } else if (request.action === 'PORTAL_BID_EVENT') {
        window.postMessage(
          {
            source: 'EXPERTISE_CHROME_EXTENSION',
            type: 'BID_EVENT',
            eventType: request.eventType,
            itemNumero: request.itemNumero,
            valorLance: request.valorLance,
            message: request.message,
          },
          '*'
        );
      }
    });

    sendHeartbeatIfFresh();
    return;
  }

  // -------------------------------------------------------------
  // CASO 2: Aba de Portal de Pregão Eletrônico
  // -------------------------------------------------------------
  let portalName = 'Portal de Compras';
  if (
    currentHost.includes('cnetmobile.estaleiro.serpro.gov.br') ||
    currentHost.includes('comprasnet.gov.br') ||
    currentHost.includes('compras.gov.br')
  ) {
    portalName = 'Compras.gov.br';
  } else if (currentHost.includes('bllcompras.com') || currentHost.includes('bll.org.br')) {
    portalName = 'BLL Compras';
  } else if (currentHost.includes('bnccompras.com') || currentHost.includes('bnc.org.br')) {
    portalName = 'BNC';
  } else if (currentHost.includes('portaldecompraspublicas.com.br')) {
    portalName = 'Portal de Compras Públicas';
  }

  let lastBidSentAt = 0;

  function parseMoedaBRL(texto) {
    if (!texto) return 0;
    const match = String(texto).match(/\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+,\d{2,4}/);
    if (!match) return 0;
    return parseFloat(match[0].replace(/\./g, '').replace(',', '.')) || 0;
  }

  function verificarCaptcha() {
    const temCaptcha =
      document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .cf-turnstile') !== null;
    if (temCaptcha) {
      chrome.runtime.sendMessage({ action: 'EMERGENCY_STOP' });
      return true;
    }
    return false;
  }

  function detectarEtapaECronometro() {
    const bodyText = (document.body?.innerText || '').slice(0, 6000);
    let stage = 'Aberto';
    if (/encerrad|finalizad|homologad/i.test(bodyText)) {
      stage = 'Encerrado';
    } else if (/prorroga[çc][ãa]o|imin[êe]ncia|aleat[óo]rio/i.test(bodyText)) {
      stage = 'Prorrogação';
    }

    const timerEl = document.querySelector(
      '.cronometro, .tempo-restante, [data-testid*="cronometro"], [class*="timer"], [id*="cronometro"]'
    );
    const timerMatch = (timerEl?.textContent || bodyText).match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/);
    return {
      stage,
      timer: timerMatch ? timerMatch[0] : null,
    };
  }

  function mapRowToItem(tr, idx, selectors) {
    const textoNum =
      (selectors.num ? tr.querySelector(selectors.num)?.textContent : null) ||
      tr.querySelector('td:first-child')?.textContent ||
      `${idx + 1}`;
    const numero = parseInt(textoNum.replace(/\D/g, ''), 10) || idx + 1;

    const textoMelhor =
      (selectors.melhor ? tr.querySelector(selectors.melhor)?.textContent : null) ||
      tr.querySelector('td:nth-child(4), td:nth-child(3)')?.textContent ||
      '';
    const melhorLance = parseMoedaBRL(textoMelhor);

    const textoSeu =
      (selectors.seu ? tr.querySelector(selectors.seu)?.textContent : null) ||
      tr.querySelector('td:nth-child(5)')?.textContent ||
      '';
    const seuLance = parseMoedaBRL(textoSeu);

    const textoPosicao =
      (selectors.pos ? tr.querySelector(selectors.pos)?.textContent : null) || '';
    const isPrimeiro =
      /\b1[º°]|\b1\b|vencendo|melhor/i.test(textoPosicao) ||
      (seuLance > 0 && melhorLance > 0 && Math.abs(seuLance - melhorLance) < 0.005);

    const { stage, timer } = detectarEtapaECronometro();

    if (melhorLance <= 0) return null;
    return {
      numero,
      melhorLance,
      seuLance: seuLance > 0 ? seuLance : null,
      posicao: isPrimeiro ? 1 : 2,
      etapa: stage,
      cronometro: timer,
    };
  }

  function extrairItensDaTela() {
    if (verificarCaptcha()) return [];
    const itensExtraidos = [];

    if (portalName === 'Compras.gov.br') {
      const linhas = document.querySelectorAll(
        'table.tabela-itens tbody tr, .grid-itens .linha-item, table tbody tr[id*="item"], app-item-disputa, .card-item-disputa'
      );
      linhas.forEach((tr, idx) => {
        const item = mapRowToItem(tr, idx, {
          num: '.col-numero, .item-numero, [data-testid="numero-item"], td:first-child',
          melhor: '.col-melhor-lance, .valor-melhor, td.melhor-lance, [data-testid="melhor-lance"]',
          seu: '.col-seu-lance, .seu-lance, td.meu-lance, [data-testid="seu-lance"]',
          pos: '.col-posicao, .posicao, [data-testid="posicao"]',
        });
        if (item) itensExtraidos.push(item);
      });
    } else if (portalName === 'BLL Compras') {
      const linhas = document.querySelectorAll(
        '#tblItensLances tbody tr, table[id*="Lote"] tbody tr, table tbody tr[data-item]'
      );
      linhas.forEach((tr, idx) => {
        const item = mapRowToItem(tr, idx, {
          num: 'td:first-child, .numero-item',
          melhor: '.melhor-lance, .menor-valor, td:nth-child(4)',
          seu: '.meu-lance, .seu-lance, td:nth-child(5)',
          pos: '.posicao, .col-classificacao',
        });
        if (item) itensExtraidos.push(item);
      });
    } else if (portalName === 'BNC') {
      const linhas = document.querySelectorAll(
        'table.table-lances tbody tr, .lista-itens-disputa tr, table tbody tr'
      );
      linhas.forEach((tr, idx) => {
        const item = mapRowToItem(tr, idx, {
          num: 'td:first-child, .item-id',
          melhor: '.valor-vencedor, .melhor-lance, td:nth-child(3)',
          seu: '.valor-meu-lance, .seu-lance, td:nth-child(4)',
          pos: '.classificacao, .status-lance',
        });
        if (item) itensExtraidos.push(item);
      });
    } else if (portalName === 'Portal de Compras Públicas') {
      const linhas = document.querySelectorAll(
        '.tabela-disputa tbody tr, table[class*="lances"] tbody tr, table tbody tr'
      );
      linhas.forEach((tr, idx) => {
        const item = mapRowToItem(tr, idx, {
          num: 'td:first-child, .numero-lote',
          melhor: '.melhor-oferta, .menor-lance, td:nth-child(4)',
          seu: '.meu-lance, td:nth-child(5)',
          pos: '.colocacao, .status-item',
        });
        if (item) itensExtraidos.push(item);
      });
    }

    if (itensExtraidos.length === 0) {
      document.querySelectorAll('table tbody tr').forEach((tr, idx) => {
        if (tr.querySelectorAll('td').length >= 3) {
          const item = mapRowToItem(tr, idx, {});
          if (item) itensExtraidos.push(item);
        }
      });
    }

    return itensExtraidos;
  }

  let ultimaLeituraTimestamp = 0;
  function sincronizarLeituraPortal() {
    const agora = Date.now();
    if (agora - ultimaLeituraTimestamp < 2500) return;
    ultimaLeituraTimestamp = agora;

    const itens = extrairItensDaTela();
    const { stage, timer } = detectarEtapaECronometro();
    if (itens.length > 0) {
      chrome.runtime.sendMessage({
        action: 'SYNC_FROM_PORTAL',
        portal: portalName,
        items: itens,
        stage,
        timer,
      });
    }
  }

  function notificarAborto(itemNumero, motivo) {
    chrome.runtime.sendMessage({
      action: 'PORTAL_BID_EVENT',
      eventType: 'BID_ABORTED',
      itemNumero,
      message: motivo,
    });
  }

  function localizarCampoEBotaoLance(itemNumero) {
    const linhas = Array.from(document.querySelectorAll('table tbody tr, .linha-item, .card-item-disputa'));
    const linhaAlvo = linhas.find((el) => {
      const txt = el.querySelector('td:first-child, .col-numero, .item-numero')?.textContent || '';
      const num = parseInt(txt.replace(/\D/g, ''), 10);
      return num === Number(itemNumero);
    });

    const escopo = linhaAlvo || document;
    const input = escopo.querySelector(
      'input[name*="lance" i], input[id*="lance" i], input[placeholder*="lance" i], input[placeholder*="valor" i], input[type="text"][class*="valor" i], input[type="number"]'
    );
    const btn = escopo.querySelector(
      'button[class*="enviar" i], button[class*="lance" i], button[id*="enviar" i], button[type="submit"]'
    );

    return { input, btn };
  }

  function executarLanceComDuplaValidacao(request) {
    const itemNumero = Number(request.itemNumero);
    const valorLance = Number(request.valorLance);
    const pisoMinimo = Number(request.pisoMinimo);
    const decrementoMinimo = Number(request.decrementoMinimo || 0.01);

    if (verificarCaptcha()) {
      notificarAborto(itemNumero, 'Verificação de segurança detectada no portal. Assuma manualmente.');
      return;
    }

    if (!Number.isFinite(pisoMinimo) || pisoMinimo <= 0 || !Number.isFinite(valorLance) || valorLance < pisoMinimo) {
      notificarAborto(
        itemNumero,
        `Envio abortado no Item #${itemNumero}: valor abaixo do Piso Mínimo protegido.`
      );
      return;
    }

    chrome.storage.local.get(['automationEnabled', 'itemRules'], (res) => {
      const regraItem = res.itemRules?.[String(itemNumero)];
      if (!res.automationEnabled || !regraItem || !regraItem.lanceAutomatico) {
        notificarAborto(itemNumero, `Lance Automático desativado para o Item #${itemNumero}.`);
        return;
      }

      if (valorLance < Number(regraItem.pisoMinimo || 0)) {
        notificarAborto(
          itemNumero,
          `Piso Mínimo atingido no Item #${itemNumero}: disputa pausada para proteger sua margem.`
        );
        return;
      }

      const itensAtuais = extrairItensDaTela();
      const itemPortal = itensAtuais.find((x) => x.numero === itemNumero);
      if (!itemPortal || itemPortal.etapa === 'Encerrado') {
        notificarAborto(itemNumero, `Item #${itemNumero} indisponível ou encerrado no portal. Assuma manualmente.`);
        return;
      }

      const diferenca = Number((itemPortal.melhorLance - valorLance).toFixed(2));
      if (diferenca < Number((decrementoMinimo - 0.001).toFixed(3))) {
        notificarAborto(
          itemNumero,
          `Divergência de valor no Item #${itemNumero} (decremento mínimo não atendido). Assuma manualmente.`
        );
        return;
      }

      const { input, btn } = localizarCampoEBotaoLance(itemNumero);
      if (!input || !btn) {
        notificarAborto(
          itemNumero,
          `Campo de lance do Item #${itemNumero} não localizado na página do ${portalName}. Assuma manualmente.`
        );
        return;
      }

      const agora = Date.now();
      const delayMs = Math.floor(2000 + Math.random() * 3000);
      const esperaAdicional = Math.max(0, lastBidSentAt + delayMs - agora);
      const atrasoFinal = Math.max(delayMs, esperaAdicional);

      setTimeout(() => {
        const valorFormatado = valorLance.toFixed(2).replace('.', ',');
        input.focus();
        input.value = valorFormatado;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        btn.click();
        lastBidSentAt = Date.now();

        chrome.runtime.sendMessage({
          action: 'PORTAL_BID_EVENT',
          eventType: 'BID_SENT',
          itemNumero,
          valorLance,
          message: `Lance automático enviado no Item #${itemNumero}: R$ ${valorFormatado}`,
        });
      }, atrasoFinal);
    });
  }

  const observer = new MutationObserver(() => {
    sincronizarLeituraPortal();
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  setTimeout(sincronizarLeituraPortal, 1500);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'REQUEST_PORTAL_STATE') {
      const itens = extrairItensDaTela();
      const { stage, timer } = detectarEtapaECronometro();
      sendResponse({ portal: portalName, items: itens, stage, timer });
      return true;
    }

    if (request.action === 'EXECUTE_AUTHORIZED_BID') {
      executarLanceComDuplaValidacao(request);
      sendResponse({ status: 'VALIDATING' });
      return true;
    }

    if (request.action === 'EMERGENCY_STOP') {
      sendResponse({ status: 'STOPPED' });
      return true;
    }
  });
})();
