# build_and_push.ps1
# Snackbook: Build + Deploy zu Netlify (Production, ohne Git-Remote)

Write-Host "==> Tailwind/Assets bauen..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Build fehlgeschlagen." -ForegroundColor Red
  exit 1
}

# optional: Versionsbump für den Service Worker/Manifest nicht vergessen!
# (im Code per ?v=... schon angepasst)

Write-Host "==> Deploy zu Netlify (Production)..." -ForegroundColor Cyan
# explizit das 'public' Verzeichnis deployen (publish-dir)
netlify deploy --prod --dir=public

if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Deploy erfolgreich!" -ForegroundColor Green
} else {
  Write-Host "❌ Deploy fehlgeschlagen." -ForegroundColor Red
  exit 1
}
