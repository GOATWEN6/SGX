@echo off
echo ============================================
echo   AI 回忆录助手 - 启动公网访问
echo ============================================
echo.

REM 解除 PowerShell 限制
echo [1/3] 解除 PowerShell 执行限制...
powershell -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass"

REM 检查 npm 是否在运行
echo [2/3] 检查 Next.js 服务...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo     Next.js 未运行，正在启动...
    start cmd /k "cd /d %~dp0 && npm run dev"
    echo     请等待 Next.js 启动完成...
    timeout /t 10 /nobreak >nul
)

REM 启动 cloudflared 隧道
echo [3/3] 启动 cloudflared 隧道...
echo.
echo 请复制下面的公网地址到浏览器访问：
echo.
cloudflared tunnel --url http://localhost:3000

pause
