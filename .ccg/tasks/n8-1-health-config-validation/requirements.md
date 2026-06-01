# Requirements

按 `docs/goal-mode-roadmap-next.md` 的 N8.1 执行：

- 增加启动配置校验。
- 增加 `/api/health` 和 `/api/health/deep`。
- `/api/health/deep` 检测 SQLite 可查询、数据库目录可写、uploads 目录可写、HiAPI 配置是否存在。
- 不暴露任何 secret。
- 生产环境缺关键密钥时启动失败；本地开发和测试保持可运行。
