<!-- 创建时间: 2026-06-27 09:40 -->
<!-- 最后修改: 2026-06-27 09:40 -->

# 全局执行计划 — 日志嵌套 JSON 展示（方案 D）

| 任务 | 前置依赖 | 负责子Agent | 状态 |
|------|---------|-------------|------|
| SP-01 — utils/nested-json.ts + 单测 | 无 | code-dev-frontend | pending |
| SP-02 — NestedJsonValue + LogLineRenderer 组件 | SP-01 | code-dev-frontend | pending |
| SP-03 — 在 ServerDetailPage 接入 + 性能/安全验收 | SP-02 | code-dev-frontend | pending |

里程碑：
- M1（SP-01 commit）：utils 与单测全部通过 vitest
- M2（SP-02 commit）：两个组件可独立运行（smoke）
- M3（SP-03 commit）：Modal 中接入成功；npm run lint / test / build 全过

详细执行步骤见 `agent-doc/plan/2026-06-27/SP-XX-*.md` 各自独立文件。
