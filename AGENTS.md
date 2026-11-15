# 项目约定

## 1. 项目概述
个人交易复盘系统，单用户，Windows 本地运行，非多用户、非公网部署。
- 模块 1：交易策略管理（含改名、内容改动记录）+ 策略每日指标录入 + 历史双 Y 轴折线图
- 模块 2：按日期的复盘记录 CRUD，支持 Markdown 左右分屏即时预览，左侧记录列表
- 全局：三种主题模式（跟随系统/黑夜/白天，默认跟随系统）

## 2. 技术栈（锁定，不得擅自更换）
- 后端：Go 1.25 + Gin
- 数据库：SQLite，驱动必须使用 modernc.org/sqlite（纯 Go，禁止 mattn/go-sqlite3）
- 数据库文件：开发阶段为项目根目录 data.db；Wails 打包后为 %APPDATA%\TradeReview\data.db
- SQLite 连接必须执行 `PRAGMA foreign_keys = ON;`
- 前端：React 19 + TypeScript + Vite
- 样式：Tailwind CSS（dark mode 使用 class 策略）
- UI 组件：shadcn/ui（通过 CLI 添加，禁止引入传统黑盒组件库）
- 图表：优先 @tremor/react；若无法配置双 Y 轴折线图，回退到 shadcn/ui chart 组件（底层 Recharts）
- Markdown：react-markdown + remark-gfm；预览容器使用 @tailwindcss/typography 的 prose 类
- 图标：lucide-react
- 桌面壳（阶段 4，当前暂停）：Wails v2
- 禁止引入：Echo / Ent / MongoDB / Ant Design / MUI / Chakra / 任何 WYSIWYG 富文本编辑器（TipTap / Lexical / Milkdown / ProseMirror）

## 3. 数据模型（SQLite）

### strategies（交易策略，可改名）
- id INTEGER PRIMARY KEY AUTOINCREMENT
- name TEXT NOT NULL UNIQUE
- current_detail TEXT NOT NULL
- created_at TEXT NOT NULL（ISO8601）
- updated_at TEXT NOT NULL（ISO8601）
- 规则：name 可修改，改成已存在名称时接口返回 409
- 规则：current_detail 发生变化时，自动向 strategy_revisions 插入一条新版本
- 删除规则：DELETE 必须带 confirm=true，级联删除该策略的所有 strategy_metrics 和 strategy_revisions

### strategy_revisions（策略内容改动记录）
- id INTEGER PRIMARY KEY AUTOINCREMENT
- strategy_id INTEGER NOT NULL
- detail TEXT NOT NULL（该版本完整内容快照）
- note TEXT NOT NULL DEFAULT ''（本次改动说明，可选）
- changed_at TEXT NOT NULL（ISO8601）
- FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
- CREATE INDEX idx_revisions_strategy ON strategy_revisions(strategy_id, changed_at);
- 规则：创建策略时自动插入首条 revision；只改名不改内容不生成 revision；内容未变化不生成 revision

### strategy_metrics（策略每日指标）
- id INTEGER PRIMARY KEY AUTOINCREMENT
- date TEXT NOT NULL（YYYY-MM-DD）
- strategy_id INTEGER NOT NULL
- total_picks INTEGER NOT NULL DEFAULT 0
- limit_up_count INTEGER NOT NULL DEFAULT 0
- failed_limit_count INTEGER NOT NULL DEFAULT 0
- UNIQUE(date, strategy_id)
- FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
- CREATE INDEX idx_metrics_date_strategy ON strategy_metrics(date, strategy_id);
- 说明：指标只存 strategy_id，展示时 JOIN strategies 取当前名称。策略改名后，历史指标显示新名称（已确认接受）

### review_notes（复盘记录）
- id INTEGER PRIMARY KEY AUTOINCREMENT
- date TEXT NOT NULL UNIQUE（YYYY-MM-DD）
- content TEXT NOT NULL DEFAULT ''
- updated_at TEXT NOT NULL（ISO8601）

封板率、炸板率不存库，后端查询时实时计算：
- seal_rate = total_picks > 0 ? limit_up_count / total_picks : 0
- break_rate = (limit_up_count + failed_limit_count) > 0 ? failed_limit_count / (limit_up_count + failed_limit_count) : 0

## 4. API 契约（不得擅自增删字段）

### 策略
- GET    /api/strategies                  列表（id, name, current_detail, created_at, updated_at）
- POST   /api/strategies                  新建（name 重复 409；detail 空 400）；成功后同时插入首条 revision
- GET    /api/strategies/:id              详情
- PUT    /api/strategies/:id              更新（可改名、可改内容；改名冲突 409；内容有变化时插入新 revision，可带 note）；更新 updated_at
- DELETE /api/strategies/:id?confirm=true 删除（未带 confirm 且存在关联数据时 409）；级联删除 metrics 和 revisions
- GET    /api/strategies/:id/revisions    改动历史（changed_at 倒序）

### 指标
- GET  /api/metrics?from=&to=&strategy_id=  查询，返回体含 seal_rate、break_rate、strategy_name（JOIN 当前名）
- POST /api/metrics                         新增（date+strategy_id 冲突 409 + 已有记录体，含 id）
- PUT  /api/metrics/:id                     更新
- GET  /api/metrics/dates                   已有指标日期（升序去重）

### 复盘
- GET /api/notes/:date   查询某日复盘，不存在返回 200 + 空 content
- PUT /api/notes/:date   upsert 某日复盘
- GET /api/notes         复盘记录列表（date、content 摘要、updated_at），date 倒序

## 5. 编码规范
- 后端分层：handler / service / repository
- 前端目录：src/pages, src/components, src/api
- 不写单元测试，阶段内以本地 curl / 页面手动验证为准
- 全站界面文案统一使用“交易策略”，禁止残留“板块”字样；代码标识符禁止残留 sector

## 6. 阶段进度
- [x] 阶段 0：数据模型与项目骨架
- [x] 阶段 1：Go 后端 API（旧模型）
- [x] 阶段 2：前端模块 1（旧模型）
- [x] 阶段 3：前端模块 2（复盘记录 Markdown 分屏预览）
- [PAUSED] 阶段 4：Wails 桌面壳 + 开机自启（暂停，暂不执行）
- [x] 阶段 5：主题切换系统
- [x] 阶段 6：导航栏布局优化（图标+居中，文案暂不改）
- [x] 阶段 7：数据模型重构 —— 交易策略实体 + 改动记录（破坏性）
- [x] 阶段 8：策略管理基础 UI + 指标录入改 id 选择
- [x] 阶段 9：策略编辑与改动记录 UI
- [x] 阶段 10：重构关联修复（全站改名 + 筛选下拉 + 空状态）
- [x] 阶段 11：指标重复提交检测与修改交互
- [ ] 阶段 12：日期下拉框（录入/筛选两种行为）
- [ ] 阶段 13：复盘记录左侧列表 + 新建入口

## 7. 变更记录
（每阶段完成后由 AI 追加：日期 / 阶段 / 新增或修改的文件 / 已知问题 / tag 名）

2026-11-15 | 阶段5：主题切换系统 | 新增 frontend/src/lib/theme.ts、frontend/src/components/theme-provider.tsx、frontend/src/components/theme-toggle.tsx、frontend/src/components/ui/dropdown-menu.tsx；修改 frontend/index.html、frontend/src/main.tsx、frontend/src/App.tsx、frontend/src/index.css、frontend/src/pages/ReviewNotes.tsx | 无 | tag: v5-theme
2026-11-15 | 阶段6：导航栏布局优化 | 修改 frontend/src/App.tsx、frontend/src/pages/MetricsEntry.tsx | 无 | tag: v6-nav
2026-11-15 | 阶段7：数据模型重构 | 修改 main.go、internal/db/db.go、internal/model/model.go、internal/repository/repository.go、internal/service/service.go、internal/handler/handler.go | 无 | tag: v7-strategy-model
2026-11-15 | 阶段8：策略管理基础 UI + 指标录入改 id 选择 | 新增 frontend/src/api/strategies.ts、frontend/src/lib/http.ts、frontend/src/components/ui/{sonner,alert-dialog,command,dialog,popover,textarea,input-group}.tsx；修改 frontend/src/pages/MetricsEntry.tsx、frontend/src/pages/MetricsChart.tsx、frontend/src/api/metrics.ts、frontend/src/App.tsx、frontend/package.json | 无 | tag: v8-strategy-basic
2026-11-15 | 阶段9：策略编辑与改动记录 UI | 修改 frontend/src/api/strategies.ts、frontend/src/pages/MetricsEntry.tsx | 无 | tag: v9-strategy-edit
2026-11-15 | 阶段10：重构关联修复 | 修改 frontend/src/App.tsx、frontend/src/pages/MetricsChart.tsx、frontend/src/api/metrics.ts、frontend/src/components/ui/chart.tsx | 无 | tag: v10-refactor-fix
2026-11-15 | 阶段11：指标重复提交检测与修改交互 | 修改 frontend/src/lib/http.ts、frontend/src/api/metrics.ts、frontend/src/pages/MetricsEntry.tsx | 无 | tag: v11-dup-check

## 8. 协作流程与阶段结束约定

### 每个阶段开始前
- 先拉取仓库最新代码，然后读取本文件，确认技术栈、数据模型、API 契约和当前阶段进度。
- 只执行第 6 节中第一个未完成（非 PAUSED）的阶段，不修改已锁定项，不提前做后续阶段。

### 阶段完成后（固定动作，必须全部执行）
1. 自检该阶段验收标准，逐条确认通过。
2. 勾选第 6 节对应阶段为 `[x]`。
3. 在第 7 节追加一条变更记录，格式：`YYYY-MM-DD | 阶段X：名称 | 新增/修改文件清单 | 已知问题 | tag: <tag名>`。
4. 执行 git 提交、打 tag、推送：
    git add -A
    git commit -m "feat: 阶段X <阶段名>"
    git tag <本阶段指定 tag>
    git push
    git push --tags
5. 推送完成后在对话中汇报：验收结果、变更记录、commit hash、tag 名。

### 技术备注
- 若执行环境无仓库推送权限，第 4 步降级为：完成 `git add -A && git commit && git tag`，不执行 push，并在汇报中明确说明“已本地提交，未推送”，由开发者本地补推。
- 每次只执行一个阶段，完成后停止，等待下一条指令。
