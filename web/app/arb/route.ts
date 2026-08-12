import { NextRequest, NextResponse } from 'next/server';

const ARB_ORIGIN = 'http://arb.vyronx.io:3001';

function rewriteHtml(html: string): string {
  // Rewrite all asset paths from /_next/ to /arb/_next/
  html = html.replace(/\/_next\//g, '/arb/_next/');
  return html;
}

export async function GET(req: NextRequest) {
  try {
    const resp = await fetch(ARB_ORIGIN, {
      headers: { 'Accept': 'text/html' },
    });

    let html = await resp.text();
    html = rewriteHtml(html);

    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new NextResponse('Arbitrage server unavailable', { status: 502 });
  }
}
