# 日常留白技术栈参考

只在维护“日常留白”网站或开发结构高度相似的应用时读取本文件。

## 技术栈

- Next.js App Router、React、TypeScript
- Tailwind CSS 与 shadcn/Base UI 组件
- TipTap 富文本编辑器
- Supabase 账号登录与用户云端记录
- Vercel 网站部署与定时任务接口
- 飞书 Webhook 提醒、应用事件和长连接工作进程

## 项目目录

- `src/app/`：页面和 API 路由
- `src/components/`：共享界面、应用框架、云端同步、提醒和语音输入
- `src/lib/`：领域数据、存储接口和外部集成
- `supabase/migrations/`：数据库迁移
- `workers/`：飞书长连接工作进程
- `.env.example`：环境变量契约

## 数据行为

大多数记录使用 `daily-space:*` 浏览器存储键。`CloudRecordSync` 会把这些记录同步到当前登录用户在 `user_records` 表中的记录。

本地修改应当具有最终权威，避免云端旧列表在刷新后恢复已经删除的记录。修改某类记录前，先检查对应的 `src/lib/*.ts` 模块和 `cloud-record-sync.tsx`。如果合并逻辑依赖更新时间，必须提供稳定标识和 `updatedAt`。完成本地写入后，派发对应的 `daily-space:*changed` 事件，让页面与云端同步及时更新。

终端无法直接修改用户浏览器中的数据。为单一账号导入数据时，应提供经过登录授权、可以重复执行且能够自动去重的浏览器操作，不得把私人数据硬编码给全部用户。

## 环境变量边界

允许暴露给浏览器的变量：

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

飞书密钥、定时任务密钥、数据接收密钥和 `SUPABASE_SERVICE_ROLE_KEY` 都属于服务端变量。不得放入 `NEXT_PUBLIC_*`，也不得在日志或响应中显示变量值。

## 验证命令

在网站项目目录执行：

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
npm run lint
npm run build
```

项目可能存在既有的图片优化警告。必须区分警告与真正导致构建失败的错误。

## Vercel 发布

```powershell
npx vercel --prod --yes
npx vercel alias set <新部署域名> daily-space-six.vercel.app
npx vercel inspect daily-space-six.vercel.app
```

最终 `inspect` 显示的部署 ID 必须与第一条命令创建的新部署一致。
