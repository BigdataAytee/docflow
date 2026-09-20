# Web host response headers

<!-- Generated from src/web/headers.ts by src/web/headers.test.ts.
     Run `npm run headers` to rewrite it. Do not edit by hand. -->

DocFlow carries its whole content security policy inside the built
`index.html`, because the same bundle is served both by a web host and by
Capacitor from the app’s own assets — and a host header can never cover
the second. Two things a `<meta>` policy cannot say have to come from the
host instead:

- **`Content-Security-Policy: frame-ancestors 'none'`** — A meta policy cannot carry frame-ancestors, so without this the app can be framed by any page on the internet.
- **`Strict-Transport-Security: max-age=31536000; includeSubDomains`** — The protection is for the request before the document loads, which no meta tag can reach. No preload: that is a one-way door and the owner’s call.

A browser applies the header and the document policy together, so the
header carries only what the document cannot. Sending the full policy
twice would be two copies free to drift.

## Netlify, Cloudflare Pages

```
Nothing to do — the build writes dist/_headers:

# Generated from src/web/headers.ts — do not edit.
#
# The rest of the content security policy travels inside index.html, so
# it applies under Capacitor too. These are the parts a meta tag cannot
# express; a browser enforces the header and the document policy together.
/*
  Content-Security-Policy: frame-ancestors 'none'
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Vercel (vercel.json, at the repository root)

```
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'none'"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

## nginx (inside the server block)

```
add_header Content-Security-Policy "frame-ancestors 'none'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Caddy (inside the site block)

```
header {
  Content-Security-Policy "frame-ancestors 'none'"
  Strict-Transport-Security "max-age=31536000; includeSubDomains"
}
```

## Apache (.htaccess or the vhost)

```
Header always set Content-Security-Policy "frame-ancestors 'none'"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
```
