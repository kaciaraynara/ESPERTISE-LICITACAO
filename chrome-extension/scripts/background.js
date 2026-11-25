// Expertise Licitatória - Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Expertise Extension] Conector Oficial instalado com sucesso.');
  chrome.storage.local.set({
    automationEnabled: false,
    minBidIntervalSeconds: 3,
  });
});

// Listener de Mensagens Globais
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EMERGENCY_STOP') {
    chrome.storage.local.set({ automationEnabled: false });

    // Notifica todas as abas abertas de compras
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'EMERGENCY_STOP' }).catch(() => {});
        }
      });
    });

    sendResponse({ success: true, status: 'STOPPED' });
    return true;
  }

  if (request.action === 'SYNC_FROM_PORTAL') {
    // Salva última leitura no storage
    chrome.storage.local.set({
      lastSyncedPortal: request.portal,
      itemsData: request.items,
      lastSyncTimestamp: Date.now(),
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'GET_AUTOMATION_STATE') {
    chrome.storage.local.get(['automationEnabled'], (res) => {
      sendResponse({ automationEnabled: !!res.automationEnabled });
    });
    return true;
  }
});
