# Feature Catalog

## 目的

这份文档定义：

- admission engine 到底提取哪些特征
- 每个特征从哪里来
- 每个特征怎么解释

这里不讨论最终代码实现细节，只固定“特征字典”。

## 特征分层

`v1` 只使用三类特征：

- `explicit features`
- `structural features`
- `behavioral features`

原则：

- 关键词只是 `explicit features` 的一个低层子特征
- 真正高价值的隐式约定主要依赖 `structural + behavioral`

## `explicit features`

### `is_user_authored`

含义：

- 证据是否来自用户显式表达

来源：

- `user_message`

取值：

- `0` 或 `1`

### `is_definition_statement`

含义：

- 是否为定义句、口径句、正式说明句

来源：

- `user_message`
- `document_fragment`
- `config_fragment`

取值：

- `0` 或 `1`

### `is_decision_statement`

含义：

- 是否为决策确认句

例子：

- `就按这个走`
- `统一改成`
- `以后按这个来`

取值：

- `0` 或 `1`

### `contains_constraint_cue`

含义：

- 是否包含限制性 cue

例子：

- `必须`
- `不能`
- `禁止`
- `只能`

说明：

- 只是辅助特征，不能单独决定晋升

### `contains_preference_cue`

含义：

- 是否包含偏好型 cue

例子：

- `偏向`
- `更希望`
- `默认`
- `先...再...`

### `contains_speculation_cue`

含义：

- 是否包含弱推测 cue

例子：

- `可能`
- `我猜`
- `似乎`
- `估计`

作用：

- 提高 `speculation_risk`

### `explicit_support_score`

含义：

- 当前显式证据总体强度

建议计算：

- 用户显式表达 > 文档定义 > assistant 表述 > 注释暗示

取值范围：

- `0.0 - 1.0`

## `structural features`

### `is_in_shared_layer`

含义：

- 是否位于公共基础层或共享层

例子：

- `src/shared`
- `src/ui`
- `components/base`

取值：

- `0` 或 `1`

### `is_exported_from_public_entry`

含义：

- 是否由公共入口统一导出

例子：

- `index.ts`
- `shared/ui/index.ts`

取值：

- `0` 或 `1`

### `wraps_lower_level_primitive`

含义：

- 是否包装底层原语或基础能力

例子：

- `BaseButton` 包装原生 `button`
- `HttpClient` 包装底层请求库

取值：

- `0` 或 `1`

### `reference_count`

含义：

- 被多少处引用

来源：

- import graph

取值：

- 整数

### `reference_spread`

含义：

- 引用是否分布在多个业务模块，而不是只在一个局部使用

取值：

- `0.0 - 1.0`

### `has_supporting_assets`

含义：

- 是否配套测试、文档、story、token、示例

取值：

- `0.0 - 1.0`

### `is_unique_entrypoint`

含义：

- 是否已经成为某类能力的主要公共入口

例子：

- 默认按钮入口
- 默认请求客户端入口

取值：

- `0.0 - 1.0`

### `structural_support_score`

含义：

- 结构证据总体强度

建议计算依据：

- 公共层位置
- 导出方式
- 引用规模
- 支撑资产完整度

取值范围：

- `0.0 - 1.0`

## `behavioral features`

### `new_usage_count`

含义：

- 在观察窗口内，新代码新增了多少次该抽象的使用

取值：

- 整数

### `replacement_count`

含义：

- 旧实现被替换成当前抽象的次数

例子：

- 原生 `button` 被替换成 `BaseButton`

取值：

- 整数

### `reuse_trend_score`

含义：

- 新代码是否明显持续复用该抽象

取值：

- `0.0 - 1.0`

### `convergence_trend_score`

含义：

- 旧代码是否在向该抽象收敛

取值：

- `0.0 - 1.0`

### `correction_trend_score`

含义：

- 偏离该抽象的实现是否被持续修正

取值：

- `0.0 - 1.0`

### `failure_recurrence_count`

含义：

- 某错误模式重复出现次数

取值：

- 整数

### `fix_reuse_count`

含义：

- 某修复路径重复成功次数

取值：

- 整数

### `behavioral_support_score`

含义：

- 行为证据总体强度

建议计算依据：

- 新增复用
- 旧实现收敛
- 替换路径
- 错误/修复复现

取值范围：

- `0.0 - 1.0`

## 风险特征

### `speculation_risk`

含义：

- 当前候选是否建立在推测之上

来源：

- 弱推测 cue
- 缺乏结构/行为支撑

取值：

- `0.0 - 1.0`

### `sensitivity_risk`

含义：

- 是否包含敏感信息、隐私或不应长期保存的内容

取值：

- `0.0 - 1.0`

### `wrong_if_false_cost`

含义：

- 如果这条记忆错了，会不会显著误导未来动作

例子：

- 项目约束误判通常代价较高
- 某些用户偏好误判代价较低

取值：

- `0.0 - 1.0`

## 聚合特征

### `cross_source_count`

含义：

- 同一候选被多少不同来源共同支持

例子：

- 用户消息 + 代码结构
- 文档 + 测试结果

取值：

- 整数

### `evidence_count`

含义：

- 支撑当前 candidate 的证据数

取值：

- 整数

### `evidence_strength`

含义：

- 支撑证据总体质量

建议计算：

- 单条 evidence 强度加权聚合

取值：

- `0.0 - 1.0`

### `novelty`

含义：

- 当前候选是否为新信息，而不是旧记忆的重复表达

取值：

- `0.0 - 1.0`

### `recurrence`

含义：

- 当前模式出现频率和重复强度

取值：

- `0.0 - 1.0`

## 与评分的关系

`feature` 不是 `score`，但会驱动 score。

推荐的主要 score 维度：

- `stability`
- `reusability`
- `actionability`
- `evidence_strength`
- `novelty`
- `recurrence`
- `wrong_if_false_cost`
- `sensitivity_risk`

示意关系：

- `explicit_support_score` 会影响 `evidence_strength`
- `structural_support_score` 会影响 `stability`、`reusability`
- `behavioral_support_score` 会影响 `recurrence`、`actionability`
- `cross_source_count` 会增强 `evidence_strength`
- `speculation_risk` 会压低总分

## `BaseButton` 特征示例

如果系统观察到：

- `BaseButton` 位于 `src/shared/ui`
- 通过公共入口导出
- 最近 8 个新页面有 7 个使用它
- 2 处原生 `button` 被替换成它

则特征大致为：

```json
{
  "explicit_support_score": 0.1,
  "is_in_shared_layer": 1,
  "is_exported_from_public_entry": 1,
  "wraps_lower_level_primitive": 1,
  "reference_count": 9,
  "reference_spread": 0.8,
  "structural_support_score": 0.9,
  "new_usage_count": 7,
  "replacement_count": 2,
  "reuse_trend_score": 0.9,
  "convergence_trend_score": 0.8,
  "behavioral_support_score": 0.85,
  "cross_source_count": 2,
  "speculation_risk": 0.0
}
```

这个例子说明：

- 没有显式语言规则，也能形成强候选
- 结构和行为特征才是隐式约定识别的主力
