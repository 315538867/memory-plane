# Memory Plane

`memory-plane` 当前的唯一主方案文档是：

- [docs/memory-plane-blueprint.md](/Volumes/code/memory-plane/docs/memory-plane-blueprint.md)
- [docs/schemas.md](/Volumes/code/memory-plane/docs/schemas.md)
- [docs/feature-catalog.md](/Volumes/code/memory-plane/docs/feature-catalog.md)
- [docs/promotion-rules-and-cases.md](/Volumes/code/memory-plane/docs/promotion-rules-and-cases.md)

这些文档分别定义：

- `blueprint`
  - 系统主线：隔离、分层、压缩
- `schemas`
  - 核心对象字段
- `feature catalog`
  - 特征字典
- `promotion rules and cases`
  - 晋升规则、阈值和样例

当前主线不是“先选存储”，而是：

- 先做长期记忆准入与晋升机制
- 再接正式存储、recall 和其他扩展层

最小闭环验证：

- 运行 `npm run demo`
- 当前会验证三类样例：
  - 用户显式偏好 -> `accepted`
  - 推测型偏好 -> 不产出长期记忆
  - 弱 `BaseButton` 约定 -> `needs_confirmation`
  - 强 `BaseButton` 约定 -> `accepted`
  - 局部 `LocalButton` 噪声 -> 不产出长期记忆

离线评估：

- 运行 `npm run eval`
- 评估器会基于 `src/eval/evaluator-cases.json` 批量回放样例
- 当前输出：
  - 每个 case 的预测与通过/失败
  - `accepted` 类别的 `precision / recall / f1`
  - 总体通过率

仓库快照验证：

- 运行 `npm run demo:repo -- --repo ./examples/repo-fixture --component BaseButton`
- 该命令会从目标仓库采集结构信号和使用信号，并走同一条 admission pipeline
- 可选参数：
  - `--history-days <N>` 历史窗口天数，默认 `30`
  - `--max-commits <N>` 最大扫描提交数，默认 `120`
- 当目标目录可用 git 历史时，会启用 `git-history-window` 行为证据；否则自动降级到快照模式
- 当前 `v1` 判定偏保守，在证据不充分时会输出 `needs_confirmation`
