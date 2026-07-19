(() => {
  const notice = document.querySelector('.notice');
  const accessButton = document.getElementById('access');
  const mapButton = document.getElementById('map');
  const draftButton = document.getElementById('draft');
  const mapStatus = document.getElementById('map-status');
  const codeInput = document.getElementById('code');
  const codeLabel = document.querySelector('label[for="code"]');
  const codeError = document.getElementById('code-error');
  const accessStep = document.querySelector('[data-step="2"]');
  let live = false;

  codeInput.value = 'open';
  codeInput.hidden = true;
  if (codeLabel) codeLabel.hidden = true;
  if (codeError) codeError.hidden = true;
  if (accessStep) {
    const eyebrow = accessStep.querySelector('.eyebrow');
    const heading = accessStep.querySelector('h2');
    const paragraph = accessStep.querySelector('h2 + p');
    if (eyebrow) eyebrow.textContent = 'Open bridge';
    if (heading) heading.textContent = 'Continue to BridgeTranslate';
    if (paragraph) paragraph.textContent = 'No account, password or invitation code is required.';
  }
  accessButton.textContent = 'I understand, continue';

  function setBusy(button, busy, label) {
    button.disabled = busy;
    button.classList.toggle('busy', busy);
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = label;
    } else if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), accept: 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function selected(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }

  function appendFiles(form, fieldName, inputId) {
    const input = document.getElementById(inputId);
    for (const file of input.files || []) form.append(fieldName, file, file.name);
  }

  async function connectStatus() {
    try {
      const status = await api('/api/status');
      live = Boolean(status.aiConfigured);
      if (live) {
        notice.innerHTML = '<strong>Working peer bridge:</strong> open access is active and AI translation is connected.';
      } else {
        notice.innerHTML = '<strong>Interface build:</strong> the page is open and clickable, but the AI key has not yet been connected. The demonstration path still works.';
      }
    } catch {
      live = false;
    }
  }

  accessButton.addEventListener('click', async (event) => {
    if (!live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const consent = document.getElementById('consent');
    if (!consent.checked) return consent.focus();
    setBusy(accessButton, true, 'Opening bridge…');
    try {
      await api('/api/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ open: true })
      });
      window.show(3);
    } catch (errorValue) {
      window.alert(errorValue.message);
    } finally {
      setBusy(accessButton, false);
    }
  }, true);

  mapButton.addEventListener('click', async (event) => {
    if (!live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = new FormData();
    form.set('stage', 'map');
    form.set('story', document.getElementById('story').value);
    form.set('outcome', document.getElementById('outcome').value);
    form.set('communication', JSON.stringify(selected('communication')));
    appendFiles(form, 'context', 'context');
    appendFiles(form, 'evidence', 'evidence');
    setBusy(mapButton, true, 'Mapping meaning…');
    mapStatus.textContent = 'The bridge is reading the account and supplied material. Keep this tab open.';
    try {
      const result = await api('/api/bridge', { method: 'POST', body: form });
      document.getElementById('meaning').value = result.text;
      mapStatus.textContent = '';
      window.show(6);
    } catch (errorValue) {
      mapStatus.textContent = errorValue.message;
    } finally {
      setBusy(mapButton, false);
    }
  }, true);

  draftButton.addEventListener('click', async (event) => {
    if (!live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = new FormData();
    form.set('stage', 'draft');
    form.set('confirmedMeaning', document.getElementById('meaning').value);
    form.set('destinations', JSON.stringify(selected('destination')));
    setBusy(draftButton, true, 'Building draft…');
    try {
      const result = await api('/api/bridge', { method: 'POST', body: form });
      document.getElementById('draft-output').value = result.text;
      window.show(8);
    } catch (errorValue) {
      window.alert(errorValue.message);
    } finally {
      setBusy(draftButton, false);
    }
  }, true);

  document.querySelectorAll('.adjust').forEach((button) => {
    button.addEventListener('click', async (event) => {
      if (!live) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const form = new FormData();
      form.set('stage', 'refine');
      form.set('confirmedMeaning', document.getElementById('meaning').value);
      form.set('draft', document.getElementById('draft-output').value);
      form.set('refinement', button.dataset.note || button.textContent);
      setBusy(button, true, 'Working…');
      try {
        const result = await api('/api/bridge', { method: 'POST', body: form });
        document.getElementById('draft-output').value = result.text;
      } catch (errorValue) {
        window.alert(errorValue.message);
      } finally {
        setBusy(button, false);
      }
    }, true);
  });

  connectStatus();
})();