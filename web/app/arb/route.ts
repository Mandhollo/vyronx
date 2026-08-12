import { NextRequest, NextResponse } from 'next/server';

const ARB_ORIGIN = 'http://arb.vyronx.io:3001';

export async function GET(req: NextRequest) {
  try {
    const resp = await fetch(ARB_ORIGIN, {
      headers: { 'Accept': 'text/html' },
    });

    let html = await resp.text();

    // Rewrite all asset paths from /_next/ to /arb/_next/
    html = html.replace(/\/_next\//g, '/arb/_next/');

    // Inject a script to fix webpack chunk loading at runtime
    const fixScript = `<script>(function(){
      // Override webpack chunk loading to use /arb/ prefix
      var origCreateElement = document.createElement;
      var origFetch = window.fetch;

      // Intercept dynamic script loads
      var scriptProxy = new Proxy(document.createElement.bind(document), {
        apply: function(target, thisArg, args) {
          var el = target.apply(thisArg, args);
          if (args[0] === 'script') {
            var origSetAttribute = el.setAttribute.bind(el);
            el.setAttribute = function(name, value) {
              if (name === 'src' && value && value.indexOf('/_next/') === 0 && value.indexOf('/arb/') !== 0) {
                value = '/arb' + value;
              }
              return origSetAttribute(name, value);
            };
          }
          return el;
        }
      });
      document.createElement = scriptProxy;

      // Intercept fetch calls for _next chunks
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url);
        if (url && url.indexOf('/_next/') === 0 && url.indexOf('/arb/') !== 0) {
          if (typeof input === 'string') input = '/arb' + input;
          else if (input && input.url) input.url = '/arb' + input.url;
        }
        return origFetch.call(this, input, init);
      };
    })();</script>`;

    // Inject right after <head>
    html = html.replace('<head>', '<head>' + fixScript);

    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new NextResponse('Arbitrage server unavailable', { status: 502 });
  }
}
