function selectorFor(element) {
  if (!(element instanceof Element)) return null;
  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
  if (element.id) return `#${CSS.escape(element.id)}`;
  const name = element.getAttribute('name');
  if (name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
  return element.tagName.toLowerCase();
}

function send(event) {
  chrome.runtime.sendMessage({ type: 'RECORDER_EVENT', event }).catch(() => undefined);
}

function recordNavigation() {
  send({ action: 'NAVIGATE', url: window.location.href, text: document.title || null });
}

window.addEventListener('DOMContentLoaded', recordNavigation, { once: true });
window.addEventListener('popstate', recordNavigation);

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('button, a, input, [role="button"]') : null;
  if (!target) return;
  send({
    action: 'CLICK',
    url: window.location.href,
    selector: selectorFor(target),
    text: (target.textContent || target.getAttribute('aria-label') || '').trim().slice(0, 200) || null
  });
}, true);

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
  const action = target instanceof HTMLSelectElement ? 'SELECT' : target instanceof HTMLInputElement && target.type === 'checkbox' ? 'CHECK' : 'FILL';
  const value = target instanceof HTMLInputElement && target.type === 'password' ? '[MASKED]' : target.value;
  send({
    action,
    url: window.location.href,
    selector: selectorFor(target),
    value,
    text: target.getAttribute('aria-label') || target.getAttribute('name') || null
  });
}, true);
