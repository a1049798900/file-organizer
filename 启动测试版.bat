@echo off
chcp 65001 >nul
title 文枢 - 开发测试版

rem 进入项目目录（/d 用于跨盘符切换）
cd /d "d:\Projects\file-organizer"

rem 显式使用 npm.cmd，避免被当前目录下同名无扩展文件劫持
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm，请确认已安装 Node.js 并加入 PATH。
  echo.
  pause
  exit /b 1
)

echo ==========================================
echo   启动开发测试版（Vite + Electron）
echo   关闭本窗口即可停止开发服务器
echo ==========================================
echo.

call npm.cmd run dev

rem 服务异常退出时暂停，便于查看报错信息
echo.
echo 开发服务器已退出，按任意键关闭窗口...
pause >nul
