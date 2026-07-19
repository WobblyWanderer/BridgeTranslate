(() => {
  const notice = document.querySelector('.notice');
  const accessButton = document.getElementById('access');
  const mapButton = document.getElementById('map');
  const draftButton = document.getElementById('draft');
  const mapStatus = document.getElementById('map-status');
  let live = false;

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
      live = Boolean(status.accessConfigured && status.aiConfigured);
      if (live) {
        notice.innerHTML = '<strong>Working peer bridge:</strong> the invitation gate and AI translation connection are active. Uploaded content is processed for this job and is not intentionally added to a permanent BridgeTranslate account history.';
      } else {
        notice.innerHTML = '<strong>Interface build:</strong> the crossing is complete, but the secure access secret or AI key has not yet been connected. The page remains a safe clickable demonstration.';
      }
    } catch {
      live = false;
    }
  }

  accessButton.addEventListener('click', async (event) => {
    if (!live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const code = document.getElementById('code');
    const consent = document.getElementById('consent');
    const error = document.getElementById('code-error');
    error.hidden = Boolean(code.value.trim());
    if (!code.value.trim()) return code.focus();
    if (!consent.checked) return consent.focus();
    setBusy(accessButton, true, 'Checking code…');
    try {
      await api('/api/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: code.value.trim() })
      });
      window.show(3);
    } catch (errorValue) {
      error.textContent = errorValue.message;
      error.hidden = false;
      code.focus();
    } finally {
      setBusy(accessButton, false);
    }
  }, true);

  mapButton.addEventListener('click', async (event) => {
    if (!live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = new FormData();
    form.set('code', document.getElementById('code').value.trim());
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
    form.set('code', document.getElementById('code').value.trim());
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
      form.set('code', document.getElementById('code').value.trim());
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
