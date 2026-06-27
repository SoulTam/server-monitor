<!-- 创建时间: 2026-06-27 09:40 -->
<!-- 最后修改: 2026-06-27 16:35 -->

# 进度追踪总表 — 日志嵌套 JSON 展示（方案 D）

| SP | 标题 | 依赖 | 状态 | commit |
|----|------|------|------|--------|
| SP-01 | 工具层：`nested-json.ts` + 单测 | 无 | done | `7bbcb08` |
| SP-02 | 组件层：`NestedJsonValue` + `LogLineRenderer` | SP-01 | done | `a332c03` |
| SP-03 | 集成：`ServerDetailPage` 接入 | SP-02 | **done** | `f2824bc` |

更新规则：每完成 1 个 SP → 改为 `done`，并填入对应 commit hash。

SP-01 验收报告：
- ✅ vitest 25/25；tsc --noEmit 0 error；eslint 0 warning
- ✅ 无 package.json diff
- ⚠️ 全量 vitest 失败位于 `alertservice/dataservice`（better-sqlite3 原生 binding ABI 不匹配），与本需求无关

SP-02 验收报告：
- ✅ 文件落地：`NestedJsonValue.tsx/.module.css`、`LogLineRenderer.tsx/.module.css`
- ✅ `npx tsc -p tsconfig.json --noEmit` 0 error
- ✅ `npx eslint` 0 warning
- ✅ `npm run build:renderer` 通过
- ✅ 新组件无 `dangerouslySetInnerHTML`
- ✅ 仅引用既有依赖 `react / antd / utils/nested-json`

SP-03 验收报告：
- ✅ 文件改动范围：仅 `src/renderer/pages/ServerDetailPage.tsx`（+39 / -24 行，无其他文件改动）
- ✅ `npx tsc -p tsconfig.json --noEmit` 0 error
- ✅ `npx eslint` 与 HEAD 持平（3 errors / 3 warnings，全部为 HEAD 历史遗留，本 SP 未引入新问题）
- ✅ `npm run build:renderer` 通过
- ✅ 无 package.json/lock 改动
- ✅ 新组件 + LogLineRenderer 渲染接入 Modal
- ✅ Esc 全局监听收起展开项
- ✅ 切换日志文件 / 加载新分片时清空 expanded
- ⚠️ 既有搜索 `<mark>` 高亮路径保留（当 `debouncedSearch` 有效时，从 per-line 渲染回退到原文 `dangerouslySetInnerHTML`，与蓝图 §②「搜索兼容」一致）
- ⚠️ 既有"日志浏览优化"在 6-21 蓝图中引入的 split panel / 进度百分比 / 分片滚动加载 UI 在当前工作树中已被另一次会话回退。该回退先于本 SP 存在；本 SP 不处理该回退（属历史偏离）
