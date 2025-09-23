@echo on
setlocal EnableExtensions

REM === Pfade ===
set "SRC=C:\Users\admin\snackbook"
REM Nimmt den echten OneDrive-Pfad aus deiner Umgebung (z.B. "C:\Users\admin\OneDrive - Personal")
set "DEST=%OneDrive%\APP"

echo ============================================================
echo Snackbook Build gestartet: %DATE% %TIME%
echo SRC  = %SRC%
echo DEST = %DEST%
echo ============================================================

REM Zielordner anlegen (falls nicht vorhanden)
if not exist "%DEST%" mkdir "%DEST%" || (echo [!] Konnte "%DEST%" nicht anlegen & pause & exit /b 1)

REM Ins Projekt wechseln
cd /d "%SRC%" || (echo [!] SRC nicht gefunden & pause & exit /b 1)

echo === Artefakte vor Build ===
dir /-C /O:-D /TW "%SRC%\app-release-*.a*" 2>nul
echo.
echo === bubblewrap doctor ===
call bubblewrap doctor
pause

echo === bubblewrap build (kann etwas dauern) ===
call bubblewrap build
echo ERRORLEVEL=%ERRORLEVEL%
if errorlevel 1 (echo [!] Build fehlgeschlagen & pause & exit /b 1)
pause

echo === Artefakte nach Build ===
dir /-C /O:-D /TW "%SRC%\app-release-*.a*" 2>nul
echo.

set "APK=%SRC%\app-release-signed.apk"
set "AAB=%SRC%\app-release-bundle.aab"

if exist "%APK%" (
  echo - Kopiere APK nach "%DEST%\Snackbook.apk"
  copy /Y "%APK%" "%DEST%\Snackbook.apk"
) else (
  echo - APK NICHT gefunden!
)

if exist "%AAB%" (
  echo - Kopiere AAB nach "%DEST%\Snackbook.aab"
  copy /Y "%AAB%" "%DEST%\Snackbook.aab"
) else (
  echo - AAB NICHT gefunden!
)

echo.
echo === Dateien im Zielordner ===
dir /-C /O:-D /TW "%DEST%\Snackbook.*" 2>nul
echo ============================================================
echo FERTIG.
echo ============================================================
pause
