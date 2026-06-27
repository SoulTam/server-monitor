<!-- 创建时间: 2026-06-27 09:35 -->
<!-- 最后修改: 2026-06-27 09:35 -->

# 开发规范文档 — 日志嵌套 JSON 展示（方案 D）

## 1. 编码规范

- TypeScript strict 模式（...已有）
- ESLint + Prettier 保持既有配置（`.eslintrc.cjs` / `.prettierrc`）
- 不引入新依赖；新代码不破坏既有 lint
- 命名：
  - React 组件文件名 PascalCase（与项目既有 `components/` 一致）
  - util 文件名 kebab-case 或 `kebab-lower`
  - 函数 / 变量 camelCase
  - 类型 PascalCase

## 2. 目录布局（新增）

```
src/renderer/
├── components/
│   ├── NestedJsonValue.tsx          # 新增
│   └── LogLineRenderer.tsx          # 新增
├── pages/
│   └── ServerDetailPage.tsx         # 修改
└── utils/
    └── nested-json.ts               # 新增
tests/
└── nested-json.test.ts              # 新增
```

## 3. 单元测试规范

- 框架：vitest（项目已有）
- 范围：`src/renderer/utils/nested-json.ts` 所有公共函数
- 覆盖维度：
  - happy path：合法嵌套对象字符串
  - 字符串转义：内含 `\"` / `\n` / `\t`
  - 边界：空串、首字符 `{` 或 `[` 但未闭合、含前导/尾随空白
  - 非对象根（如数组）：识别为合法
  - 整行非 JSON：返回 plain token
  - 性能样本：1KB / 16KB raw value tokenize < 2ms（粗略 sanity）

## 4. UI 集成规约

- `ServerDetailPage.tsx` 中：
  - 保留 `formatJsonLine` 用于"非嵌套快速路径"或兜底（详见子计划 SP-03）
  - 新增 `expandedNestedKeys` state
  - Esc 监听使用 `useEffect` 注册 / 卸载
  - 复制成功 / 失败 使用 antd `message.success / .error`（项目已在 `handleStart` 等处使用）
- 不动 `useMonitorStore` / `stores/*` / 主进程 / preload

## 5. 性能规约

- 单次 `<LogLineRenderer>` 渲染时间预算 < 8ms（包括 tokenize）
- 不在每帧渲染中调用 `prettyJsonString`：仅在展开时调且结果缓存到 `useMemo` 中
- isJsonLikeString 仅当 value 是 string 时调用

## 6. 安全规约

- 永不将未转义用户内容拼进 `dangerouslySetInnerHTML`
- pretty 内容既作 React children 输出（自动转义）
- 既有搜索 `<mark>` 路径的转义函数复用，不重新实现

## 7. 提交 / Lint 规约

每个子计划完成后：

```bash
npm run lint
npm run test
npm run build      # 三件套
```

通过后才允许 commit。commit 信息遵循 Conventional Commits：
- `feat(renderer): add nested-json pretty preview`
- `test(nested-json): add unit tests for tokenize`
- `feat(renderer): integrate nested-json into ServerDetailPage`

## 8. Git 提交策略

- 每次子计划完成 → 自动 `git add .` + `git commit`
- 每个子计划 commit 由 SP-XX 前缀明确标识
- 累计 3 个子计划 = 触发 1 次聚合提交（按 AGENTS.md 例外规则；本次恰好只有 3 个 SP，最终一次聚合即可）

## 9. 日志规范

- `electron-log` 现有配置（5.2.0）：不接入新日志
- 若涉及错误捕获（复制失败、bad JSON），用 antd `message.error` + console.error 双轨

## 10. 部署规约

- 不涉及（Electron 桌面应用，版本通过 `package.json` `version` 管理）
- 不打 tag、不需要 release notes（增量改动）
