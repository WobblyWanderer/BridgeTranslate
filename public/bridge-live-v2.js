(() => {
  const notice = document.querySelector('.notice');
  const accessButton = document.getElementById('access');
  const mapButton = document.getElementById('map');
  const draftButton = document.getElementById('draft');
  const wordButton = document.getElementById('word');
  const mapStatus = document.getElementById('map-status');
  const codeInput = document.getElementById('code');
  const codeLabel = document.querySelector('label[for="code"]');
  const codeError = document.getElementById('code-error');
  const accessStep = document.querySelector('[data-step="2"]');
  const MAX_FILES = 10;
  let live = false;

  codeInput.value = 'cloudflare-access';
  codeInput.hidden = true;
  if (codeLabel) codeLabel.hidden = true;
  if (codeError) codeError.hidden = true;

  if (accessStep) {
    const eyebrow = accessStep.querySelector('.eyebrow');
    const heading = accessStep.querySelector('h2');
    const paragraph = accessStep.querySelector('h2 + p');
    if (eyebrow) eyebrow.textContent = 'Pilot access';
    if (heading) heading.textContent = 'Continue to BridgeTranslate';
    if (paragraph) paragraph.textContent = 'Your invitation is checked by Cloudflare before this page loads. This proof of concept allows five finished products per approved user.';
  }

  accessButton.textContent = 'I understand, continue';

  const uploadHeading = document.querySelector('[data-step="4"] h2');
  if (uploadHeading) {
    const uploadIntro = uploadHeading.nextElementSibling;
    if (uploadIntro) uploadIntro.textContent = 'You can add up to 10 documents across both upload boxes. Context and evidence stay in separate lanes.';
  }

  if (wordButton) wordButton.textContent = '📘 Download Word document (.docx)';

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

  function quotaText(status) {
    if (!status.usageConfigured) return 'The five-product pilot counter still needs its Cloudflare KV binding.';
    if (!status.identityConfirmed) return 'Cloudflare Access is not supplying a confirmed user identity yet.';
    return `${status.documentsRemaining} of ${status.documentsLimit} finished products remain for this pilot invitation.`;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), accept: 'application/json' }
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.blob();
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function selected(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }

  function allSelectedFiles() {
    return ['context', 'evidence'].flatMap((id) => [...(document.getElementById(id).files || [])]);
  }

  function validateFiles() {
    const files = allSelectedFiles();
    if (files.length > MAX_FILES) return `Choose no more than ${MAX_FILES} documents across both upload boxes.`;
    return '';
  }

  function appendFiles(form, fieldName, inputId) {
    const input = document.getElementById(inputId);
    for (const file of input.files || []) form.append(fieldName, file, file.name);
  }

  async function connectStatus() {
    try {
      const status = await api('/api/status');
      live = Boolean(status.aiConfigured && status.usageConfigured && status.identityConfirmed);
      if (live) {
        notice.innerHTML = `<strong>Proof of concept:</strong> BridgeTranslate demonstrates that any organisation could adopt this method, or one like it, to make its processes accessible. Service users should not have to build translation aids to access basic services. ${quotaText(status)}`;
      } else if (!status.aiConfigured) {
        notice.innerHTML = '<strong>Setup incomplete:</strong> the interface is available, but the AI secret has not been connected.';
      } else {
        notice.innerHTML = `<strong>Setup incomplete:</strong> ${quotaText(status)}`;
      }
    } catch {
      live = false;
      notice.innerHTML = '<strong>Setup incomplete:</strong> the bridge could not confirm its protected AI connection.';
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
      await api('/api/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acknowledged: true }) });
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
    const fileError = validateFiles();
    if (fileError) {
      mapStatus.textContent = fileError;
      return;
    }
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
    setBusy(draftButton, true, 'Building finished product…');
    try {
      const result = await api('/api/bridge', { method: 'POST', body: form });
      document.getElementById('draft-output').value = result.text;
      const status = document.getElementById('status');
      if (status && Number.isFinite(result.documentsRemaining)) status.textContent = `${result.documentsRemaining} of ${result.documentsLimit} finished products remain.`;
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

  if (wordButton) {
    wordButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = document.getElementById('status');
      const text = document.getElementById('draft-output').value;
      setBusy(wordButton, true, 'Building Word document…');
      try {
        const blob = await api('/api/document', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'BridgeTranslate document', text })
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bridge-translation.docx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = 'Word document downloaded.';
      } catch (errorValue) {
        status.textContent = errorValue.message;
      } finally {
        setBusy(wordButton, false);
      }
    }, true);
  }

  connectStatus();
})();