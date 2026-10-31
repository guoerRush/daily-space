# Daily Space 多会话协作规则

## 分支与职责

| 会话 | 分支 | 独占范围 |
| --- | --- | --- |
| 主协调会话 | `master` | 合并、冲突处理、依赖与锁文件、最终验证、部署 |
| A（界面） | `codex/ui` | `src/app/globals.css`、`src/components/ui/**`、页面 JSX 与纯展示组件 |
| B（数据同步） | `codex/data` | 本地存储、Supabase 客户端同步、领域数据类型与数据 Hook |
| C（接口功能） | `codex/jiekou` | `src/app/api/**`、`workers/**`、服务端 Supabase 与飞书接口 |

## 禁止并行修改的共享文件

以下文件只能由主协调会话分配给一个会话，并在合并完成前保持独占：

- `package.json`、所有锁文件、`pnpm-workspace.yaml`
- `src/app/layout.tsx`
- `src/components/app-frame.tsx`
- `src/components/auth-gate.tsx`
- `src/components/cloud-record-sync.tsx`
- `src/components/pocket-pet.tsx`
- `src/components/reminder-watcher.tsx`
- `src/components/voice-dictation-button.tsx`
- `src/components/rich-text-editor.tsx`

业务页面当前直接调用本地存储和领域函数。B、C 不直接修改页面；它们先提供稳定的数据函数、Hook、DTO 或 API，再由 A 接入。

## 跨模块契约

- B 对 A 暴露稳定的 `list/get/save/delete/subscribe` 数据接口或 `useXxxStore` Hook。
- C 对 B/A 暴露明确的请求与响应类型，不让页面直接拼接 Supabase 查询或飞书请求。
- 本地存储键和 `daily-space:*` 变更事件集中定义，页面不得新增硬编码事件名。
- `app-frame.tsx` 的导航和视觉结构归 A；新增 Provider、同步器或全局监听器由主协调会话整合。
- 数据结构变更必须先写迁移兼容策略，再改调用方。

## 提交与合并门禁

每个工作会话完成时应提交自己的分支，并向主协调会话报告：提交哈希、改动文件、接口变化、测试结果和已知风险。

主协调会话按以下顺序处理：

1. 检查分支提交和文件越界。
2. 先合并接口与数据契约，再合并 UI 接入。
3. 处理冲突并检查数据迁移兼容性。
4. 运行 `npx tsc --noEmit`。
5. 运行 `npm run lint`。
6. 运行 `npm run build`。
7. 只有三项检查全部通过，且工作区没有意外文件时，才允许部署。

## 当前阻塞

`master` 目前包含大量未提交且相互耦合的 UI、数据和接口改动，并同时存在 npm/pnpm 锁文件。在建立共同基线前，三个分支只能进行只读审计，不能从旧提交开始独立开发，否则会遗漏当前功能或产生大范围冲突。
