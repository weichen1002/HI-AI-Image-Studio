# N8.2 Review

## 结果

- 图片任务队列增加结构化日志：入队、重复入队、取消、开始、完成、失败。
- 图片任务状态服务增加结构化日志：创建、运行、成功、失败。
- 图片任务取消和重试入口增加 `job:<jobId>` correlation id。
- 支付服务增加结构化日志：订单创建、支付完成开始、幂等完成、入账成功、拒绝/失败。
- Mock 支付回调增加验签失败、验签通过、处理完成日志。
- 新增和更新测试覆盖关键日志字段、`correlationId`、`jobId`、`orderId`、`ledgerEntryId` 和拒绝状态。

## 验证

- `npm test --prefix server -- --runInBand`：通过，22 suites / 80 tests。
- `npm run build --prefix server`：通过。
- `git diff --check`：通过。

## 风险

- 只增加日志副作用，没有改变 API 返回和数据库 schema。
- 日志通过现有 logger 脱敏；支付 webhook 没有记录签名或密钥。
- 当前任务按用户要求未归档、未提交。
