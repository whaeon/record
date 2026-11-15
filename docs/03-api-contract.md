# 03 · API 契约

> 最后更新：2026-11-16 ｜ 本文件是 API 的唯一来源。
> 标注：［已实现］当前生效 ｜［待实现］已定义、尚未落地。
> 接口变更必须同步本文件并在 06-changelog.md 记录。

## 策略
- GET    /api/strategies ［待实现］
- POST   /api/strategies ［待实现］　name 重复 409；current_detail 空 400；成功后同时插入首条 revision
- GET    /api/strategies/:id ［待实现］
- PUT    /api/strategies/:id ［待实现］　改名冲突 409；内容变化插入新 revision（可带 note）；更新 updated_at
- DELETE /api/strategies/:id?confirm=true ［待实现］　未带 confirm 且存在关联数据 409；带 confirm 级联删除
- GET    /api/strategies/:id/revisions ［待实现］　changed_at 倒序

## 指标
- GET  /api/metrics?from=&to=&strategy_id= ［待实现］　返回体含 seal_rate、break_rate、strategy_name（JOIN 当前名）、source
- POST /api/metrics ［待实现］　date+strategy_id 冲突 409 + 已有记录体（含 id）
- PUT  /api/metrics/:id ［待实现］
- GET  /api/metrics/dates ［待实现］　已有指标日期，升序去重

## 复盘
- GET /api/notes/:date ［已实现］　不存在返回 200 + 空 content
- PUT /api/notes/:date ［已实现］　upsert
- GET /api/notes ［待实现］　复盘记录列表（date、摘要、updated_at），date 倒序

## 通用约定
- 错误响应统一为 `{ "error": "...", "code": "..." }`
- 冲突响应（409）需在 body 中携带足够前端做决策的上下文（如已有记录的 id 与关键数字）
