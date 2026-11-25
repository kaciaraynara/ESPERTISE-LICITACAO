// Expertise Licitatória - Conector de Disputa (Popup Script)

document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const portalNameEl = document.getElementById('portalName');
  const portalInfoEl = document.getElementById('portalInfo');
  const companyNameEl = document.getElementById('companyName');
  const noticeNameEl = document.getElementById('noticeName');
  const toggleAutomation = document.getElementById('toggleAutomation');
  const itemCountEl = document.getElementById('itemCount');
  const lowestBidEl = document.getElementById('lowestBid');
  const btnEmergencyStop = document.getElementById('btnEmergencyStop');
  const btnOpenMesa = document.getElementById('btnOpenMesa');

  // Carrega estado salvo do storage
  chrome.storage.local.get(['activeCompany', 'activeNotice', 'automationEnabled', 'lastSyncedPortal', 'itemsData'], (res) => {
    if (res.activeCompany) {
      companyNameEl.textContent = res.activeCompany.razaoSocial || res.activeCompany.nomeFantasia || 'Empresa Conectada';
    } else {
      companyNameEl.textContent = 'Expertise Ativa';
    }

    if (res.activeNotice) {
      noticeNameEl.textContent = res.activeNotice.numeroEdital || res.activeNotice.id || 'Monitorado';
    }

    if (res.automationEnabled) {
      toggleAutomation.checked = true;
    }

    if (res.itemsData && Array.isArray(res.itemsData)) {
      itemCountEl.textContent = res.itemsData.length;
      const minBid = Math.min(...res.itemsData.map(i => Number(i.melhorLance || 0)).filter(v => v > 0));
      if (minBid > 0 && isFinite(minBid)) {
        lowestBidEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(minBid);
      }
    }
  });

  // Identifica a aba ativa do navegador
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = tab.url.toLowerCase();
      let detectedPortal = null;

      if (url.includes('comprasnet.gov.br') || url.includes('compras.gov.br')) {
        detectedPortal = 'Compras.gov.br';
      } else if (url.includes('bllcompras.com') || url.includes('bll.org.br')) {
        detectedPortal = 'BLL Compras';
      } else if (url.includes('bnc.org.br')) {
        detectedPortal = 'BNC Compras';
      } else if (url.includes('portaldecompraspublicas.com.br')) {
        detectedPortal = 'Portal de Compras Públicas';
      }

      if (detectedPortal) {
        portalNameEl.textContent = detectedPortal;
        portalNameEl.className = 'badge active-portal';
        portalInfoEl.textContent = 'Conectado à sala de disputa deste portal.';
        statusIndicator.className = 'status-badge connected';
        statusText.textContent = 'Conectado';

        // Envia mensagem para o content script para puxar dados frescos
        chrome.tabs.sendMessage(tab.id, { action: 'REQUEST_PORTAL_STATE' }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script ainda não carregou ou página recém-aberta
            return;
          }
          if (response && response.items) {
            itemCountEl.textContent = response.items.length;
          }
        });
      } else {
        portalNameEl.textContent = 'Não detectado';
        portalInfoEl.textContent = 'Abra a aba do certame no portal para sincronização.';
      }
    }
  } catch (err) {
    console.warn('Erro ao inspecionar aba ativa:', err);
  }

  // Toggle de Automação
  toggleAutomation.addEventListener('change', () => {
    const isEnabled = toggleAutomation.checked;
    if (isEnabled) {
      const confirmou = confirm(
        'TERMO DE OPERAÇÃO ASSISTIDA:\n\n' +
        'A automação só enviará lances respeitando o intervalo regulamentar e NUNCA cobrirá lances abaixo do seu Valor Mínimo (Sem Prejuízo) cadastrado.\n\n' +
        'Deseja ativar?'
      );
      if (!confirmou) {
        toggleAutomation.checked = false;
        return;
      }
    }

    chrome.storage.local.set({ automationEnabled: isEnabled });
    chrome.runtime.sendMessage({ action: 'TOGGLE_AUTOMATION', enabled: isEnabled });
  });

  // Botão de Parada de Emergência
  btnEmergencyStop.addEventListener('click', () => {
    toggleAutomation.checked = false;
    chrome.storage.local.set({ automationEnabled: false });

    // Notifica background e content script
    chrome.runtime.sendMessage({ action: 'EMERGENCY_STOP' });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'EMERGENCY_STOP' });
      }
    });

    alert('PARADA DE EMERGÊNCIA ACIONADA!\nTodos os lances automáticos foram cancelados imediatamente.');
  });

  // Abrir Mesa Estratégica Completa
  btnOpenMesa.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173/fornecedor/disputa-ao-vivo' });
  });
});
