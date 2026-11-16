# 06 · 迭代变更记录

> 最后更新：2026-11-16 ｜ 只增不改，最新记录在最上方。
> 记录格式：`日期 ｜ 任务ID：名称 ｜ 改动文件 ｜ 验收结果 ｜ 已知问题 ｜ 契约变更（如有）`
> 超过约 300 行时，把更早的记录按年归档到 docs/archive/。

## 2026-11

- 2026-11-16 ｜ T-14：PostgreSQL 容器化 + repository 层迁移 ｜ docker-compose.yml、Dockerfile、frontend/Dockerfile、frontend/nginx.conf、internal/db、internal/repository、internal/service、main.go、go.mod、scripts/、docs/01、docs/02、docs/04、.gitignore ｜ 验收通过 ｜ pgloader 无法直接写入 GENERATED ALWAYS 列，导入时需短暂改为 BY DEFAULT 并在结束后 setval；本机需 Compose v2（1.29 的 http+docker 不可用） ｜ 无 API 路径/参数变更；数据层方言 SQLite → PostgreSQL；01 技术栈同步；04 增补执行冲突处理
- 2026-11-16 ｜ 文档体系重构 ｜ AGENTS.md、docs/01–07 ｜ 约定/数据/接口/进度/变更/待办分离 ｜ 无 ｜ 无契约变更
- （阶段 0–3 的记录按同格式补录在此下方）
