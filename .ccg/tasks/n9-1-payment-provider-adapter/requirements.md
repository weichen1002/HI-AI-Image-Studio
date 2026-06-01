# N9.1 支付渠道适配接口

## 目标

按 `docs/goal-mode-roadmap-next.md` 的 N9.1 执行：抽象 payment provider adapter，让 mock、manual 和未来真实渠道共用统一 payload 映射、验签结果和订单完成路径。

## 范围

- 新增 provider adapter 类型和 mock provider 实现。
- mock webhook 保持现有签名规则和响应行为。
- 后台 manual complete 保持现有行为，不强行接真实渠道。
- 不接入真实微信/支付宝/Stripe。

## 验收

- mock webhook 行为不变。
- adapter 单测覆盖签名通过、签名失败、payload 映射。
- billing 幂等和金额/币种拒绝测试仍通过。
- 完成后运行后端测试和构建。
