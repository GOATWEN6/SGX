@echo off
chcp 65001 >nul
title AI 回忆录助手 - 公网访问版
cd /d "%~dp0"

echo ========================================
echo    AI 回忆录助手 - 启动脚本
echo ========================================
echo.
echo [1] 启动本地服务器...
echo.

REM 启动 Next.js 开发服务器
start "Next.js Dev Server" cmd /k "npm run dev"

echo [2] 等待服务器启动...
timeout /t 8 /nobreak >nul

echo [3] 检查服务器状态...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 本地服务器启动失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo    本地服务已启动！
echo ========================================
echo.
echo 本地访问: http://localhost:3000
echo.
echo [4] 正在启动内网穿透（ngrok）...
echo    按 Ctrl+C 停止服务
echo.

REM 尝试启动 ngrok（需要用户自行配置）
if exist "ngrok.exe" (
    start "ngrok" cmd /k "ngrok http 3000"
) else (
    echo [提示] 未找到 ngrok.exe
    echo.
    echo 如需公网访问，请选择以下方案：
    echo.
    echo 方案1 - ngrok（推荐）:
    echo   1. 访问 https://ngrok.com 下载
    echo   2. 解压后放到本目录
    echo   3. 运行: ngrok http 3000
    echo.
    echo 方案2 - Cloudflare Tunnel:
    echo   1. 安装: npm install -g cloudflared
    echo   2. 运行: cloudflared tunnel --url http://localhost:3000
    echo.
    echo 方案3 - natapp:
    echo   1. 访问 https://natapp.cn
    echo   2. 下载配置后运行
    echo.
)

echo.
echo 按任意键退出...
pause >nul
