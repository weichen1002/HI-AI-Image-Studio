# N9.1 Review

## 结果

- 新增 `PaymentProviderAdapter`、`MockPaymentProviderAdapter` 和 `PaymentProvidersService`。
- Mock webhook 的签名校验、payload 映射和 completion payload 生成从 controller 抽到 provider adapter。
- `BillingWebhookController` 改为通过 provider service 解析 mock webhook，再复用 `BillingService.completePaidOrder`。
- 后台 manual complete 仍保持原路径和行为。
- 新增 provider adapter 单测，覆盖签名通过、签名失败、body 内签名、未知渠道拒绝。
- 更新 controller 测试，确认 mock webhook 行为和日志仍保留。

## 验证

- `npm test --prefix server -- --runInBand`：通过，23 suites / 84 tests。
- `npm run build --prefix server`：通过。
- `git diff --check`：通过。

## 风险

- 未接入真实支付渠道，只建立 adapter 边界。
- Mock 签名规则保持 `orderId.paymentRef.amountCents.CURRENCY` 不变。
- 支付完成、幂等、金额/币种校验仍由 `BillingService.completePaidOrder` 统一处理。
- 当前任务按用户要求未归档、未提交。
