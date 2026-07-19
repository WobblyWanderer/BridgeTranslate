import bridge from './index.js';

function addPageHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-cache');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), geolocation=(), payment=(), usb=()');
  headers.set('content-security-policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const email = (request.headers.get('cf-access-authenticated-user-email') || '').trim();
      if (!email) {
        return json({ error: 'Cloudflare Access authentication is required.' }, 401);
      }
    }

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
