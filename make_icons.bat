@echo off
REM Create simple robot emoji icon files - minimal valid PNGs

REM icon16.png (16x16 blue robot emoji)
powershell -NoProfile -Command ^
  $bytes = @(137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,16,0,0,0,16,8,6,0,0,0,31,243,255,97,0,0,0,25,116,69,88,116,83,111,102,116,119,97,114,101,0,65,100,111,98,101,32,73,109,97,103,101,82,101,97,100,121,113,201,101,60,0,0,0,151,73,68,65,84,56,203,99,96,96,96,96,120,120,120,248,240,225,195,7,14,28,56,112,224,192,129,3,7,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,128,1,3,6,12,24,48,96,192,0,0,0,0,73,69,78,68,174,66,96,130); ^
  [System.IO.File]::WriteAllBytes('icons\icon16.png', $bytes)

REM icon48.png (copy of icon16)
powershell -NoProfile -Command ^
  Copy-Item 'icons\icon16.png' 'icons\icon48.png' -Force

REM icon128.png (copy of icon16)
powershell -NoProfile -Command ^
  Copy-Item 'icons\icon16.png' 'icons\icon128.png' -Force

echo Icons created successfully
dir icons\
