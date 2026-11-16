# CHANGELOG · 迭代变更记录

> 最后更新：2026-11-16 ｜ 只增不改，最新记录在最上方。
> 记录格式：`日期 ｜ 任务ID：名称 ｜ 改动文件 ｜ 验收结果 ｜ 已知问题 ｜ 契约变更（如有）`
> 超过约 300 行时，把更早的记录按年归档到 docs/archive/。

## 2026-11

- 2026-11-16 ｜ T-20：全策略汇总视图 ｜ internal/{repository,service}、frontend/src/{pages/MetricsChart,pages/ReviewNotes,api/metrics,lib/nav}.ts、docs/SPEC.md ｜ 验收通过 ｜ 无 ｜ GET /api/metrics 的 strategy_id=all 按日聚合
- 2026-11-16 ｜ T-19：数据备份与导出 ｜ internal/backup、internal/handler、internal/service、main.go、Dockerfile、docker-compose.yml、frontend/src/{App.tsx,components/export-menu.tsx}、docs/SPEC.md ｜ 验收通过 ｜ 无 ｜ 新增 GET /api/export/metrics.csv、GET /api/export/notes.md
- 2026-11-16 ｜ T-18：图表与复盘双向联动 ｜ frontend/src/pages/{MetricsChart,ReviewNotes}.tsx、frontend/src/lib/nav.ts ｜ 验收通过 ｜ 无 ｜ 无 API 路径/参数变更、无数据结构变更
- 2026-11-16 ｜ T-17：指标批量录入 ｜ frontend/src/pages/MetricsEntry.tsx ｜ 验收通过 ｜ 无 ｜ 无 API 路径/参数变更、无数据结构变更
- 2026-11-16 ｜ T-16：手机端响应式适配 ｜ frontend/src/App.tsx、frontend/src/pages/{MetricsChart,MetricsEntry,ReviewNotes}.tsx、frontend/src/components/{date-picker,ui/button,ui/input}.tsx、frontend/src/index.css、frontend/src/hooks/use-media-query.ts ｜ 验收通过 ｜ 无 ｜ 无 API 路径/参数变更、无数据结构变更
- 2026-11-16 ｜ T-15：多用户 schema 隔离 + 默认用户免登录 ｜ internal/auth、internal/db、internal/repository、internal/handler、internal/service、main.go、docker-compose.yml、docs/SPEC.md ｜ 验收通过 ｜ 本环境无 Docker，按 WORKFLOW C 用本机 PostgreSQL 15 等价验证；`docker compose up` 待有 Docker 的环境再跑 ｜ 新增 public.users 与 user_<id> schema 隔离；auth 中间件读 DEFAULT_USER_ID（缺省 1）；无 API 路径/参数变更
- 2026-11-16 ｜ T-14b：文档体系收缩与 SPEC 合并 ｜ AGENTS.md、docs/SPEC.md、docs/WORKFLOW.md、docs/QUEUE.md、docs/CHANGELOG.md（由 01–05、07 收缩；06 仅顶部追加后改名为 CHANGELOG） ｜ 待验收 ｜ 无 ｜ 文档体系收缩 7→4；修正 T-14 遗留的 01 文档脱节；规则从锁定制改为登记制；无 API 路径/参数变更、无表结构语义变更
- 2026-11-16 ｜ T-14：PostgreSQL 容器化 + repository 层迁移 ｜ docker-compose.yml、Dockerfile、frontend/Dockerfile、frontend/nginx.conf、internal/db、internal/repository、internal/service、main.go、go.mod、scripts/、docs/01、docs/02、docs/04、.gitignore ｜ 验收通过 ｜ pgloader 无法直接写入 GENERATED ALWAYS 列，导入时需短暂改为 BY DEFAULT 并在结束后 setval；本机需 Compose v2（1.29 的 http+docker 不可用） ｜ 无 API 路径/参数变更；数据层方言 SQLite → PostgreSQL；01 技术栈同步；04 增补执行冲突处理
- 2026-11-16 ｜ 文档体系重构 ｜ AGENTS.md、docs/01–07 ｜ 约定/数据/接口/进度/变更/待办分离 ｜ 无 ｜ 无契约变更
- （阶段 0–3 的记录按同格式补录在此下方）
