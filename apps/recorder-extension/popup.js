const fields = {
  apiUrl: document.querySelector('#apiUrl'),
  token: document.querySelector('#token'),
  projectId: document.querySelector('#projectId'),
  scenarioId: document.querySelector('#scenarioId'),
  title: document.querySelector('#title')
};
const statusElement = document.querySelector('#status');
const messageElement = document.querySelector('#message');
const startButton = document.querySelector('#start');
const finishButton = document.querySelector('#finish');

async function hydrate() {
  const state = await chrome.storage.local.get(['apiUrl', 'token', 'projectId', 'scenarioId', 'title', 'sessionId', 'recording', 'sessionCode']);
  Object.entries(fields).forEach(([name, field]) => {
    if (state[name] != null) field.value = state[name];
  });
  render(Boolean(state.recording), state.sessionCode);
}

function render(recording, code) {
  statusElement.textContent = recording ? `● Gravando ${code || ''}` : 'Pronto para gravar';
  statusElement.className = `status ${recording ? 'recording' : 'idle'}`;
  startButton.disabled = recording;
  finishButton.disabled = !recording;
}

startButton.addEventListener('click', async () => {
  messageElement.textContent = '';
  const payload = {
    projectId: Number(fields.projectId.value),
    scenarioId: fields.scenarioId.value ? Number(fields.scenarioId.value) : null,
    title: fields.title.value
  };
  try {
    const response = await fetch(`${fields.apiUrl.value}/api/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fields.token.value}` },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Não foi possível iniciar.');
    await chrome.storage.local.set({
      apiUrl: fields.apiUrl.value,
      token: fields.token.value,
      projectId: fields.projectId.value,
      scenarioId: fields.scenarioId.value,
      title: fields.title.value,
      sessionId: body.id,
      sessionCode: body.code,
      recording: true
    });
    render(true, body.code);
  } catch (error) {
    messageElement.textContent = error.message;
  }
});

finishButton.addEventListener('click', async () => {
  const state = await chrome.storage.local.get(['apiUrl', 'token', 'sessionId']);
  try {
    const response = await fetch(`${state.apiUrl}/api/recordings/${state.sessionId}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Não foi possível finalizar.');
    await chrome.storage.local.set({ recording: false, sessionId: null, sessionCode: null });
    render(false);
    messageElement.textContent = `${body.scenario.code} salvo com sucesso.`;
  } catch (error) {
    messageElement.textContent = error.message;
  }
});

hydrate();
