# 02 · 数据结构

> 最后更新：2026-11-16 ｜ 本文件是数据结构的唯一来源。
> 任何表结构变更必须同步更新本文件并在 06-changelog.md 记录。
> 字段标注：［已确认］当前生效 ｜［待实现］已定义、尚未落地

## strategies（交易策略，可改名）［已确认］
- id INTEGER PRIMARY KEY AUTOINCREMENT
- name TEXT NOT NULL UNIQUE
- current_detail TEXT NOT NULL　—— 仅存人类可读的策略说明；未来可执行参数另开字段/表
- created_at TEXT NOT NULL（ISO8601）
- updated_at TEXT NOT NULL（ISO8601）
- 规则：name 可修改，改成已存在名称时接口返回 409
- 规则：current_detail 发生变化时，自动向 strategy_revisions 插入新版本
- 规则：删除必须带 confirm=true，级联删除关联 metrics 与 revisions

## strategy_revisions（策略内容改动记录）［已确认］
- id INTEGER PRIMARY KEY AUTOINCREMENT
- strategy_id INTEGER NOT NULL（FK strategies.id ON DELETE CASCADE）
- detail TEXT NOT NULL　—— 该版本完整内容快照
- note TEXT NOT NULL DEFAULT ''　—— 本次改动说明（可选）
- changed_at TEXT NOT NULL（ISO8601）
- 索引：idx_revisions_strategy (strategy_id, changed_at)
- 规则：创建策略时自动插入首条；只改名不改内容不生成；内容未变不生成

## strategy_metrics（策略每日指标）［已确认］
- id INTEGER PRIMARY KEY AUTOINCREMENT
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

## review_notes（复盘记录）［已确认］
- id INTEGER PRIMARY KEY AUTOINCREMENT
- date TEXT NOT NULL UNIQUE（YYYY-MM-DD）
- content TEXT NOT NULL DEFAULT ''
- updated_at TEXT NOT NULL（ISO8601）

## 派生指标（不存库，后端实时计算）
- seal_rate = total_picks > 0 ? limit_up_count / total_picks : 0
- break_rate = (limit_up_count + failed_limit_count) > 0 ? failed_limit_count / (limit_up_count + failed_limit_count) : 0

## 未来可能新增（当前不建表，仅记录方向）
- 交易日历（完整版含节假日维护）
- 策略可执行参数（结构化配置）
- 通知事件与通知规则
- 自动化任务执行记录
详见 07-todos.md。
