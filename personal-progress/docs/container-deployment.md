# 容器部署说明

本项目不能部署到“扣子 AI 办公助手”桌面客户端。该客户端是聊天工具，不提供 GitHub 导入、Docker 构建、网站域名或常驻后台服务。

需要选择支持 Docker 和常驻服务的云平台。若要让中国大陆用户稳定访问，应选择国内云服务商的容器平台，例如腾讯云 CloudBase、腾讯云轻量应用服务器或阿里云 ECS。部署时需要创建两个服务，二者都从同一个 GitHub 仓库读取代码。

| 服务 | Dockerfile | 用途 |
| --- | --- | --- |
| `daily-space-web` | `Dockerfile` | 网站、账号登录、资料同步、飞书导入接口 |
| `daily-space-feishu-worker` | `Dockerfile.feishu-worker` | 飞书长连接、手机消息同步、多个到点提醒 |

## 1. 网站服务

选择 `Dockerfile` 构建，公开端口填 `3000`。云平台生成域名后，将其填入 `NEXT_PUBLIC_APP_URL`，格式为 `https://你的域名`。

网站服务需要的环境变量：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
FEISHU_INGEST_SECRET=
FEISHU_WEBHOOK_URL=
FEISHU_WEBHOOK_SECRET=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
```

## 2. 飞书后台服务

再创建一个常驻后台服务，Dockerfile 路径填 `Dockerfile.feishu-worker`，公开端口也填 `3000`。它的健康检查地址是 `/health`。该服务不需要对外展示网页，但必须持续运行。

飞书后台服务需要的环境变量：

```text
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_INGEST_SECRET=
DAILY_SPACE_INGEST_URL=https://网站域名/api/feishu/events
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FEISHU_WEBHOOK_URL=
FEISHU_WEBHOOK_SECRET=
```

`SUPABASE_URL` 与网站的 `NEXT_PUBLIC_SUPABASE_URL` 填相同的 Project URL。提醒配置仍由右下角小新时钟添加；后台每 30 秒检查一次，到点后写入 `lastNotifiedDate`，同一条提醒当天只发送一次。网页关闭和电脑关机不会影响它。

## 3. 飞书开放平台

飞书应用保持“使用长连接接收事件”，订阅 `im.message.receive_v1`。不需要把网站域名填入飞书事件订阅 URL。后台长连接服务会收到飞书消息，并转发到网站的 `/api/feishu/events`。

所有密钥只填写到云平台环境变量，不能写进 GitHub 仓库或聊天消息。
