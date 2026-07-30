TINY TIFFIN PREMIUM BRANDING UPDATE

Upload/replace all files in this package in the root of your GitHub repository.

Files included:
- app.js: QR removed from front-page header; Amazon cards made compact
- premium-ui-patch.css: compact Amazon/Amazon Fresh styling and QR hiding
- icon-192.png, icon-512.png, apple-touch-icon.png, favicon.png: premium app icons
- manifest.json: updated PWA icon references

IMPORTANT: Your current index.html must load premium-ui-patch.css. Follow index.html-update.txt.

After Vercel deploys, refresh once. If the installed app still shows the old icon, uninstall the old Tiny Tiffin shortcut/app and install it again; mobile launchers can cache PWA icons.
