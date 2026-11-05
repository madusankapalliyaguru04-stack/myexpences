# My Expenses

A simple offline-first expense manager (HTML, CSS, vanilla JavaScript). No backend:
data is stored on your device (localStorage) and works fully offline as an installable app (PWA).

Features
- Two separate accounts (default: Cash and Bank, renameable in Settings). Home, History,
  Summary and Add all work on the selected account only.
- Income / expense tracking with custom categories
- Monthly and date-range summaries with category breakdown
- Light / dark theme
- Backup and restore (JSON), month-end notifications

Files
- index.html  app shell
- styles.css  styles
- app.js      app logic
- core.js     helpers shared with the service worker
- sw.js       offline cache + notifications
