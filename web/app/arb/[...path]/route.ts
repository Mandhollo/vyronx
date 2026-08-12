import { NextRequest, NextResponse } from 'next/server';

const ARB_ORIGIN = 'http://arb.vyronx.io:3001';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const search = req.nextUrl.search || '';
  const targetUrl = `${ARB_ORIGIN}/${path.join('/')}${search}`;

  try {
    const resp = await fetch(targetUrl, {
      headers: { 'Accept': req.headers.get('accept') || '*/*' },
    });

    const contentType = resp.headers.get('content-type') || '';
    const url = path.join('/');

    // Rewrite webpack runtime JS to change the chunk prefix
    if (contentType.includes('javascript') || url.endsWith('.js')) {
      let js = await resp.text();
      // Change webpack public path from /_next/ to /arb/_next/
      js = js.replace(/=["']\/_next\/["']/g, '="/arb/_next/"');
      // Also fix any hardcoded _next paths in chunks
      js = js.replace(/"\.\/_next\//g, '"./arb/_next/');
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

    // Pass through all other content (CSS, images, fonts)
    const body = await resp.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        'content-type': contentType,
        'cache-control': resp.headers.get('cache-control') || 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Arbitrage server unavailable', { status: 502 });
  }
}
