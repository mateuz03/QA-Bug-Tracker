async function getState() {
  return chrome.storage.local.get(['apiUrl', 'token', 'sessionId', 'recording']);
}

async function sendEvent(event) {
  const state = await getState();
  if (!state.recording || !state.sessionId || !state.token) return;
  try {
    await fetch(`${state.apiUrl}/api/recordings/${state.sessionId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify(event)
    });
  } catch (error) {
    console.warn('QA Truker: evento não enviado.', error);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RECORDER_EVENT') {
    sendEvent(message.event).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
