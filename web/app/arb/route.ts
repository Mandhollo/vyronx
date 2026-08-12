import { NextRequest, NextResponse } from 'next/server';

const ARB_ORIGIN = 'http://arb.vyronx.io:3001';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || '';
  const targetUrl = `${ARB_ORIGIN}/${search}`;

  try {
    const resp = await fetch(targetUrl, {
      headers: { 'Accept': req.headers.get('accept') || '*/*' },
    });

    let html = await resp.text();
    // Rewrite absolute asset paths to route through our proxy
    html = html.replace(/href="\/_next\//g, 'href="/arb/_next/');
    html = html.replace(/src="\/_next\//g, 'src="/arb/_next/');

    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new NextResponse('Arbitrage server unavailable', { status: 502 });
  }
}
