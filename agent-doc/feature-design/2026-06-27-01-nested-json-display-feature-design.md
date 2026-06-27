<!-- 创建时间: 2026-06-27 09:35 -->
<!-- 最后修改: 2026-06-27 09:35 -->

# 功能设计文档 — 日志嵌套 JSON 展示（方案 D）

## 1. 业务目标

让用户在查看日志时，能够：

1. 在普通日志行中**识别**到那些 value 本身是 JSON 字符串的字段
2. **不破坏原始日志内容**地（即折叠态不影响 raw value 字符串在内存中的内容，且整行可选中复制）
3. **按需**展开查看内层 JSON 的格式化展示
4. **快速复制** raw / pretty 两份文本到剪贴板

## 2. 关键场景

### 场景 1：折叠态（默认）

- 用户看到一串原始日志
- 某个 key 后跟 `▶ nested JSON (123 chars)`
- 鼠标 hover：按钮变 antd hover 色
- 点击 ▶：折叠 → 展开

### 场景 2：展开态

- 就地出现一个浅色背景的容器
- 容器内有缩进 2 空格的 pretty-JSON
- 顶部右侧有 3 个按钮 × 收起 / 复制 raw / 复制 pretty
- 容器高度自适应 `clamp(120, calc(100vh-240px), 480)`，超出滚动
- Esc 收起 / 点击收起按钮 收起

### 场景 3：非嵌套日志行

- 完全不出现折叠/展开元素，与历史行为一致
- `formatJsonLine` 输出仍由 pretty 文本块呈现

### 场景 4：搜索兼容

- 用户在搜索框输入关键字
- 命中部分仍由现有 `dangerouslySetInnerHTML` 注回 `<mark>`
- 命中若落在嵌套 value 上：在折叠态，搜索 `<mark>` 应**不**进入折叠占位符而是高亮显示在折叠元素的"前后上下文"
- 在展开态：pretty 容器内是 React children，搜索不二次注入 `<mark>`（只在外面行级）

### 场景 5：超大 pretty（> 500KB）

- 容器 max-height 生效，内部出现滚动条
- 浏览器复制按钮可全选；与"可复制"约束自洽

## 3. 详细交互元素清单（每页）

### 折叠态单个命中点
| 元素 | 类型 | 位置 | 操作 | 反馈 |
|------|------|------|------|------|
| ▶ 折叠按钮 | `<button class="nlj-fold">` | 紧贴 key 后 | click/Enter | 切换展开 |
| nested JSON 提示文字 | `<span class="nlj-fold-label">` | 按钮右侧 | — | 静态 |

### 展开态单个命中点
| 元素 | 类型 | 位置 | 操作 | 反馈 |
|------|------|------|------|------|
| pretty 容器 | `<div class="nlj-popup">` | 行内 | — | 自适应高度 |
| × 收起 | `<button class="nlj-btn">` | 容器右上 | click/Esc | 收起 |
| 复制 raw | `<button>` | 右上 | click | 复制 + toast |
| 复制 pretty | `<button>` | 右上 | click | 复制 + toast |
| pretty 内容 | `<pre><code>...</code></pre>` | 容器内部 | 选中 | 复制 |

### 全局
| 元素 | 类型 | 位置 | 操作 | 反馈 |
|------|------|------|------|------|
| 键盘 Esc | document keydown | 全局 | keydown | 收起所有已展开 |

## 4. 文案（中文）

| 文案 | 出现位置 |
|------|---------|
| `▶ nested JSON (N chars)` | 折叠按钮旁 |
| `复制成功` / `复制失败` | antd `message.success / .error` |
| `× 收起` | 按钮文案 |
| `复制 raw` | 按钮文案 |
| `复制 pretty` | 按钮文案 |

## 5. 边缘 / 异常

| 情况 | 行为 |
|------|------|
| value 是空字符串 `""` | 不命中（首字符非 `{`/`[`） |
| value 是 JSON 数字字符串 `"123"` | 不命中（首字符数字） |
| value 是合法 JSON 但无意义空格 `"  { \"a\":1}  "` | 通过 `isJsonLikeString` 中 trim 仍命中 |
| value 是非法 JSON `"abc{"` | 不命中；按普通 string 折叠态输出 |
| value 内部嵌套多层："a":"{\"b\":\"{\\\"c\\\":1}\"}" | 仅 depth=1，命中；pretty 仍 JSON 的 JSON 内容；不递归识别 |
| `rawLine` 整行不是 JSON | LogLineRenderer 回退成 `<pre>{rawLine}</pre>` 等价渲染 |
| `clipboard` API 不可用 | 创建临时 `<textarea>` 使用 `document.execCommand('copy')`，再 `message.success` |

## 6. 跨设备 / 屏幕

- Modal 在 800px 宽下：弹层宽度自适应 100% 行宽
- Modal 最大化到全屏（既有功能）：弹层同样自适应，自适应高度上限 `calc(100vh - 240px)` 仍有意义（顶部 title + 工具栏 + 底部 paddings）

## 7. 可访问性

- 折叠/展开按钮均为 `<button>`，焦点环可见
- `aria-expanded`、`aria-controls` 由 button / div 组合正确标注
- 复制按钮带 `aria-label="复制 raw"` / `"复制 pretty"`
- pretty 容器 `role="region" aria-label="嵌套 JSON 预览"`

## 8. 视觉风格

- 折叠按钮：antd `Button` 默认 small，`type="link"` 或文本按钮
- 弹层：浅蓝背景 `#f0f7ff`，边框 `1px solid #d6e4ff`，圆角 4px
- 复制按钮：antd `Button size="small"`
- 颜色 token：与 Layout.module.css 中 `#1677ff` / `#999` 保持一致
- 等宽：`font-family: monospace`（与既有日志区域 `fontFamily: 'monospace'` 一致）
