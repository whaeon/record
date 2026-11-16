# frontend

交易复盘 Web 前端：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui。

生产镜像由仓库根目录 `docker compose up` 构建（nginx 反代 `/api` 到 api 容器）。本地开发：

```bash
npm install
npm run dev
```

规格见仓库根目录 `docs/SPEC.md`。
