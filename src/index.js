import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { BRIDGE_SYSTEM_CONTEXT } from './bridge-context.js';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS_PER_USER = 5;
const DEFAULT_AI_MODEL = 'openai/gpt-5.6-terra';

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
  headers.set('content-security-policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'");
  if (pathname === '/' || pathname.endsWith('.html')) headers.set('cache-control', 'no-cache');
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

function authenticatedEmail(request) {
  return (request.headers.get('cf-access-authenticated-user-email') || '').trim().toLowerCase();
}

function usageKey(email) {
  return `documents:${email}`;
}

async function readUsage(env, email) {
  if (!env.USAGE_KV || !email) return null;
  const raw = await env.USAGE_KV.get(usageKey(email));
  const count = Number.parseInt(raw || '0', 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function usageStatus(request, env) {
  const email = authenticatedEmail(request);
  const used = await readUsage(env, email);
  return {
    usageConfigured: Boolean(env.USAGE_KV),
    identityConfirmed: Boolean(email),
    documentsUsed: used,
    documentsLimit: MAX_DOCUMENTS_PER_USER,
    documentsRemaining: used === null ? null : Math.max(0, MAX_DOCUMENTS_PER_USER - used)
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}

function isImage(file) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

async function filePart(file, role) {
  const base64 = arrayBufferToBase64(await file.arrayBuffer());
  if (isImage(file)) return { type: 'input_image', image_url: `data:${file.type || 'application/octet-stream'};base64,${base64}`, detail: 'auto' };
  return { type: 'input_file', filename: `[${role}] ${file.name}`, file_data: base64 };
}

async function collectFiles(form, fieldName, role) {
  const values = form.getAll(fieldName);
  const parts = [];
  for (const value of values) {
    if (value instanceof File && value.size > 0) parts.push(await filePart(value, role));
  }
  return parts;
}

function validateUploads(form) {
  const files = ['context', 'evidence'].flatMap((field) => form.getAll(field)).filter((value) => value instanceof File && value.size > 0);
  if (files.length > MAX_FILES) return `This pilot accepts a maximum of ${MAX_FILES} files in one packet.`;
  const oversized = files.find((file) => file.size > MAX_FILE_BYTES);
  if (oversized) return `${oversized.name} is larger than the 8 MB individual-file limit.`;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) return 'The selected files are larger than the 20 MB combined-upload limit.';
  return '';
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
      if (content.type === 'output_text' && typeof content.text === 'string') pieces.push(content.text);
    }
  }
  return pieces.join('\n').trim();
}

async function callAI(env, content) {
  if (!env.AI) {
    return { ok: false, status: 503, error: 'The Cloudflare AI binding has not been configured yet.' };
  }

  const model = env.AI_MODEL || DEFAULT_AI_MODEL;

  try {
    const payload = await env.AI.run(model, {
      instructions: BRIDGE_SYSTEM_CONTEXT,
      input: [{ role: 'user', content }],
      max_output_tokens: 6000
    });

    const text = extractOutputText(payload);
    if (!text) return { ok: false, status: 502, error: 'The AI model returned no usable text.' };
    return { ok: true, text, model };
  } catch (error) {
    return { ok: false, status: 502, error: error?.message || 'The Cloudflare AI request failed.' };
  }
}

async function handleAccess(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  return json({ ok: true });
}

async function handleBridge(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const email = authenticatedEmail(request);
  if (!email) return json({ error: 'Your Cloudflare Access identity could not be confirmed.' }, 401);

  const form = await request.formData();
  const stage = readString(form, 'stage');
  const story = readString(form, 'story');
  const outcome = readString(form, 'outcome');
  const confirmedMeaning = readString(form, 'confirmedMeaning');
  const draft = readString(form, 'draft');
  const refinement = readString(form, 'refinement');
  const communication = readJsonArray(form, 'communication');
  const destinations = readJsonArray(form, 'destinations');
  const usageConfigured = Boolean(env.USAGE_KV);
  const documentsUsed = (await readUsage(env, email)) ?? 0;

  if (usageConfigured && stage === 'draft' && documentsUsed >= MAX_DOCUMENTS_PER_USER) {
    return json({ error: 'This proof-of-concept invitation has already produced its five documents.', documentsUsed, documentsLimit: MAX_DOCUMENTS_PER_USER, documentsRemaining: 0 }, 429);
  }

  let content = [];
  if (stage === 'map') {
    const uploadError = validateUploads(form);
    if (uploadError) return json({ error: uploadError }, 400);
    const contextValues = form.getAll('context').filter((value) => value instanceof File && value.size > 0);
    const evidenceValues = form.getAll('evidence').filter((value) => value instanceof File && value.size > 0);
    content = [
      { type: 'input_text', text: mapPrompt({ story, outcome, communication, contextNames: contextValues.map((file) => file.name), evidenceNames: evidenceValues.map((file) => file.name) }) },
      ...(await collectFiles(form, 'context', 'COMMUNICATION CONTEXT')),
      ...(await collectFiles(form, 'evidence', 'DOCUMENTARY EVIDENCE'))
    ];
  } else if (stage === 'draft') {
    if (!confirmedMeaning) return json({ error: 'Confirm or edit the meaning map first.' }, 400);
    content = [{ type: 'input_text', text: draftPrompt({ confirmedMeaning, destinations }) }];
  } else if (stage === 'refine') {
    if (!confirmedMeaning || !draft || !refinement) return json({ error: 'A confirmed meaning map, current draft and requested change are required.' }, 400);
    content = [{ type: 'input_text', text: refinePrompt({ confirmedMeaning, draft, refinement }) }];
  } else {
    return json({ error: 'Unknown bridge stage.' }, 400);
  }

  const result = await callAI(env, content);
  if (!result.ok) return json({ error: result.error }, result.status);

  let updatedDocumentsUsed = usageConfigured ? documentsUsed : null;
  if (usageConfigured && stage === 'draft') {
    updatedDocumentsUsed += 1;
    await env.USAGE_KV.put(usageKey(email), String(updatedDocumentsUsed));
  }

  return json({
    ok: true,
    stage,
    text: result.text,
    model: result.model,
    usageConfigured,
    documentsUsed: updatedDocumentsUsed,
    documentsLimit: MAX_DOCUMENTS_PER_USER,
    documentsRemaining: updatedDocumentsUsed === null ? null : Math.max(0, MAX_DOCUMENTS_PER_USER - updatedDocumentsUsed)
  });
}

function docxParagraphs(text) {
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return new Paragraph({ text: '' });
    const isHeading = trimmed.length <= 90 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
    if (isHeading) return new Paragraph({ text: trimmed, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
    return new Paragraph({ children: [new TextRun(trimmed)], spacing: { after: 120 } });
  });
}

async function handleDocument(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const payload = await request.json().catch(() => ({}));
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim().slice(0, 120) : 'BridgeTranslate document';
  if (!text) return json({ error: 'There is no completed draft to download.' }, 400);
  if (text.length > 250000) return json({ error: 'The completed document is too large to export in this pilot.' }, 400);
  const document = new Document({
    creator: 'BridgeTranslate',
    title,
    description: 'A user-reviewed communication document produced through BridgeTranslate.',
    sections: [{ properties: {}, children: [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 300 } }),
      ...docxParagraphs(text),
      new Paragraph({ children: [new TextRun({ text: 'Produced with BridgeTranslate. Review before sending.', italics: true })], spacing: { before: 360 } })
    ] }]
  });
  const buffer = await Packer.toBuffer(document);
  return new Response(buffer, { headers: {
    'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'content-disposition': 'attachment; filename="bridge-translation.docx"',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/status') return json({
        ok: true,
        openAccess: false,
        accessConfigured: Boolean(authenticatedEmail(request)),
        aiConfigured: Boolean(env.AI),
        model: env.AI_MODEL || DEFAULT_AI_MODEL,
        limits: { maxFiles: MAX_FILES, maxIndividualMB: 8, maxCombinedMB: 20, maxDocuments: MAX_DOCUMENTS_PER_USER },
        ...(await usageStatus(request, env))
      });
      if (url.pathname === '/api/access') return await handleAccess(request);
      if (url.pathname === '/api/bridge') return await handleBridge(request, env);
      if (url.pathname === '/api/document') return await handleDocument(request);
      const asset = await env.ASSETS.fetch(request);
      return secureHeaders(asset, url.pathname);
    } catch (error) {
      return json({ error: 'The bridge could not complete this request.', detail: error?.message || 'Unknown error' }, 500);
    }
  }
};
