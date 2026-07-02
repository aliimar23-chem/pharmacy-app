PHARMACY INVENTORY APP - APK CONVERSION INSTRUCTIONS

IMPORTANT:
PWA-to-APK converters normally need a public HTTPS website URL.
Do NOT upload only index.html.
Do NOT paste the local file path from your computer/phone.
You must upload the whole folder contents to web hosting first, then give the converter the website URL.

FILES/FOLDERS TO UPLOAD TO HOSTING:
- index.html
- style.css
- script.js
- manifest.json
- service-worker.js
- icons/ folder, including icon-192.png and icon-512.png

RECOMMENDED FLOW:
1. Unzip this package.
2. Upload all files/folders inside pharmacy_pwa_ready to a hosting service.
   Examples: Netlify, Vercel, GitHub Pages, Firebase Hosting, or any cPanel/shared hosting.
3. Open the hosted URL on Android Chrome and check that the app loads.
4. Use a PWA-to-APK converter and paste the hosted URL.
5. Download the generated APK and install it on Android.

CONVERTER LINKS:
- PWABuilder: https://www.pwabuilder.com/
- PWA2APK: https://pwa2apk.com/

NOTES:
- Camera scanning usually requires HTTPS hosting.
- Local file:// opening will not enable service worker/PWA installation.
- The inventory data is stored locally on each device browser/app. It is not shared between family phones unless a cloud database is added later.
