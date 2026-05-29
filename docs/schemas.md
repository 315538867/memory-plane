# Schemas

## 目的

这份文档只做一件事：

- 把 `memory-plane` `v1` 里的核心对象字段钉死

这些 schema 不是存储选型 schema，而是实现 admission engine 时必须统一的领域对象。

`v1` 需要 5 个核心对象：

- `signal`
- `evidence`
- `candidate`
- `memory`
- `promotion_decision`

## 统一约束

所有对象都遵守以下规则：

- 时间统一用 `ISO 8601 UTC`
- `id` 使用稳定字符串，不依赖数据库自增主键语义
- 所有 `status` 都必须是显式枚举值
- 所有对象都要能追溯来源
- `scope` 必须显式，不允许隐式猜测

## `scope`

`scope` 是所有对象共享的上下文字段。

```json
{
  "user_id": "u_123",
  "project": "memory-plane",
  "repo": "memory-plane",
  "branch": "main",
  "module": "shared-ui",
  "environment": "local"
}
```

字段说明：

- `user_id`
  - 当前协作者身份
- `project`
  - 项目级标识
- `repo`
  - 仓库级标识
- `branch`
  - 当前分支，可选
- `module`
  - 模块或子域，可选
- `environment`
  - `local / ci / staging / prod` 之一，可选

`v1` 最少要求：

- `user_id`
- `project`
- `repo`

## `signal`

`signal` 是原始输入的标准化表示。

```json
{
  "signal_id": "sig_001",
  "kind": "user_message",
  "scope": {
    "user_id": "u_123",
    "project": "memory-plane",
    "repo": "memory-plane"
  },
  "content": {
    "text": "以后默认先审方案再动代码。"
  },
  "source": {
    "origin": "chat",
    "ref": "turn_42"
  },
  "timestamp": "2026-05-29T06:00:00Z",
  "metadata": {}
}
```

字段：

- `signal_id`
  - 原始信号 id
- `kind`
  - 枚举：
    - `user_message`
    - `assistant_message`
    - `code_snapshot`
    - `code_change`
    - `config_fragment`
    - `command_result`
    - `test_result`
    - `document_fragment`
    - `runtime_observation`
- `scope`
  - 作用域
- `content`
  - 按 `kind` 存内容
- `source.origin`
  - 来源系统，如 `chat / git / filesystem / ci`
- `source.ref`
  - 外部引用，如 `turn_id / commit_sha / file_path`
- `timestamp`
  - 采集时间
- `metadata`
  - 额外上下文

## `evidence`

`evidence` 是从一个或多个 signal 中提取出来的可引用证据单元。

```json
{
  "evidence_id": "ev_001",
  "type": "structural",
  "scope": {
    "user_id": "u_123",
    "project": "memory-plane",
    "repo": "memory-plane"
  },
  "claim_hint": "BaseButton 是公共层组件",
  "signals": [
    "sig_101",
    "sig_102"
  ],
  "payload": {
    "path": "src/shared/ui/BaseButton.vue",
    "exported_from": "src/shared/ui/index.ts"
  },
  "strength": 0.8,
  "timestamp": "2026-05-29T06:01:00Z"
}
```

字段：

- `evidence_id`
- `type`
  - `explicit / structural / behavioral`
- `scope`
- `claim_hint`
  - 对证据支持内容的短提示
- `signals`
  - 支撑该证据的 `signal_id[]`
- `payload`
  - 结构化证据内容
- `strength`
  - 单条证据强度，`0.0 - 1.0`
- `timestamp`

## `candidate`

`candidate` 是 admission engine 的核心中间对象。

```json
{
  "candidate_id": "cand_001",
  "memory_type": "project_constraint",
  "claim": "项目默认按钮抽象应优先复用 BaseButton。",
  "scope": {
    "user_id": "u_123",
    "project": "memory-plane",
    "repo": "memory-plane"
  },
  "why_store": "保持 UI 一致性，避免重复封装和样式漂移。",
  "evidence_ids": [
    "ev_001",
    "ev_002",
    "ev_003"
  ],
  "features": {
    "explicit_support": 0.1,
    "structural_support": 0.9,
    "behavioral_support": 0.8,
    "cross_source_count": 2,
    "reuse_span": 7,
    "replacement_count": 2,
    "speculation_risk": 0.0,
    "sensitivity_risk": 0.0
  },
  "scores": {
    "stability": 0.85,
    "reusability": 0.95,
    "actionability": 0.9,
    "evidence_strength": 0.82,
    "novelty": 0.8,
    "recurrence": 0.75,
    "wrong_if_false_cost": 0.4,
    "sensitivity_risk": 0.0,
    "promotion_score": 0.79
  },
  "status": "candidate",
  "first_seen_at": "2026-05-29T06:02:00Z",
  "last_seen_at": "2026-05-29T06:02:00Z"
}
```

字段：

- `candidate_id`
- `memory_type`
  - `user_preference / project_constraint / technical_decision / recurring_failure_pattern / domain_fact`
- `claim`
  - 原子化、可验证的主张
- `scope`
- `why_store`
- `evidence_ids`
- `features`
  - 原始特征
- `scores`
  - 归一化分数
- `status`
  - `candidate / needs_confirmation / reinforce_existing / rejected / conflicted / accepted`
- `first_seen_at`
- `last_seen_at`

## `memory`

`memory` 是正式长期记忆对象。

```json
{
  "memory_id": "mem_001",
  "memory_type": "project_constraint",
  "claim": "项目默认按钮抽象应优先复用 BaseButton。",
  "scope": {
    "user_id": "u_123",
    "project": "memory-plane",
    "repo": "memory-plane"
  },
  "why_store": "保持 UI 一致性，避免重复封装和样式漂移。",
  "evidence_ids": [
    "ev_001",
    "ev_002",
    "ev_003"
  ],
  "confidence": 0.84,
  "status": "accepted",
  "first_seen_at": "2026-05-29T06:02:00Z",
  "last_seen_at": "2026-05-29T06:05:00Z",
  "supersedes": [],
  "conflicts_with": [],
  "expires_at": null
}
```

字段：

- `memory_id`
- `memory_type`
- `claim`
- `scope`
- `why_store`
- `evidence_ids`
- `confidence`
- `status`
  - `accepted / superseded / conflicted / expired`
- `first_seen_at`
- `last_seen_at`
- `supersedes`
  - 被它替代的旧 `memory_id[]`
- `conflicts_with`
  - 冲突 `memory_id[]`
- `expires_at`

## `promotion_decision`

`promotion_decision` 是一次 candidate 判定结果。

```json
{
  "decision_id": "dec_001",
  "candidate_id": "cand_001",
  "decision": "accepted",
  "reason_codes": [
    "strong_structural_support",
    "strong_behavioral_support",
    "reuse_trend_confirmed"
  ],
  "matched_memory_id": null,
  "matched_candidate_id": null,
  "score_snapshot": {
    "promotion_score": 0.79,
    "evidence_strength": 0.82
  },
  "timestamp": "2026-05-29T06:03:00Z"
}
```

字段：

- `decision_id`
- `candidate_id`
- `decision`
  - `accepted / needs_confirmation / reinforce_existing / rejected / conflicted`
- `reason_codes`
  - 可解释原因
- `matched_memory_id`
  - 若补强或冲突已有 memory
- `matched_candidate_id`
  - 若补强已有 candidate
- `score_snapshot`
- `timestamp`

## Reason Codes 建议

推荐先固定一批 `reason_codes`：

- `strong_explicit_support`
- `strong_structural_support`
- `strong_behavioral_support`
- `cross_source_confirmed`
- `reuse_trend_confirmed`
- `replacement_trend_confirmed`
- `insufficient_evidence`
- `process_trace_only`
- `speculation_without_support`
- `sensitive_content`
- `conflicts_existing_memory`
- `reinforces_existing_memory`

## 最小实现要求

如果现在开始写代码，`v1` 至少要把以下对象定义成稳定类型：

- `Signal`
- `Evidence`
- `Candidate`
- `Memory`
- `PromotionDecision`

不先钉死这些字段，后面的 detector、matching、promotion 很容易边写边漂。
