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

    // Rewrite HTML to fix asset paths
    if (contentType.includes('text/html')) {
      let html = await resp.text();
      // Replace absolute asset paths to route through our proxy
      html = html.replace(/href="\/_next\//g, 'href="/arb/_next/');
      html = html.replace(/src="\/_next\//g, 'src="/arb/_next/');
      html = html.replace(/href="\/([^"]+)"/g, (m, p1) => {
        if (p1.startsWith('_next') || p1.startsWith('/')) return m;
        return `href="/arb/${p1}"`;
      });
      return new NextResponse(html, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      });
    }

    // Pass through all other content (JS, CSS, images, fonts)
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
