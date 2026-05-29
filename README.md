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
