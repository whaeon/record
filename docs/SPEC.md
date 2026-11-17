# SPEC · 产品规格

> 最后更新：2026-11-16
> 本文件是技术栈、数据模型、API 契约的唯一来源。变更必须同步本文件并在 CHANGELOG 记录。
> 字段标注：［已确认］当前生效 ｜［待实现］已定义、尚未落地
> 接口标注：［已实现］当前生效 ｜［待实现］已定义、尚未落地

## 运行形态
当前单用户、公网可部署。Docker Compose 三容器 Web 形态（db / api / web），浏览器访问 web。改数据必须登录；不开放注册。账号由启动环境变量写入：`INITIAL_USERNAME`（缺省 `admin`）+ `INITIAL_PASSWORD`（必填，空则 api 拒绝启动）。`DEFAULT_USER_ID` 仅用于首次建 schema 的用户 id（缺省 1），不再作为鉴权旁路。未来可选 Wails 打包为桌面应用（PAUSED）。

## 技术栈登记

登记制：代码与本表必须一致。任务更换技术栈时，同一任务内改「活跃 / 已弃用」，并在 CHANGELOG 说明。

### 活跃
- 后端：Go 1.25 + Gin
- 数据库：PostgreSQL 16；驱动 `github.com/jackc/pgx/v5/stdlib`（database/sql，禁止 ORM）
- 连接：环境变量 `DATABASE_URL`；缺省 `postgres://record:record@127.0.0.1:5432/record?sslmode=disable`
- 默认用户 id：环境变量 `DEFAULT_USER_ID`；缺省 `1`。仅用于首次创建 `public.users` 行与 `user_<id>` schema
- 初始账号：`INITIAL_USERNAME`（缺省 `admin`）、`INITIAL_PASSWORD`（必填）。仅当该用户 `password_hash` 仍为空时写入，已有密码则忽略环境变量
- 会话：Cookie 名 `sid`，HttpOnly、SameSite=Lax、Path=/；签名密钥 `SESSION_SECRET`（缺省每次启动随机，重启后需重新登录）
- 密码哈希：bcrypt（`golang.org/x/crypto/bcrypt`）
- 备份：启动时与每小时检查；当日尚无文件则 `pg_dump` 到 `BACKUP_DIR`（缺省 `backups/`），文件名 `record-YYYY-MM-DD.sql`，保留最近 14 份；失败只记日志，不阻塞启动。`pg_dump` 主版本须与服务器一致（Compose api 镜像安装 `postgresql-client-16`）
- 编排：Docker Compose（db healthcheck `pg_isready`；api `depends_on: condition: service_healthy`；api 连库 5 次退避重试后退出，不得 panic）
- 前端：React 19 + TypeScript + Vite
- 样式：Tailwind CSS（dark mode 使用 class 策略）
- UI 组件：shadcn/ui（通过 CLI 添加）
- 图表：优先 @tremor/react；双 Y 轴无法实现时回退 shadcn/ui chart（Recharts）
- Markdown：react-markdown + remark-gfm + remark-breaks；预览区使用 @tailwindcss/typography 的 prose 类
- 图标：lucide-react
- 桌面壳（PAUSED）：Wails v2

### 已弃用
- SQLite（含 `modernc.org/sqlite`、`mattn/go-sqlite3`）
- 项目根目录 `data.db` / `%APPDATA%\TradeReview\data.db` 作为主库
- `PRAGMA foreign_keys = ON;` 作为连接初始化步骤

### 禁止引入
Echo / Ent / MongoDB / Ant Design / MUI / Chakra / 任何 WYSIWYG 富文本编辑器（TipTap / Lexical / Milkdown / ProseMirror）。

## 模块划分
1. 策略回顾：今日指标条 + 历史图表工作台；指标录入与策略 CRUD 为页内弹窗，无独立策略页、无每日明细表
2. 复盘记录：按日期的 Markdown 编辑与预览，左侧记录列表
3. 全局：三主题切换（跟随系统/黑夜/白天，默认跟随系统）；导航两项：策略回顾 / 复盘记录；未登录进入登录页，业务页不可用；导航提供退出

## 后端分层
handler（路由与参数校验） / service（业务与计算） / repository（数据访问）

## 前端目录
src/pages, src/components, src/api

## 为未来预留的架构决策（当前不实现，但不得设计成阻碍它们）
- 指标数据存在「手动录入」与「自动计算」两种来源，数据模型需能区分（见下文 source 字段）。
- 日期体系走内置 A 股交易日历（周末 + 法定节假日对应休市），录入默认日期仍为当天自然日。
- 导航栏右侧为工具区，未来扩展通知铃铛与任务状态，业务菜单不占右侧。
- 策略的「人类可读说明」与「可执行策略参数」在概念上分离，后者未来另开字段或另开表，不混入 current_detail。

## SQL 方言（PostgreSQL）
- 主键：`INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
- 占位符：`$1` / `$2` / …
- 时间与日期字段仍为 TEXT，语义不变（ISO8601 / YYYY-MM-DD）
- 外键、UNIQUE、索引定义与字段语义见各表

## 多用户架构［已确认］
- 每个用户对应一个独立 PostgreSQL schema，命名规则 `user_<id>`（例如 `user_1`）。
- `public.users` 存用户元数据与登录凭证；业务四表（strategies / strategy_revisions / strategy_metrics / review_notes）建在该用户 schema 内。
- 建表脚本参数化：传入 schema 名执行，repository 不硬编码 schema 名。
- 请求级 `search_path` 指向当前用户 schema；数据访问走当前请求绑定的连接。
- auth 为可插拔中间件：Cookie 会话鉴权；除 `POST /api/login` 外全部 `/api/*` 未登录返回 401。handler / service 业务逻辑不感知认证方式。
- 不开放注册。启动时若默认用户不存在，插入 `public.users`、创建 `user_<id>` schema 并建表；`password_hash` 为空时用 `INITIAL_PASSWORD` 写入 bcrypt 哈希。
- `GET /api/me` 返回当前登录用户；未登录 401。

## 数据模型

### users（用户，public schema）［已确认］
- id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
- name TEXT NOT NULL　—— 显示名
- username TEXT NOT NULL UNIQUE
- password_hash TEXT NOT NULL DEFAULT ''　—— bcrypt；空表示尚未写入初始密码
- created_at TEXT NOT NULL（ISO8601）
- 规则：业务数据不落在本表；本表仅作用户身份、登录凭证与 schema 对应
- 规则：不提供注册接口；密码不以明文写入仓库或日志

### strategies（交易策略，可改名）［已确认］
- id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
- name TEXT NOT NULL UNIQUE
- current_detail TEXT NOT NULL　—— 仅存人类可读的策略说明；未来可执行参数另开字段/表
- is_active BOOLEAN NOT NULL DEFAULT TRUE　—— 停用后仍保留历史指标，但不出现在录入选项
- created_at TEXT NOT NULL（ISO8601）
- updated_at TEXT NOT NULL（ISO8601）
- 规则：name 可修改，改成已存在名称时接口返回 409
- 规则：current_detail 发生变化时，自动向 strategy_revisions 插入新版本
- 规则：删除必须带 confirm=true，级联删除关联 metrics 与 revisions
- 规则：停用不删除历史指标；图表筛选仍显示停用策略

### strategy_revisions（策略内容改动记录）［已确认］
- id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
- strategy_id INTEGER NOT NULL（FK strategies.id ON DELETE CASCADE）
- detail TEXT NOT NULL　—— 该版本完整内容快照
- note TEXT NOT NULL DEFAULT ''　—— 本次改动说明（可选）
- changed_at TEXT NOT NULL（ISO8601）
- 索引：idx_revisions_strategy (strategy_id, changed_at)
- 规则：创建策略时自动插入首条；只改名不改内容不生成；内容未变不生成

### strategy_metrics（策略每日指标）［已确认］
- id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
- date TEXT NOT NULL（YYYY-MM-DD）
- strategy_id INTEGER NOT NULL（FK strategies.id ON DELETE CASCADE）
- total_picks INTEGER NOT NULL DEFAULT 0
- limit_up_count INTEGER NOT NULL DEFAULT 0
- failed_limit_count INTEGER NOT NULL DEFAULT 0
- source TEXT NOT NULL DEFAULT 'manual'　—— manual / auto，区分手动录入与自动计算
- UNIQUE(date, strategy_id)
- 索引：idx_metrics_date_strategy (date, strategy_id)
- 规则：只存 strategy_id，展示时 JOIN strategies 取当前名称；策略改名后历史指标显示新名称（已确认接受）
- 规则：PUT 更新时若原 source 为 auto，更新后置为 manual

### review_notes（复盘记录）［已确认］
- id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
- date TEXT NOT NULL UNIQUE（YYYY-MM-DD）
- content TEXT NOT NULL DEFAULT ''
- updated_at TEXT NOT NULL（ISO8601）

### 派生指标（不存库，后端实时计算）
- 摸板总数 touch_count = limit_up_count + failed_limit_count（不存库）
- seal_rate = touch_count > 0 ? limit_up_count / touch_count : 0
- break_rate = touch_count > 0 ? failed_limit_count / touch_count : 0
- total_picks 只表示筛出数，不作封板率/炸板率分母

### 交易日历（内置，非用户 schema）［已确认］
- 覆盖 2020-01-01～2028-12-31 上交所/深交所交易日
- 周末休市；国务院放假安排对应的 A 股休市日休市；调休后的工作日为交易日（周末补班仍休市）
- 数据随仓库发布，只读内置表，启动不依赖外网
- 规则：录入默认日期 = 打开时的当天（自然日），不改为上一交易日
- 规则：上一交易日 / 近 N 交易日 / 本月区间均按本日历计算

### 未来可能新增（当前不建表，仅记录方向）
- 策略可执行参数（结构化配置）
- 通知事件与通知规则
- 自动化任务执行记录
详见 QUEUE.md 想法池。

## API 契约

### 策略
- GET    /api/strategies ［已实现］　返回全部策略（含停用），含 is_active
- POST   /api/strategies ［待实现］　name 重复 409；current_detail 空 400；成功后同时插入首条 revision；is_active 默认 true
- GET    /api/strategies/:id ［待实现］
- PUT    /api/strategies/:id ［待实现］　改名冲突 409；内容变化插入新 revision（可带 note）；更新 updated_at
- PUT    /api/strategies/:id/active ［已实现］　body `{ "is_active": true|false }`；停用不删历史数据、不生成 revision
- DELETE /api/strategies/:id?confirm=true ［待实现］　未带 confirm 且存在关联数据 409；带 confirm 级联删除
- GET    /api/strategies/:id/revisions ［待实现］　changed_at 倒序

### 指标
- GET  /api/metrics?from=&to=&strategy_id= ［已实现］　strategy_id=all 按日聚合三列求和并重算 seal_rate/break_rate（当日任一条 source=auto 则聚合 source=auto）；省略或数字为单策略/未筛选明细；返回体含 seal_rate、break_rate、strategy_name（JOIN 当前名）、source
- POST /api/metrics ［待实现］　date+strategy_id 冲突 409 + 已有记录体（含 id）
- PUT  /api/metrics/:id ［待实现］
- GET  /api/metrics/dates ［待实现］　已有指标日期，升序去重

### 复盘
- GET /api/notes/:date ［已实现］　不存在返回 200 + 空 content
- PUT /api/notes/:date ［已实现］　upsert
- GET /api/notes ［待实现］　复盘记录列表（date、摘要、updated_at），date 倒序

### 日历
- GET /api/calendar?from=&to= ［已实现］　返回 `{date, is_trading_day}` 列表；from/to 缺省为 2020-01-01 / 2028-12-31；非法日期 400

### 认证
- POST /api/login ［已实现］　body `{username, password}`；成功 Set-Cookie HttpOnly、SameSite=Lax、Path=/，返回当前用户；失败 401
- POST /api/logout ［已实现］　清除 Cookie
- GET  /api/me ［已实现］　返回当前用户 `{id, username, name}`；未登录 401
- 除 login 外全部 `/api/*` 走 Cookie 鉴权；未登录 401。无注册接口

### 导出
- GET /api/export/metrics.csv ［已实现］　当前用户 schema 全部指标，CSV 含表头（UTF-8 BOM）
- GET /api/export/notes.md ［已实现］　当前用户 schema 全部复盘，zip（每日一个 .md）

### 通用约定
- 错误响应统一为 `{ "error": "...", "code": "..." }`
- 冲突响应（409）需在 body 中携带足够前端做决策的上下文（如已有记录的 id 与关键数字）
