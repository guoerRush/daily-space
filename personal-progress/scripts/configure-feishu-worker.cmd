@echo off
title Daily Space Feishu Setup
powershell.exe -NoExit -STA -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure-feishu-worker-credential.ps1"
