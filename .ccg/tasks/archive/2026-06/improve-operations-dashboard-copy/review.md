# Review

## Self Review

- Critical: none found.
- Warning: 运营看板汇总接口已经接入，但当前浏览器连接的是旧后端进程时会暂时看到接口不存在；重启后端后生效。
- Info: “投放活动”已统一改成“运营活动”，并补充了计划单解释、落地步骤和运营场景说明。

## Verification

- `npm run build` passed.
- Browser verified `/studio/admin/operation-campaigns` shows “运营活动是什么？”、“一次运营动作的计划单”和“创建运营活动”。
- Browser verified `/studio/admin/operations` shows “当前运营状态”、“常见运营动作怎么落地”、“运营工具入口” sections.
