# 项目约定

## 1. 项目概述
个人交易复盘系统，单用户，Windows 本地运行，非多用户、非公网部署。
- 模块 1：板块每日指标录入 + 历史双 Y 轴折线图
- 模块 2：按日期的复盘记录 CRUD，支持 Markdown 左右分屏即时预览

## 2. 技术栈（锁定，不得擅自更换）
- 后端：Go 1.25 + Gin
- 数据库：SQLite，驱动必须使用 modernc.org/sqlite（纯 Go，禁止 mattn/go-sqlite3）
- 数据库文件：开发阶段为项目根目录 data.db；Wails 打包后为 %APPDATA%\TradeReview\data.db
- 前端：React 19 + TypeScript + Vite
- 样式：Tailwind CSS
- UI 组件：shadcn/ui（通过 CLI 添加，禁止引入传统黑盒组件库）
- 图表：优先 @tremor/react；若无法配置双 Y 轴折线图，回退到 shadcn/ui chart 组件（底层 Recharts）
- Markdown：react-markdown + remark-gfm；预览容器使用 @tailwindcss/typography 的 prose 类
- 桌面壳（仅阶段 4）：Wails v2
- 禁止引入：Echo / Ent / MongoDB / Ant Design / MUI / Chakra / 任何 WYSIWYG 富文本编辑器（TipTap / Lexical / Milkdown / ProseMirror）

## 3. 数据模型（SQLite）
### sector_metrics
- id INTEGER PRIMARY KEY AUTOINCREMENT
- date TEXT NOT NULL（YYYY-MM-DD）
- sector_name TEXT NOT NULL
- total_picks INTEGER NOT NULL DEFAULT 0
- limit_up_count INTEGER NOT NULL DEFAULT 0
- failed_limit_count INTEGER NOT NULL DEFAULT 0
- CREATE INDEX idx_metrics_date_sector ON sector_metrics(date, sector_name);

### review_notes
- id INTEGER PRIMARY KEY AUTOINCREMENT
- date TEXT NOT NULL UNIQUE（YYYY-MM-DD）
- content TEXT NOT NULL DEFAULT ''
- updated_at TEXT NOT NULL（ISO8601）

封板率、炸板率不存库，后端查询时实时计算：
- seal_rate = total_picks > 0 ? limit_up_count / total_picks : 0
- break_rate = (limit_up_count + failed_limit_count) > 0 ? failed_limit_count / (limit_up_count + failed_limit_count) : 0

## 4. API 契约（不得擅自增删字段）
POST /api/metrics           新增指标
GET  /api/metrics?from=&to=&sector=   按日期范围和板块查询，返回体附带 seal_rate、break_rate
GET  /api/notes/:date       查询某日复盘，不存在返回 200 + 空 content
PUT  /api/notes/:date       upsert 某日复盘

## 5. 编码规范
- 后端分层：handler / service / repository
- 前端目录：src/pages, src/components, src/api
- 不写单元测试，阶段内以本地 curl / 页面手动验证为准

## 6. 阶段进度
- [ ] 阶段 0：数据模型与项目骨架
- [ ] 阶段 1：Go 后端 API
- [ ] 阶段 2：前端模块 1（录入 + 双 Y 轴图表）
- [ ] 阶段 3：前端模块 2（复盘记录 Markdown 分屏预览）
- [ ] 阶段 4：Wails 桌面壳 + 开机自启

## 7. 变更记录
（每阶段完成后追加：日期 / 阶段 / 新增或修改的文件 / 已知问题）

## 8. 协作流程
- 每阶段开始前先读取本文件，只执行当前未完成阶段，不修改已锁定项。
- 阶段完成后：勾选第 6 节对应项，在第 7 节追加变更记录。
- AI 只负责生成代码和更新本文件；git commit 与 push 由本地开发者在验证通过后执行。
