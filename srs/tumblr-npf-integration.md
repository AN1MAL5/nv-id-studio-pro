# Tumblr NPF integration notes (NV ID Studio Pro)

This repo currently is a Vite + React single-page app. Tumblr NPF themes cannot directly compile/run your React bundle inside the theme runtime.

The reliable approach is to deploy the Vite app somewhere public (e.g., Netlify/Vercel/GitHub Pages) and embed it via an **iframe** from Tumblr.

## Steps

1. **Deploy the app**
   - Build: `npm run build`
   - Host: Netlify / Vercel / any static host

2. **Check embedding permissions**
   - Ensure your hosting does not block iframes:
     - Avoid `X-Frame-Options: DENY/SAMEORIGIN`
     - Ensure CSP frame-ancestors allows Tumblr

3. **Use the iframe snippet**
   - Update `https://YOUR-DEPLOYED-APP/` in `srs/tumblr-npf-template.html`

4. **Paste into Tumblr theme**
   - Follow Tumblr’s NPF docs for the place you can render custom HTML.

## Files added in this commit
- `srs/tumblr-npf-template.html` (iframe-based embed template)
- `srs/tumblr-npf-integration.md` (how-to guide)

