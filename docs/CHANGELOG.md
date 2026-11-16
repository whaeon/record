# CHANGELOG · 迭代变更记录

> 最后更新：2026-11-16 ｜ 只增不改，最新记录在最上方。
> 记录格式：`日期 ｜ 任务ID：名称 ｜ 改动文件 ｜ 验收结果 ｜ 已知问题 ｜ 契约变更（如有）`
> 超过约 300 行时，把更早的记录按年归档到 docs/archive/。

## 2026-11

- 2026-11-16 ｜ T-30：复盘默认预览 + 新建 ｜ frontend/src/{pages/ReviewNotes.tsx,lib/date.ts}、frontend/package.json、docs/SPEC.md ｜ 验收通过 ｜ 无 ｜ Markdown 栈增加 remark-breaks；无 API 路径/参数变更、无数据结构变更
- 2026-11-16 ｜ T-29：策略×指标分组小图 ｜ frontend/src/{pages/MetricsChart.tsx,components/date-picker.tsx,App.tsx,index.css,pages/ReviewNotes.tsx} ｜ 验收通过 ｜ 无 ｜ 无 API 路径/参数变更、无数据结构变更
- 2026-11-16 ｜ T-28：合并为策略回顾 ｜ frontend/src/{App.tsx,lib/nav.ts,pages/MetricsChart.tsx,pages/MetricsEntry.tsx,components/{today-stats,metrics-entry-dialog,strategy-manage-dialog}.tsx}、docs/SPEC.md ｜ 验收通过 ｜ 无 ｜ 无 API 路径/参数变更；模块划分改为策略回顾 + 复盘记录两导航；录入与策略 CRUD 改为页内弹窗；删除每日明细与独立 MetricsEntry 页
- 2026-11-16 ｜ T-27：删除/弃用代码必须清掉 ｜ docs/WORKFLOW.md ｜ 验收通过 ｜ 无 ｜ 无契约变更；编码规范新增：被替换实现须同一任务内删除
- 2026-11-16 ｜ T-26：source 字段前端展示 ｜ frontend/src/{api/metrics.ts,components/source-badge.tsx,pages/MetricsChart.tsx,pages/MetricsEntry.tsx}、internal/{db/schema.sql,model,repository}、docs/SPEC.md ｜ 验收通过 ｜ 无 ｜ GET /api/metrics 返回 source；strategy_id=all 当日任一条 auto 则聚合 source=auto
- 2026-11-16 ｜ T-25：空状态 / 加载 / 错误处理统一 ｜ frontend/src/{App.tsx,api,lib/http.ts,lib/notify.ts,components/{empty-state,skeletons,connection-banner,ui/empty,ui/skeleton},pages} ｜ 验收通过 ｜ 无 ｜ 无 API 路径/参数变更、无数据结构变更
- 2026-11-16 ｜ T-24：图表可读性强化 ｜ frontend/src/pages/MetricsChart.tsx ｜ 验收通过 ｜ 无 ｜ 无 API 路径/参数变更、无数据结构变更
- 2026-11-16 ｜ T-23：首屏核心指标条 ｜ frontend/src/{components/today-stats.tsx,pages/MetricsEntry.tsx,lib/date.ts} ｜ 验收通过 ｜ 基础交易日历为周一至周五，不含节假日 ｜ 无 API 路径/参数变更、无数据结构变更
- 2026-11-16 ｜ T-22：策略启用/停用 + 列表搜索 ｜ internal/{db/schema.sql,model,repository,service,handler}、frontend/src/{api/strategies.ts,pages/MetricsEntry.tsx,pages/MetricsChart.tsx}、docs/SPEC.md ｜ 验收通过 ｜ 无 ｜ strategies 增加 is_active；新增 PUT /api/strategies/:id/active
- 2026-11-16 ｜ T-21：图表时间范围快捷选择 ｜ frontend/src/lib/date.ts、frontend/src/pages/MetricsChart.tsx ｜ 验收通过 ｜ 基础交易日历为周一至周五，不含节假日 ｜ 无 API 路径/参数变更、无数据结构变更
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
