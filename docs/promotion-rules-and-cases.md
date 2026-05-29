# Promotion Rules And Cases

## 目的

这份文档回答两件事：

- candidate 在什么条件下会被 `accepted / needs_confirmation / reinforce_existing / rejected / conflicted`
- 五类长期记忆分别怎么判

## 通用状态

`v1` 使用以下状态：

- `candidate`
- `needs_confirmation`
- `reinforce_existing`
- `accepted`
- `rejected`
- `conflicted`

## 通用硬规则

以下情况直接 `rejected`：

- 没有证据
- 纯过程痕迹
- 仅有弱推测，没有结构或行为支撑
- 含敏感信息
- 无法回答 `why_store`

## 通用决策流程

```text
if violates_hard_rules(candidate):
  return rejected

if conflicts_existing_memory(candidate):
  return conflicted

if reinforces_existing_memory(candidate):
  return reinforce_existing

score = compute_score(candidate)

if score >= ACCEPT_THRESHOLD and evidence_is_strong(candidate):
  return accepted

if score >= HOLD_THRESHOLD:
  return needs_confirmation

return rejected
```

## 通用阈值建议

`v1` 建议先用保守阈值：

- `ACCEPT_THRESHOLD = 0.75`
- `HOLD_THRESHOLD = 0.55`

额外门槛：

- `evidence_strength >= 0.65`
- `sensitivity_risk < 0.30`

说明：

- 阈值只是初始值
- 后续要靠样例回放调参

## 五类记忆的晋升规则

### 1. `user_preference`

适合 `accepted` 的条件：

- 用户显式表达
- 或多个任务中反复体现同一偏好
- `why_store` 明确指向协作成本降低

适合 `needs_confirmation` 的条件：

- 只从行为猜测出来
- 只有一次暗示，没有重复出现

适合 `rejected` 的条件：

- 只是当前回合临时策略
- 只是情绪表达或一次性偏好

正例：

- `以后默认中文回复`
- `涉及重构先审方案再动代码`

反例：

- `这次先别写代码`
- `今天我有点急`

### 2. `project_constraint`

适合 `accepted` 的条件：

- 有明确结构证据或配置证据
- 或多源印证：用户 + 代码 / 文档 + 代码
- 违反它会直接增加错误或返工风险

适合 `needs_confirmation` 的条件：

- 结构上有收敛迹象，但还没形成稳定复用
- 只有局部实现，尚不足以说明“项目默认如此”

适合 `rejected` 的条件：

- 只是一次性实现细节
- 只有局部写法，没有形成项目级约束

正例：

- 默认按钮抽象优先复用 `BaseButton`
- 某接口契约固定为 POST 且不带 body

反例：

- 某页面里临时写了一个按钮组件
- 某目录里偶然放了一个工具函数

### 3. `technical_decision`

适合 `accepted` 的条件：

- 用户明确拍板
- 或已经大范围落地并通过验证

适合 `needs_confirmation` 的条件：

- 讨论倾向明显，但还没拍板
- 只在局部试验，还没有形成稳定方向

适合 `rejected` 的条件：

- 只是 brainstorming
- 只是 assistant 建议，用户没确认

正例：

- `主线改成 admission engine，不以存储为核心`
- `重构统一走 clean architecture`

反例：

- `我们也许可以试试这个方案`
- `感觉这个方向不错`

### 4. `recurring_failure_pattern`

适合 `accepted` 的条件：

- 错误模式重复出现 2 次以上
- 或 1 次但根因已确认、修复已验证

适合 `needs_confirmation` 的条件：

- 只有一次异常，且根因未锁定
- 只有症状，没有稳定修复路径

适合 `rejected` 的条件：

- 一次性故障
- 没有复现，没有根因

正例：

- 某类布局错乱通常由滚动层级错误导致
- 某 SDK 调用路径稳定失败

反例：

- 今天构建失败了一次
- 某命令刚才超时

### 5. `domain_fact`

适合 `accepted` 的条件：

- 有文档、代码或稳定口径支持
- 被多处以同一语义使用

适合 `needs_confirmation` 的条件：

- 只是一次临时理解
- 只有局部实现，没有稳定依据

适合 `rejected` 的条件：

- 模糊业务猜测
- 会议信息未确认

正例：

- 某字段在系统中的正式业务含义
- 某角色名称的统一口径

反例：

- 我猜这个字段是给老师用的
- 这次讨论里我们先这么理解

## `reinforce_existing` 规则

以下情况应优先补强旧 memory，而不是新建：

- claim 语义相同
- scope 一致
- 新证据只是增强已有结论
- 新趋势继续强化已有约定

典型场景：

- `BaseButton` 的使用点继续增加
- 同一用户偏好又出现一次
- 同一错误模式再次复现并验证

## `conflicted` 规则

以下情况应标为冲突：

- 新 claim 与旧 memory 在同一 scope 下含义相反
- 新证据说明旧规则已不再成立
- 新趋势明显反向演化

典型场景：

- 原来默认使用 `BaseButton`，但后续项目开始统一改用 `AppButton`
- 原来约束为 `POST` 无 body，后续接口契约正式改版

## `BaseButton` 判定案例

### Case A: 刚创建组件

输入：

- 新建 `BaseButton.vue`
- 放在 `shared/ui`
- 尚无业务页面使用

决策：

- `needs_confirmation`

原因：

- 有结构证据
- 没有行为收敛
- 还不能说明它已经成为项目默认抽象

### Case B: 出现项目级复用

输入：

- 公共导出
- 最近 8 个新页面中有 7 个使用
- 2 处旧实现被替换

决策：

- `accepted`

原因：

- 结构证据强
- 行为证据强
- 已经能稳定压缩为项目约束

### Case C: 被新抽象替代

输入：

- 新增 `AppButton`
- 新代码开始统一使用 `AppButton`
- `BaseButton` 使用点逐步减少

决策：

- 旧 memory：`superseded`
- 新 candidate：根据证据进入 `needs_confirmation` 或 `accepted`

## 用户偏好判定案例

### Case A: 用户明确表达

输入：

- 用户说：`以后默认中文回复`

决策：

- `accepted`

原因：

- 显式强证据
- why_store 明确

### Case B: 只有行为暗示

输入：

- 用户多次把英文回复纠正成中文
- 但从未直接说过

决策：

- 先 `needs_confirmation`
- 重复出现后再 `accepted`

## 故障模式判定案例

### Case A: 单次 500

输入：

- 某接口出现一次 500
- 没有根因

决策：

- `rejected` 或 `needs_confirmation`

### Case B: 两次相同根因

输入：

- 同一错误模式重复出现
- 都指向相同根因

决策：

- `accepted`

## 落地建议

如果现在开始写代码，这份文档最直接的用途是：

- 为 `promotion/decide.ts` 提供规则表
- 为测试样例提供正反例
- 为回放调参提供基准集

没有这份规则和案例，代码很容易写成：

- 规则漂移
- 阈值拍脑袋
- 每改一次逻辑就破坏旧行为
