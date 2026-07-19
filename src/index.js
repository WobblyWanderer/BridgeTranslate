import { BRIDGE_SYSTEM_CONTEXT } from './bridge-context.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function secureHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), geolocation=(), payment=(), usb=()');
  headers.set(
    'content-security-policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"
  );
  if (pathname === '/' || pathname.endsWith('.html')) {
    headers.set('cache-control', 'no-cache');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function readString(form, name) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function readJsonArray(form, name) {
  const raw = readString(form, name);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(a || '');
  const right = new TextEncoder().encode(b || '');
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}

function accessAllowed(code, env) {
  if (!env.BRIDGE_ACCESS_CODE) return false;
  return constantTimeEqual(code, env.BRIDGE_ACCESS_CODE);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function isImage(file) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

async function filePart(file, role) {
  const base64 = arrayBufferToBase64(await file.arrayBuffer());
  if (isImage(file)) {
    return {
      type: 'input_image',
      image_url: `data:${file.type || 'application/octet-stream'};base64,${base64}`,
      detail: 'auto'
    };
  }
  return {
    type: 'input_file',
    filename: `[${role}] ${file.name}`,
    file_data: base64
  };
}

async function collectFiles(form, fieldName, role) {
  const values = form.getAll(fieldName);
  const parts = [];
  for (const value of values) {
    if (value instanceof File && value.size > 0) {
      parts.push(await filePart(value, role));
    }
  }
  return parts;
}

function mapPrompt({ story, outcome, communication, contextNames, evidenceNames }) {
  return `
STAGE: MAP

USER COMMUNICATION SUPPORT
${communication.length ? communication.map((item) => `- ${item}`).join('\n') : '- No options selected. Do not infer a diagnosis.'}

USER'S NATURAL ACCOUNT
${story || '[No written account supplied. Use the uploaded material and ask concise written questions where needed.]'}

WANTED OUTCOME
${outcome || '[Not specified.]'}

FILES LABELLED AS COMMUNICATION CONTEXT / ABOUT ME
${contextNames.length ? contextNames.map((name) => `- ${name}`).join('\n') : '- None supplied.'}

FILES LABELLED AS DOCUMENTS ABOUT WHAT HAPPENED
${evidenceNames.length ? evidenceNames.map((name) => `- ${name}`).join('\n') : '- None supplied.'}

Create the mandatory meaning map. Keep communication context, the user's account, documentary evidence, conflict, inference and uncertainty in separate lanes. Refer to source filenames. End with the written question: “Is this what you are trying to say or describe?”
`.trim();
}

function draftPrompt({ confirmedMeaning, destinations }) {
  return `
STAGE: DRAFT

CONFIRMED MEANING MAP
${confirmedMeaning}

REQUESTED DESTINATION OR OUTPUT
${destinations.length ? destinations.map((item) => `- ${item}`).join('\n') : '- Suggest the most useful format.'}

Translate the confirmed meaning into the selected destination format or formats. Preserve the confirmed meaning, voice, boundaries, evidence lanes and requested outcome. When several outputs are selected, separate them with clear headings.
`.trim();
}

function refinePrompt({ confirmedMeaning, draft, refinement }) {
  return `
STAGE: REFINE

CONFIRMED MEANING MAP
${confirmedMeaning}

CURRENT DRAFT
${draft}

USER'S REQUESTED CHANGE
${refinement}

Apply the change without altering the confirmed meaning, weakening the user's position or adding unsupported information. Return the complete revised draft.
`.trim();
}

function extractOutputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text.trim();
  const pieces = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        pieces.push(content.text);
      }
    }
  }
  return pieces.join('\n').trim();
}

async function callOpenAI(env, content) {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, status: 503, error: 'The AI connection has not been configured yet.' };
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: BRIDGE_SYSTEM_CONTEXT,
      input: [{ role: 'user', content }],
      store: false
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = payload?.error?.message || `The AI provider returned HTTP ${response.status}.`;
    return { ok: false, status: 502, error: providerMessage };
  }

  const text = extractOutputText(payload);
  if (!text) {
    return { ok: false, status: 502, error: 'The AI provider returned no usable text.' };
  }
  return { ok: true, text };
}

async function handleAccess(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const body = await request.json().catch(() => ({}));
  if (!accessAllowed(String(body.code || ''), env)) {
    return json({ error: 'That invitation code was not accepted.' }, 401);
  }
  return json({ ok: true });
}

async function handleBridge(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const form = await request.formData();
  const code = readString(form, 'code');
  if (!accessAllowed(code, env)) {
    return json({ error: 'That invitation code was not accepted.' }, 401);
  }

  const stage = readString(form, 'stage');
  const story = readString(form, 'story');
  const outcome = readString(form, 'outcome');
  const confirmedMeaning = readString(form, 'confirmedMeaning');
  const draft = readString(form, 'draft');
  const refinement = readString(form, 'refinement');
  const communication = readJsonArray(form, 'communication');
  const destinations = readJsonArray(form, 'destinations');

  let textPrompt = '';
  let content = [];

  if (stage === 'map') {
    const contextValues = form.getAll('context').filter((value) => value instanceof File && value.size > 0);
    const evidenceValues = form.getAll('evidence').filter((value) => value instanceof File && value.size > 0);
    textPrompt = mapPrompt({
      story,
      outcome,
      communication,
      contextNames: contextValues.map((file) => file.name),
      evidenceNames: evidenceValues.map((file) => file.name)
    });
    content = [
      { type: 'input_text', text: textPrompt },
      ...(await collectFiles(form, 'context', 'COMMUNICATION CONTEXT')),
      ...(await collectFiles(form, 'evidence', 'DOCUMENTARY EVIDENCE'))
    ];
  } else if (stage === 'draft') {
    if (!confirmedMeaning) return json({ error: 'Confirm or edit the meaning map first.' }, 400);
    textPrompt = draftPrompt({ confirmedMeaning, destinations });
    content = [{ type: 'input_text', text: textPrompt }];
  } else if (stage === 'refine') {
    if (!confirmedMeaning || !draft || !refinement) {
      return json({ error: 'A confirmed meaning map, current draft and requested change are required.' }, 400);
    }
    textPrompt = refinePrompt({ confirmedMeaning, draft, refinement });
    content = [{ type: 'input_text', text: textPrompt }];
  } else {
    return json({ error: 'Unknown bridge stage.' }, 400);
  }

  const result = await callOpenAI(env, content);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, stage, text: result.text });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/status') {
        return json({
          ok: true,
          accessConfigured: Boolean(env.BRIDGE_ACCESS_CODE),
          aiConfigured: Boolean(env.OPENAI_API_KEY),
          model: env.OPENAI_MODEL || 'gpt-5-mini'
        });
      }
      if (url.pathname === '/api/access') return await handleAccess(request, env);
      if (url.pathname === '/api/bridge') return await handleBridge(request, env);
      const asset = await env.ASSETS.fetch(request);
      return secureHeaders(asset, url.pathname);
    } catch (error) {
      return json({ error: 'The bridge could not complete this request. No document content was intentionally saved by the application.', detail: error?.message || 'Unknown error' }, 500);
    }
  }
};
