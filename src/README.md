# Source Layout

`src/` 后续只围绕 [memory-plane-blueprint.md](/Volumes/code/memory-plane/docs/memory-plane-blueprint.md) 落实现。

当前推荐拆分：

- `events/`
  - 负责原始输入归一化为结构化 `event`
- `detectors/`
  - 负责从 `event` 中提取各类 `candidate`
- `rules/`
  - 负责硬规则门禁和风险过滤
- `scoring/`
  - 负责特征评分和 `promotion_score`
- `promotion/`
  - 负责状态机、去重、合并、强化、冲突处理
- `recall/`
  - 负责正式长期记忆的检索和排序

当前目录仍作为实现占位，具体代码将按 blueprint 逐步落地。
