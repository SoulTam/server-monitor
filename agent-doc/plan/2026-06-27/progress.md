<!-- 创建时间: 2026-06-27 09:40 -->
<!-- 最后修改: 2026-06-27 09:40 -->

# 进度追踪总表 — 日志嵌套 JSON 展示（方案 D）

| SP | 标题 | 依赖 | 状态 | commit |
|----|------|------|------|--------|
| SP-01 | 工具层：`nested-json.ts` + 单测 | 无 | pending | — |
| SP-02 | 组件层：`NestedJsonValue` + `LogLineRenderer` | SP-01 | pending | — |
| SP-03 | 集成：`ServerDetailPage` 接入 | SP-02 | pending | — |

更新规则：每完成 1 个 SP → 改为 `done`，并填入对应 commit hash（用 `git log --oneline | head -1` 获取）。
