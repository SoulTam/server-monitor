<!-- 创建时间: 2026-06-27 09:40 -->
<!-- 最后修改: 2026-06-28 10:05 -->

# Workflow Status

当前阶段: 已完成（排序 + 悬停 + 缩进三合一）

上一步: 
- 日志列表按名称排序（`handleOpenLogs` 加 `.sort()`）
- 嵌套 JSON 改为 key 悬停弹层（移除折叠/展开，hover key 显示 Popover + 复制 raw/pretty 按钮）
- 外层 JSON 已漂亮缩进 2 格+语法高亮（`renderPrettyObject`）

下一步: 用户运行 `npm run dev:electron`，打开日志 Modal 验证：文件列表已排序 → 选择文件 → 外层 JSON 缩进 → key 悬停显示嵌套 JSON 预览。

说明:
- 改动：`ServerDetailPage.tsx` 加 `.sort()`；`LogLineRenderer.tsx` 重写 `renderPrettyObject`（Popover 替代 NestedJsonValue）；`LogLineRenderer.module.css` 新增 `.jsonKeyHover` 虚线样式
- 测试：36/36 通过，tsc/eslint/build:renderer 全通过
