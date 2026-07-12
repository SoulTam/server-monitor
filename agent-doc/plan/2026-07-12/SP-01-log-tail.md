<!-- 创建时间: 2026-07-12 11:30 -->
<!-- 最后修改: 2026-07-12 11:30 -->

# SP-01: 日志尾部浏览

## 最终结果（从结果蓝图逐字拷贝）

### ④ 技术设计Agent产出 — 技术实现终态 — 日志尾部浏览

#### API完整定义
| 方法 | 路径 | 功能 | 请求参数 | 响应格式 | 错误码 |
|------|------|------|---------|---------|--------|
| invoke | logs:tail | 读取远程文件末尾 N 行 | `{ serverId, filePath, nLines }` | `IpcResponse<string>` | SERVER_NOT_FOUND / LOGS_PATH_NOT_CONFIGURED / ACCESS_DENIED |
| invoke | logs:tailMore | 读取指定行之前的更早 N 行 | `{ serverId, filePath, beforeLine, nLines }` | `IpcResponse<string>` | 同上 |

#### 每张API的参数详情
**API：invoke logs:tail**
请求参数：
| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| serverId | body | string | 是 | 服务器 ID |
| filePath | body | string | 是 | 日志文件绝对路径 |
| nLines | body | number | 否 | 读取行数，默认 500 |

响应体：
```json
{ "success": true, "data": "line1\nline2\n...line500" }
```
错误响应：
```json
{ "success": false, "error": "SERVER_NOT_FOUND" }
```

**API：invoke logs:tailMore**
请求参数：
| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| serverId | body | string | 是 | 服务器 ID |
| filePath | body | string | 是 | 日志文件绝对路径 |
| beforeLine | body | string | 是 | 基准行内容（读取该行之前的更早内容） |
| nLines | body | number | 否 | 读取行数，默认 500 |

响应体：
```json
{ "success": true, "data": "earlier-line1\n...\nearlier-line500" }
```

#### 数据表完整设计：无新增数据表

#### 后端处理链路
**链路：日志尾部读取**
```
[请求 logs:tail] → [IPC Handler] → [SSH 执行 tail -n 500 filePath]
  ↓                   ↓                  ↓
[校验参数]          [路径安全校验]    [返回 stdout]
```

**链路：加载更早日志**
```
[请求 logs:tailMore] → [IPC Handler] → [SSH: wc -l filePath → 计算跳过行数]
  ↓                       ↓                    ↓
[校验参数]              [路径安全校验]   [head -n $skip filePath | tail -n 500]
```

### ③ 功能设计Agent产出 — 功能与交互终态 — 日志尾部

**交互元素完整列表**：
| 元素 | 类型 | 位置 | 操作 | 反馈 |
|------|------|------|------|------|
| 文件列表 | 左侧面板 | 文件列表区域 | 点击选中文件 | 高亮选中项，右侧加载内容 |
| 日志内容区 | 滚动区域 | 右侧面板 | 滚动 | 向上滚动触发加载更早日志 |
| "跳至最新"按钮 | 浮动按钮 | 日志内容区右下角 | 点击 | 滚动到日志末尾 |
| "加载更早"触发 | 自动滚动触发 | 日志内容区顶部 | 滚动到顶部 | 加载更早 N 行追加到内容区顶部 |
| 搜索输入框 | 输入框 | 日志弹层头部 | 输入关键字 | 高亮匹配行 |
| 搜索上/下导航 | 按钮 | 搜索框旁 | 点击 | 跳到上一个/下一个匹配行 |

**页面间导航关系**：
```
服务器列表页 → 服务器详情页（点击服务器卡片）
服务器详情页 → 日志弹层（点击"浏览日志"按钮）
日志弹层 → 日志文件末尾（自动定位，打开即显示末尾 N 行）
```

## 验收标准
1. 打开任意日志文件，首屏展示的是末尾 500 行内容（而非文件开头）
2. 向上滚动到顶部附近，自动加载更早 500 行并插入内容顶部
3. 内容区右下角有"跳至最新"按钮，点击后滚动到底部
4. 搜索功能不受影响，仍能高亮匹配行并导航
5. 路径穿越攻击被拒绝（filePath 必须属于 logsPath）

## 执行步骤
1. `src/shared/constants.ts` — 新增 `LOG_TAIL` / `LOG_TAIL_MORE` 通道常量
2. `src/shared/ipc-types.ts` — 新增 `LogTailPayload` / `LogTailMorePayload` 接口
3. `src/main/ipc/index.ts` — 新增 `LOG_TAIL` 处理器（SSH `tail -n`）+ `LOG_TAIL_MORE` 处理器（SSH `wc -l` + `head` + `tail`），复用现有路径校验逻辑
4. `src/preload/index.ts` — 新增 `logs.tail` / `logs.tailMore` API
5. `src/renderer/pages/ServerDetailPage.tsx` — 修改 `handleReadLog` 调用 `logs.tail`；修改 `handleContentScroll` 支持向上加载更早；新增 `loadEarlierChunk` 函数；新增"跳至最新"浮动按钮；新增定时器增量追加新行
6. 验证：`npm run typecheck && npm run lint:renderer`
