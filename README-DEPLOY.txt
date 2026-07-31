Tiny Tiffin Premium Branding Fix

Replace these files in the GitHub repository root:
- app.js
- manifest.json
- sw.js
- icon-192.png
- icon-512.png
- apple-touch-icon.png

IMPORTANT: Your index.html should already contain:
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">

After Vercel deploys:
1. Open the website in Chrome.
2. Refresh once.
3. If the old installed icon remains, uninstall Tiny Tiffin from the phone.
4. Open the website again and install it again.

This package removes the front-page QR block, adds a premium logo inside the app, makes Amazon/Amazon Fresh cards compact, and updates PWA icons.
