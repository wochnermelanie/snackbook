@echo off
setlocal

REM Quellordner (hier liegen die APK/AAB nach dem Build)
set SRC=C:\Users\admin\snackbook\snackbook

REM Zielordner (OneDrive Ordner)
set DEST=C:\Users\admin\OneDrive - Personal\APP

echo Kopiere Build-Dateien nach OneDrive...

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

echo Fertig!
pause
