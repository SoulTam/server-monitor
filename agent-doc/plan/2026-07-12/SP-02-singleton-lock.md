<!-- 创建时间: 2026-07-12 11:30 -->
<!-- 最后修改: 2026-07-12 11:30 -->

# SP-02: Electron 单实例锁

## 最终结果（从结果蓝图逐字拷贝）

### ④ 技术设计Agent产出 — 技术实现终态 — 单实例锁

#### 后端处理链路
**链路：单实例锁**
```
[app 启动] → [app.requestSingleInstanceLock()]
  ↓               ↓
[获得锁] → continue 正常启动
[未获得锁] → app.quit() + 触发 second-instance 事件聚焦已有窗口
```

### ② 架构设计Agent产出 — 系统架构终态 — 单实例锁

#### 模块划分
| 模块 | 职责 | 技术选型 | 选型理由 |
|------|------|---------|---------|
| 单实例锁 | 防止 Electron 多开，后续实例聚焦已有窗口 | Electron `app.requestSingleInstanceLock` | 官方 API，零依赖 |

#### 模块间交互关系
| 调用方 | 被调用方 | 通信方式 | 接口协议 |
|--------|---------|---------|---------|
| app.whenReady | app.requestSingleInstanceLock | 直接调用 | 返回 boolean |
| 后续实例 | 已有实例窗口 | second-instance 事件 | focus/restore 已有窗口 |

## 验收标准
1. 首次启动应用正常打开窗口
2. 再次双击桌面快捷方式/EXE，不创建新窗口，已有窗口弹出并聚焦
3. 如果窗口已最小化，恢复为正常大小
4. 应用关闭（托盘隐藏）后再次点击，聚焦已有窗口

## 执行步骤
1. `src/main/index.ts` — 在 `app.whenReady()` 之前（约第 1 行 `app` 导入后）添加：
   - `const gotLock = app.requestSingleInstanceLock();`
   - `if (!gotLock) { app.quit(); } else { app.on('second-instance', () => { 聚焦已有窗口逻辑 }); }`
2. 验证：`npm run typecheck && npm run lint:renderer`

## 实现细节
插入位置在 `app.whenReady()` 之前，`import` 语句之后。窗口聚焦逻辑：
```typescript
app.on('second-instance', () => {
  const win = getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
```
