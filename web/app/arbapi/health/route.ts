import { NextRequest, NextResponse } from 'next/server';

const ARB_API = 'http://arb.vyronx.io:8000';

export async function GET(req: NextRequest) {
  try {
    const resp = await fetch(`${ARB_API}/health`);
    const body = await resp.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        'content-type': resp.headers.get('content-type') || 'application/json',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return new NextResponse(JSON.stringify({ status: 'offline' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }
}
