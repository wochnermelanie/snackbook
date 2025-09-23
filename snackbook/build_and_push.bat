@echo off
setlocal

REM Quell- und Zielordner setzen
set SRC=C:\Users\admin\snackbook\snackbook
set DEST=C:\Users\admin\OneDrive - Personal\APP
set BW=bubblewrap

echo ========================================
echo Snackbook Build startet: %date% %time%
echo SRC = %SRC%
echo DEST = %DEST%
echo ========================================

REM Ins Projektverzeichnis wechseln
cd /d "%SRC%"

echo.
echo -> Kurzer Check: bubblewrap doctor ...
%BW% doctor

echo.
echo -> Starte bubblewrap build (kann 1-3 Minuten dauern) ...
%BW% build
if errorlevel 1 (
  echo [!] Build fehlgeschlagen (siehe Ausgabe oben).
  pause
  exit /b 1
)

echo.
echo -> Kopiere Dateien nach OneDrive ...

if exist "%SRC%\app-release-signed.apk" (
    echo - APK gefunden, kopiere...
    copy /Y "%SRC%\app-release-signed.apk" "%DEST%\Snackbook.apk" >nul
) else (
    echo - APK nicht gefunden!
)

if exist "%SRC%\app-release-bundle.aab" (
    echo - AAB gefunden, kopiere...
    copy /Y "%SRC%\app-release-bundle.aab" "%DEST%\Snackbook.aab" >nul
) else (
    echo - AAB nicht gefunden!
)

echo ========================================
echo Fertig! Die Dateien liegen jetzt im OneDrive-Ordner.
echo ========================================
pause
