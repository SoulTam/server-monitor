<!-- 创建时间: 2026-06-27 09:00 -->
<!-- 最后修改: 2026-06-27 09:00 -->

# 用户请求：日志中嵌套 JSON 字符串的展示优化（仅讨论，不修改）

## 原始请求
> 现在查看服务器日志时发现有部分JSON item的内容也是JSON格式的字符串，我也想看到这些JSON字符串按照漂亮格式输出，但又不想影响原本日志的内容。我计划如果日志有这样的内容时，这个item的key高亮显示，然后鼠标悬停在key上面时，在key的右侧出现一个浮窗，在浮窗中显示该item value中的JSON漂亮格式。你帮我看一下，有没有更好的建议。先讨论，不修改。

## 模糊点已确认

| # | 模糊点 | 用户答复 | 含义 |
|---|--------|---------|------|
| 1 | 项目类型/技术栈 | 直接查看代码 | Electron + React + AntD + Vite, src/renderer/pages/ServerDetailPage.tsx 是日志查看组件 |
| 2 | 日志数据来源 | 若需要继续问 | 不再问（用户已签字必须走完整流程→讨论阶段产方案对比） |
| 3 | "日志内容本身" 的界定 | "日志从服务器读后做了第一次 JSON 漂亮格式（line 级），视觉处理允许；不改变第一次 JSON 格式处理后的字符串值即可" | line 级 `: JSON.stringify(JSON.parse(line), null, 2)` 已存在；不要改 raw value，但视觉上可动。 |
| 4 | 嵌套层数 | 只有一次 JSON in JSON | 单层即可，深度=1 |
| 5 | 浮窗高度 | 按日志查看窗口大小自动调整，内容超出滚动条 | 自适应 + overflow:auto |
| 6 | 操作场景 | 只读，可复制，不可修改 | read-only + 可复制文本/按钮 |
| 7 | 是否需要后端 | 只需前端处理 | 不改主进程/IPC |

## 项目上下文（从代码读取）

- 日志查看界面：`src/renderer/pages/ServerDetailPage.tsx`（530 行）
- JSON 渲染：`formatJsonLine(line)`(L21-27) 逐行 `JSON.stringify(JSON.parse(line), null, 2)`
- 渲染容器：`logContentRef` 指向 `div` (L494-516)，原始内容用 `{logContent}` 直输出 (L499)，搜索态用 `dangerouslySetInnerHTML` (L500-507)
- 当前样式：`whiteSpace: pre-wrap`、`fontFamily: monospace`、`fontSize: 13`，无语法高亮（搜索态用 `<mark>`）
- 反序列化后 `key` 直接打印字符串 `"context":"{\"a\":1}"`，内部 `{}` 被转义为 `\"{\"a\":1}\"`，不可读
- 依赖中无 JSON 视图库（无 react-json-view / react18-json-view / monaco-json / codemirror-json），纯字符串拼接
- 测试覆盖：`tests/parsers.test.ts` 等；ServerDetailPage 无单元测试
- 既有"日志浏览优化（SP-01/SP-02）"在结果蓝图中已✅完成（见 `agent-doc/result-first/2026-06-21-01-log-viewer-optimization-result-blueprint.md`），本次需求叠加其上

## 期望产出（讨论阶段）

1. 方案对比：用户原方案（A） vs 至少 2 个替代方案（B/C）
2. 评估维度：实现复杂度 / 视觉一致 / 不影响"第一次 pretty 后内容" / 性能 / 可发现性 / 可维护性
3. **输出最终推荐方案**，哪怕用户待会儿仍可能修改
4. 不修改任何代码（用户明确指令）
