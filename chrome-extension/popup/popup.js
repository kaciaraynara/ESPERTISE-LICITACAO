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

  let mesaUrl = 'http://localhost:5173/fornecedor/disputa-ao-vivo';

  chrome.storage.local.get(
    ['activeCompany', 'activeNotice', 'automationEnabled', 'itemsData', 'expertiseAppUrl'],
    (res) => {
      if (res.expertiseAppUrl) {
        try {
          const parsed = new URL(res.expertiseAppUrl);
          mesaUrl = `${parsed.origin}/fornecedor/disputa-ao-vivo`;
        } catch {
          // Mantém URL padrão
        }
      }

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
        const minBid = Math.min(...res.itemsData.map((i) => Number(i.melhorLance || 0)).filter((v) => v > 0));
        if (minBid > 0 && isFinite(minBid)) {
          lowestBidEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(minBid);
        }
      }
    }
  );

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = tab.url.toLowerCase();
      let detectedPortal = null;

      if (
        url.includes('cnetmobile.estaleiro.serpro.gov.br') ||
        url.includes('comprasnet.gov.br') ||
        url.includes('compras.gov.br')
      ) {
        detectedPortal = 'Compras.gov.br';
      } else if (url.includes('bllcompras.com') || url.includes('bll.org.br')) {
        detectedPortal = 'BLL Compras';
      } else if (url.includes('bnccompras.com') || url.includes('bnc.org.br')) {
        detectedPortal = 'BNC';
      } else if (url.includes('portaldecompraspublicas.com.br')) {
        detectedPortal = 'Portal de Compras Públicas';
      }

      if (detectedPortal) {
        portalNameEl.textContent = detectedPortal;
        portalNameEl.className = 'badge active-portal';
        portalInfoEl.textContent = 'Conectado à sala de disputa deste portal.';
        statusIndicator.className = 'status-badge connected';
        statusText.textContent = 'Portal Conectado';

        chrome.tabs.sendMessage(tab.id, { action: 'REQUEST_PORTAL_STATE' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response && response.items) {
            itemCountEl.textContent = response.items.length;
          }
        });
      } else {
        portalNameEl.textContent = 'Não detectado';
        portalInfoEl.textContent = 'Abra a aba do pregão no portal oficial para acompanhar ao vivo.';
      }
    }
  } catch (err) {
    console.warn('Erro ao inspecionar aba ativa:', err);
  }

  toggleAutomation.addEventListener('change', () => {
    const isEnabled = toggleAutomation.checked;
    if (isEnabled) {
      const confirmou = confirm(
        'TERMO DE LANCE AUTOMÁTICO PROTEGIDO:\n\n' +
          'O envio automático respeita intervalo de 2 a 5 segundos e NUNCA envia lances abaixo do seu Piso Mínimo (Proteção de Lucro) definido na Sala de Disputa.\n\n' +
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

  btnEmergencyStop.addEventListener('click', () => {
    toggleAutomation.checked = false;
    chrome.storage.local.set({ automationEnabled: false });

    chrome.runtime.sendMessage({ action: 'EMERGENCY_STOP' });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'EMERGENCY_STOP' });
      }
    });

    alert('PARADA DE EMERGÊNCIA ACIONADA!\nTodos os lances automáticos foram interrompidos imediatamente.');
  });

  btnOpenMesa.addEventListener('click', () => {
    chrome.tabs.create({ url: mesaUrl });
  });
});
