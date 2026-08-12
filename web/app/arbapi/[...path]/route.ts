import { NextRequest, NextResponse } from 'next/server';

const ARB_API = 'http://arb.vyronx.io:8000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const search = req.nextUrl.search || '';
  const targetUrl = `${ARB_API}/${path.join('/')}${search}`;

  try {
    const resp = await fetch(targetUrl, {
      headers: { 'Accept': req.headers.get('accept') || '*/*' },
    });

    const body = await resp.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        'content-type': resp.headers.get('content-type') || 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'no-cache',
      },
    });
  } catch {
    return new NextResponse(JSON.stringify({ error: 'Arbitrage API unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const search = req.nextUrl.search || '';
  const targetUrl = `${ARB_API}/${path.join('/')}${search}`;

  try {
    const body = await req.text();
    const resp = await fetch(targetUrl, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': req.headers.get('content-type') || 'application/json',
        'Accept': req.headers.get('accept') || '*/*',
      },
    });

    const respBody = await resp.arrayBuffer();
    return new NextResponse(respBody, {
      status: resp.status,
      headers: {
        'content-type': resp.headers.get('content-type') || 'application/json',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return new NextResponse(JSON.stringify({ error: 'Arbitrage API unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }
}
