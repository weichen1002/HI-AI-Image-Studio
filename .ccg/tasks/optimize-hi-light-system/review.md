# Review

## Result

No blocking issue found.

## Notes

- 新增投稿能力放在服务端校验，不依赖前端信任。
- `message.submissionStatus` 让前端能显示待审核/已公开/已拒绝。
- 构建过程中发现正式目录 esbuild 二进制被 SIGKILL，删除 `node_modules/esbuild node_modules/@esbuild` 后重新 `npm install` 已恢复。
