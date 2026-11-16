# 01 · 架构与技术栈

> 最后更新：2026-11-16 ｜ 本文件为锁定项，变更需在 changelog 说明理由。

## 运行形态
Windows 本地、单用户、非公网部署。当前为 Docker Compose 三容器 Web 形态（db / api / web），浏览器访问 web。未来可选 Wails 打包为桌面应用（阶段 4，PAUSED）。

## 技术栈（锁定，不得擅自更换）
- 后端：Go 1.25 + Gin
- 数据库：PostgreSQL 16；驱动 `github.com/jackc/pgx/v5/stdlib`（database/sql，禁止 ORM）
- 连接：环境变量 `DATABASE_URL`；缺省 `postgres://record:record@127.0.0.1:5432/record?sslmode=disable`
- 编排：Docker Compose（db healthcheck `pg_isready`；api `depends_on: condition: service_healthy`；api 连库 5 次退避重试后退出，不得 panic）
- 前端：React 19 + TypeScript + Vite
- 样式：Tailwind CSS（dark mode 使用 class 策略）
- UI 组件：shadcn/ui（通过 CLI 添加）
- 图表：优先 @tremor/react；双 Y 轴无法实现时回退 shadcn/ui chart（Recharts）
- Markdown：react-markdown + remark-gfm；预览区使用 @tailwindcss/typography 的 prose 类
- 图标：lucide-react
- 桌面壳（阶段 4，PAUSED）：Wails v2

## 禁止引入
Echo / Ent / MongoDB / Ant Design / MUI / Chakra / 任何 WYSIWYG 富文本编辑器（TipTap / Lexical / Milkdown / ProseMirror）。

## 模块划分
1. 交易策略管理：策略实体（可改名）+ 内容改动记录
2. 指标录入与历史图表：按策略+日期录入指标，双 Y 轴折线图
3. 复盘记录：按日期的 Markdown 编辑与预览，左侧记录列表
4. 全局：三主题切换（跟随系统/黑夜/白天，默认跟随系统）

## 后端分层
handler（路由与参数校验） / service（业务与计算） / repository（数据访问）

## 前端目录
src/pages, src/components, src/api

## 为未来预留的架构决策（当前不实现，但不得设计成阻碍它们）
- 指标数据存在「手动录入」与「自动计算」两种来源，数据模型需能区分（见 02）。
- 日期体系未来将走交易日历，而非自然日。
- 导航栏右侧为工具区，未来扩展通知铃铛与任务状态，业务菜单不占右侧。
- 策略的「人类可读说明」与「可执行策略参数」在概念上分离，后者未来另开字段或另开表，不混入 current_detail。
