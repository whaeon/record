# 交易复盘

个人交易复盘系统（Windows 本地、单用户）。当前为手动录入版：策略回顾、每日指标、复盘记录。数据层 PostgreSQL 16，Docker Compose 编排 db / api / web。

规格与约定：`AGENTS.md` 入口；`docs/SPEC.md` 技术栈与数据/API；`docs/WORKFLOW.md` 协作流程；`docs/QUEUE.md` 任务队列；`docs/CHANGELOG.md` 变更记录。

## 一键启动（推荐）

需要本机已装 Docker 与 Compose v2。

必须设置 `INITIAL_PASSWORD`，否则 api 拒绝启动。

```bash
export INITIAL_PASSWORD=change-me
docker compose up --build -d
```

浏览器打开 http://localhost ，用 `INITIAL_USERNAME`（缺省 `admin`）和 `INITIAL_PASSWORD` 登录。不开放注册。

| 服务 | 端口 | 说明 |
|---|---|---|
| web | 80 | 前端；`/api` 反代到 api:8080 |
| api | 8080 | 后端 |
| db | 5432 | PostgreSQL 16，库/用户/密码均为 `record` |

数据在 Docker volume `pgdata`，备份目录挂载 `./backups`。`DEFAULT_USER_ID` 仅用于首次建 schema（缺省 1），不再免登录。已有密码后重启忽略环境变量中的密码。

```bash
docker compose ps
docker compose logs -f
docker compose down
```

只停容器、保留数据库：

```bash
docker compose down
```

连同数据卷一起清掉（会丢库）：

```bash
docker compose down -v
```

容器内 api 连库地址：

```
postgres://record:record@db:5432/record?sslmode=disable
```

## 本地开发（不走 Compose）

需本机已有 PostgreSQL 16，库名/用户/密码均为 `record`。

```bash
export DATABASE_URL=postgres://record:record@127.0.0.1:5432/record?sslmode=disable
export DEFAULT_USER_ID=1
export INITIAL_USERNAME=admin
export INITIAL_PASSWORD=change-me
go run .
```

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器默认把 `/api` 转到 `http://localhost:8080`。

## SQLite 迁移

若仍有旧 `data.db`：

```bash
./scripts/migrate-sqlite.sh
```

迁移前脚本会对 SQLite 做只读快照（目录 `backups/`，已 gitignore）。
