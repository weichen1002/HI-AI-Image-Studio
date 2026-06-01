# N12.3 运营公告定向投放 Review

## 变更摘要

- 为 `announcements` 增加 `audience_json` 字段，并补齐迁移版本 `21`。
- 公告仓储支持 audience 规则保存、更新、返回、用户侧匹配和后台命中预览。
- 管理端新增 `POST /api/admin/announcements/audience/preview`，创建/编辑公告时可提交定向规则。
- 后台公告列表展示投放人群摘要，编辑弹窗支持状态、角色、注册时间和付费用户条件配置。
- 新增仓储测试覆盖全量展示、状态/角色/注册时间/付费匹配、命中预览和规则归一化。

## 审查结论

- Critical: 无。
- Warning: 无。
- Info: audience 规则在 controller 和 repo 各做了一层归一化，当前能保证 API 输入和数据库读取都安全收敛；后续如果定向条件继续扩展，可抽到共享 helper 减少重复。

## 验证

- `npm test --prefix server -- --runInBand` 通过：29 suites / 116 tests。
- `npm run build` 通过。
- `npm run smoke:frontend` 通过：67 assets checked。
- `git diff --check` 通过。

## 备注

- 本任务按用户要求未提交、未归档。
