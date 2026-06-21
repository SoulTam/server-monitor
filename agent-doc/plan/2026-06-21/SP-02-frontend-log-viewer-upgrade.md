# SP-02: 前端日志浏览UI改造

## 基本信息
| 字段 | 值 |
|------|-----|
| 类型 | B |
| 技术栈 | React + TypeScript + Ant Design 5 |
| 对应蓝图章节 | ① 需求分析Agent产出 + ③ 功能设计Agent产出 + ④ 技术设计Agent产出 |
| 前置依赖 | 无 |

## 最终结果（从结果蓝图逐字拷贝）

### 非功能需求
| 类别 | 需求描述 | 验收标准 |
|------|---------|---------|
| 性能 | 日志文件分片加载，每次只加载前64KB内容，后续按需加载 | 100MB日志文件首次加载≤2秒，滚动加载每片≤1秒 |
| SSH超时 | SSH命令执行超时从5秒延长至可配置，至少30秒 | 读取大文件不出现SSH_COMMAND_TIMEOUT错误 |
| 可用性 | 文件列表与内容区域支持鼠标拖动调整宽度 | 拖动分隔条时实时响应，最小宽度分别为200px/300px |
| 可用性 | 文件列表只显示文件名，不显示全路径 | 列表项无目录前缀，以文件名形式展示 |

### 交互元素完整列表
| 元素 | 类型 | 位置 | 操作 | 反馈 |
|------|------|------|------|------|
| 文件列表项 | List.Item | 左侧面板 | 点击 | 高亮选中项，右侧加载文件内容 |
| 分割条 | 自定义分割线 | 左右面板中间 | 鼠标拖拽 | 实时调整两侧面板宽度 |
| 内容区域 | div (pre-wrap) | 右侧面板 | 滚动到底部 | 自动加载下一分片内容 |
| 修改路径按钮 | Button (link) | Modal 顶部 | 点击 | 弹出配置日志目录 Modal |

### 技术实现细节
- log:read 已支持 offset/length 参数。分片加载策略为：首次加载 offset=0, length=65536（64KB），后续每次加载 offset+=前一次length, length=65536。
- 前端维护 offset 状态、hasMore 状态
- 滚动到底部（距底部<100px）触发加载
- 文件名使用 `path.basename` / `split('/').pop()` 提取

## 验收标准
1. 文件列表仅显示文件名（无目录前缀），按文件名倒序排列（Z→A）
2. 左右面板之间有可拖拽的分割条，拖拽时实时调整宽度（左≥200px，右≥300px）
3. 首次加载只读取前64KB，滚动到底部自动加载下一片
4. JSON 文件首次加载时仍可自动格式化

## 执行步骤
### Step 1: 修改日志浏览Modal UI
- 文件: `src/renderer/pages/ServerDetailPage.tsx`
- 操作: 重写日志浏览Modal（第278-302行区域）
  - 文件列表使用 `b.name.localeCompare(a.name)` 倒序排列
  - 显示文件名 basename
  - 添加分割条拖拽逻辑

### Step 2: 实现分片滚动加载
- 文件: `src/renderer/pages/ServerDetailPage.tsx`
- 操作:
  - 新增状态：`logOffset`, `logContent`, `hasMore`, `loading`, `selectedFilePath`
  - 修改 `handleReadLog` 为分片首次加载
  - 新增 `loadChunk` 函数和 `handleContentScroll` 滚动事件
  - 始终使用 offset/length 参数调用 log:read（不再走全量 cat 路径）

### Step 3: 验证
- 确认 `npx tsc --noEmit -p tsconfig.json` 通过
- 确认 `npm run dev` 正常启动

## 执行产出物
| 预期产出 | 路径 |
|---------|------|
| 修改后的 ServerDetailPage.tsx | src/renderer/pages/ServerDetailPage.tsx |

## 核查Agent自动检查
| 结果 | 后续动作 |
|------|---------|
| ⏳ 待核查 | 执行后自动触发 |
