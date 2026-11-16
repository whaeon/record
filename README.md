# 交易复盘

个人交易复盘系统（Windows 本地、单用户）。当前为手动录入版：策略管理、每日指标、复盘记录。数据层为 PostgreSQL 16，Docker Compose 编排 db / api / web。

规格与约定：`AGENTS.md` 入口；`docs/SPEC.md` 技术栈与数据/API；`docs/WORKFLOW.md` 协作流程；`docs/QUEUE.md` 任务队列；`docs/CHANGELOG.md` 变更记录。

## 启动

```bash
docker compose up --build
```

浏览器访问 http://localhost （web:80，反代 `/api` 到 api:8080）。PostgreSQL 对外 5432。

环境变量 `DATABASE_URL` 缺省：

```
postgres://record:record@127.0.0.1:5432/record?sslmode=disable
```

容器内 api 使用 `postgres://record:record@db:5432/record?sslmode=disable`。

## 本地开发（不走 Compose）

需本机已有 PostgreSQL 16，库名/用户/密码均为 `record`。

```bash
# 后端 :8080
export DATABASE_URL=postgres://record:record@127.0.0.1:5432/record?sslmode=disable
go run .

# 前端
cd frontend
npm install
npm run dev
```

## SQLite 迁移

若仍有旧 `data.db`：

```bash
./scripts/migrate-sqlite.sh
```

迁移前脚本会对 SQLite 做只读快照（目录 `backups/`，已 gitignore）。
