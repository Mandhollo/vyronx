import { NextRequest, NextResponse } from 'next/server';

const ARB_ORIGIN = 'http://arb.vyronx.io:3001';
const ARB_API = 'http://arb.vyronx.io:8000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const search = req.nextUrl.search || '';

  // Route API calls to port 8000, everything else to port 3001
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

    // Rewrite webpack runtime JS to change the chunk prefix
    if (contentType.includes('javascript') || pathStr.endsWith('.js')) {
      let js = await resp.text();
      // Change webpack public path from /_next/ to /arb/_next/
      js = js.replace(/=["']\/_next\/["']/g, '="/arb/_next/"');
      // CRITICAL: Replace hardcoded API URL from IP:8000 to our proxy
      js = js.replace(/http:\/\/2\.25\.102\.234:8000/g, '/arbapi');
      js = js.replace(/http:\/\/2\.25\.102\.234:3001/g, '/arb');
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

    // Pass through JSON API responses and other content
    const body = await resp.arrayBuffer();
    const headers: Record<string, string> = {
      'content-type': contentType,
      'cache-control': resp.headers.get('cache-control') || 'no-cache',
    };
    // Add CORS headers for API responses
    if (isApi) {
      headers['access-control-allow-origin'] = '*';
    }
    return new NextResponse(body, { headers });
  } catch {
    return new NextResponse('Arbitrage server unavailable', { status: 502 });
  }
}
