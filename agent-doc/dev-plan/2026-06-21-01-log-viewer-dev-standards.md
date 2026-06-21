# 开发规范文档：日志浏览优化

## 1. 代码风格
- 保持现有项目代码风格：React + TypeScript + Ant Design 5
- 使用 hooks（useState, useEffect, useRef, useCallback）
- 不引入额外第三方 UI 库（分割面板用原生实现）
- 注释使用中文，与现有代码一致

## 2. 修改约束
- 不修改 `src/main/services/SshService.ts`（复用现有 executeCommand）
- 不修改 IPC 通道定义（LOG_LIST/LOG_READ 已支持所需参数）
- 不修改类型定义文件
- 所有 UI 修改集中在 `ServerDetailPage.tsx`

## 3. 分片加载规范
- 分片大小固定为 65536 字节（64KB）
- 首次加载偏移量 offset=0
- 后续加载偏移量 = 已加载内容的实际字节总和
- 当返回内容长度 < 65536 时停止加载
- 加载状态通过 `loading` 状态控制，防止重复请求

## 4. 文件名提取规范
- 使用 `replace(/\\/g, '/').split('/').pop()` 提取 basename
- 保留原始 fullPath 用于后续读取
- 排序使用 `localeCompare` 支持中文等多语言

## 5. 拖拽实现规范
- 使用 document level 的 mousemove/mouseup 事件，确保拖拽不丢失
- 分割条宽度 8px，hover 时背景色变化
- 最小左侧宽度 200px，最小右侧宽度 300px

## 6. 测试要求
- 节点通过 TypeScript 编译（tsc 无报错）
- npm run dev 启动正常

## 7. 安全检查
- 维持现有 `filePath.startsWith(server.logsPath)` 路径验证
- 维持 `serverId` 作为所有操作的鉴权依据
