@echo off
echo === where bubblewrap ===
where bubblewrap
echo === explicit path ===
if exist "%AppData%\npm\bubblewrap.cmd" echo FOUND: "%AppData%\npm\bubblewrap.cmd"
echo.
echo === try doctor ===
if exist "%AppData%\npm\bubblewrap.cmd" (
  "%AppData%\npm\bubblewrap.cmd" doctor
) else (
  bubblewrap doctor
)
echo.
pause
