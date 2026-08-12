import { NextRequest, NextResponse } from 'next/server';

const ARB_ORIGIN = 'http://arb.vyronx.io:3001';
const ARB_API = 'http://arb.vyronx.io:8000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const search = req.nextUrl.search || '';

  const pathStr = path.join('/');
  const isApi = pathStr.startsWith('api/') || pathStr.startsWith('health');
  const origin = isApi ? ARB_API : ARB_ORIGIN;
  const targetUrl = `${origin}/${pathStr}${search}`;

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'Accept': req.headers.get('accept') || '*/*',
        'Origin': ARB_ORIGIN,
      },
    });

    const contentType = resp.headers.get('content-type') || '';

    // Rewrite JavaScript
    if (contentType.includes('javascript') || pathStr.endsWith('.js')) {
      let js = await resp.text();

      // 1. Change webpack public path
      js = js.replace(/=["']\/_next\/["']/g, '="/arb/_next/"');

      // 2. Replace API base URL: let d="http://2.25.102.234:8000"
      js = js.replace(/let d="http:\/\/2\.25\.102\.234:8000"/g, 'let d="/arbapi"');

      // 3. Replace any remaining hardcoded URLs
      js = js.replace(/http:\/\/2\.25\.102\.234:8000/g, '/arbapi');
      js = js.replace(/http:\/\/2\.25\.102\.234:3001/g, '/arb');

      // 4. Replace WebSocket with polling-based mock (Vercel can't proxy WS)
      js = js.replace(
        /new WebSocket\("ws:\/\/"\.concat\(([a-zA-Z]),"\/ws"\)\)/g,
        '(function(){var ws={readyState:1,send:function(){},close:function(){}};var poll=function(){fetch("/arbapi/api/market/snapshot").then(function(r){return r.json()}).then(function(data){if(ws.onmessage)ws.onmessage({data:JSON.stringify({type:"snapshot",data:data})})}).catch(function(){})};setTimeout(poll,500);setInterval(poll,3000);setTimeout(function(){if(ws.onopen)ws.onopen()},100);return ws})()'
      );

      // 5. Remove trustedTypes policy creation (breaks in iframes without CSP header)
      // Original: f.tt=function(){return void 0===r&&(r={createScriptURL:function(e){return e}},"undefined"!=typeof trustedTypes&&trustedTypes.createPolicy&&(r=trustedTypes.createPolicy("nextjs#bundler",r))),r}
      js = js.replace(
        /f\.tt=function\(\)\{return void 0===r&&\(r=\{createScriptURL:function\(e\)\{return e\}\},"undefined"!=typeof trustedTypes&&trustedTypes\.createPolicy&&\(r=trustedTypes\.createPolicy\("nextjs#bundler",r\)\)\),r\}/g,
        'f.tt=function(){return{createScriptURL:function(e){return e}}}'
      );

      return new NextResponse(js, {
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    // Rewrite HTML
    if (contentType.includes('text/html')) {
      let html = await resp.text();
      html = html.replace(/\/_next\//g, '/arb/_next/');
      return new NextResponse(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // Pass through everything else
    const body = await resp.arrayBuffer();
    const headers: Record<string, string> = {
      'content-type': contentType,
      'cache-control': resp.headers.get('cache-control') || 'no-cache',
    };
    if (isApi) {
      headers['access-control-allow-origin'] = '*';
    }
    return new NextResponse(body, { headers });
  } catch {
    return new NextResponse('Arbitrage server unavailable', { status: 502 });
  }
}
