@echo off
title Daily Space 飞书连接配置
powershell.exe -NoExit -STA -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure-feishu-worker-credential.ps1"
