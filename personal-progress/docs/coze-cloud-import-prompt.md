# 扣子云迁移指令

在扣子编程中新建项目后，将下面内容作为第一条需求发送。不要要求扣子重写或简化现有页面，必须以仓库源码为基础。

```text
请将 GitHub 仓库 https://github.com/guoerRush/daily-space 导入为现有项目，不要重新生成或替换现有产品功能。

这是一个 Next.js 16 + React 19 的中文个人记录网站，使用 Supabase 账号登录和云端同步，包含飞书消息导入、多个飞书定时提醒、图片上传与日记/计划/习惯等功能。

请先读取仓库根目录的 Dockerfile、Dockerfile.feishu-worker 与 docs/container-deployment.md，然后执行以下工作：
1. 使用 Dockerfile 部署网站服务 daily-space-web，公开端口为 3000，并生成可访问的扣子云域名。
2. 使用 Dockerfile.feishu-worker 部署常驻服务 daily-space-feishu-worker，健康检查路径为 /health。该服务负责飞书长连接接收消息和每 30 秒检查一次提醒，不能作为短时函数运行。
3. 为两个服务创建独立的服务端环境变量配置界面，绝不把密钥写入 GitHub、客户端代码或日志。
4. 网站域名生成后，将它配置为 NEXT_PUBLIC_APP_URL，并将 https://网站域名/api/feishu/events 配置为 Worker 的 DAILY_SPACE_INGEST_URL。
5. 保持飞书开放平台使用“长连接接收事件”和 im.message.receive_v1 订阅；不要要求配置 HTTP 回调 URL。
6. 部署前运行 npm run build；如果扣子云不支持 Dockerfile 或第二个常驻服务，请明确说明具体限制，不要伪造部署成功。
```

若仓库为私有仓库，先在扣子编程的 GitHub 授权界面授权 `guoerRush/daily-space` 的读取权限。若没有 GitHub 导入入口，可将仓库设为公开后在项目需求中提供仓库链接。
