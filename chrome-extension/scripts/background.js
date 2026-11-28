// Expertise Licitatória - Service Worker (Manifest V3)

const EXPERTISE_URL_PATTERNS = [
  'http://localhost:5173/*',
  'http://localhost:5174/*',
  'https://*.vercel.app/*',
  'https://*.onrender.com/*',
];

const PORTAL_URL_PATTERNS = [
  '*://*.comprasnet.gov.br/*',
  '*://*.compras.gov.br/*',
  '*://cnetmobile.estaleiro.serpro.gov.br/*',
  '*://*.bll.org.br/*',
  '*://*.bllcompras.com/*',
  '*://*.bnc.org.br/*',
  '*://*.bnccompras.com/*',
  '*://*.portaldecompraspublicas.com.br/*',
];

function notifyTabsByUrl(urlPatterns, payload) {
  chrome.tabs.query({ url: urlPatterns }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
      }
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    automationEnabled: false,
    minBidIntervalSeconds: 3,
    itemRules: {},
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EMERGENCY_STOP') {
    chrome.storage.local.set({ automationEnabled: false });
    notifyTabsByUrl(PORTAL_URL_PATTERNS, { action: 'EMERGENCY_STOP' });
    notifyTabsByUrl(EXPERTISE_URL_PATTERNS, {
      action: 'PORTAL_BID_EVENT',
      eventType: 'EMERGENCY_STOP',
      message: 'Parada de emergência acionada: envios automáticos interrompidos.',
    });
    sendResponse({ success: true, status: 'STOPPED' });
    return true;
  }

  if (request.action === 'TOGGLE_AUTOMATION') {
    chrome.storage.local.set({ automationEnabled: !!request.enabled });
    sendResponse({ success: true, automationEnabled: !!request.enabled });
    return true;
  }

  if (request.action === 'SYNC_ITEM_RULES') {
    chrome.storage.local.set({
      itemRules: request.rules || {},
      expertiseAppUrl: sender?.tab?.url || null,
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'SYNC_FROM_PORTAL') {
    const now = Date.now();
    chrome.storage.local.set({
      lastSyncedPortal: request.portal,
      itemsData: request.items || [],
      portalStage: request.stage || null,
      portalTimer: request.timer || null,
      lastSyncTimestamp: now,
    });

    notifyTabsByUrl(EXPERTISE_URL_PATTERNS, {
      action: 'PORTAL_STATE_UPDATE',
      portal: request.portal,
      items: request.items || [],
      stage: request.stage || null,
      timer: request.timer || null,
      timestamp: now,
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'AUTHORIZE_AUTO_BID') {
    chrome.storage.local.set({ automationEnabled: true });
    notifyTabsByUrl(PORTAL_URL_PATTERNS, {
      action: 'EXECUTE_AUTHORIZED_BID',
      itemNumero: request.itemNumero,
      valorLance: request.valorLance,
      pisoMinimo: request.pisoMinimo,
      decrementoMinimo: request.decrementoMinimo,
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'PORTAL_BID_EVENT') {
    notifyTabsByUrl(EXPERTISE_URL_PATTERNS, {
      action: 'PORTAL_BID_EVENT',
      eventType: request.eventType,
      itemNumero: request.itemNumero,
      valorLance: request.valorLance,
      message: request.message,
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
