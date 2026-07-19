import bridge from './index.js';

function addPageHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-cache');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), geolocation=(), payment=(), usb=()');
  headers.set(
    'content-security-policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const assetRequest = new Request(new URL('/index.html', request.url), request);
      const asset = await env.ASSETS.fetch(assetRequest);
      const page = new HTMLRewriter()
        .on('body', {
          element(element) {
            element.append('<script src="/bridge-live.js"></script>', { html: true });
          }
        })
        .transform(asset);
      return addPageHeaders(page);
    }
    return bridge.fetch(request, env, ctx);
  }
};
