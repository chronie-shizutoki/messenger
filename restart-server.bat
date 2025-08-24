@echo off

echo 正在列出所有Node.js进程...
 tasklist /FI "IMAGENAME eq node.exe"

 echo 正在终止所有Node.js进程...
 taskkill /F /IM node.exe

 echo 等待进程完全终止...
 timeout /t 3 >nul

 echo 验证所有Node.js进程是否已终止...
 tasklist /FI "IMAGENAME eq node.exe" | findstr /I "node.exe" >nul
 if %ERRORLEVEL% EQU 0 (
    echo 警告: 仍有Node.js进程在运行!
 ) else (
    echo 所有Node.js进程已终止。
 )

 echo 正在启动服务器...
 start /min cmd /c "node app.js && echo 服务器已成功启动!"

 echo 操作完成！请等待几秒钟让服务器完全启动。