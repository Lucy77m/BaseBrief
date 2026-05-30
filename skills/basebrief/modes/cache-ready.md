# BaseBrief Cache-ready Mode

## What It Is

`cache-ready` 是 BaseBrief 的实验模式。

它只承诺：

- 字段顺序稳定
- 精确共享前缀更可控
- 动态内容尽量后置

它不承诺：

- 真实 `cached_tokens` 已提升
- 真实费用已下降
- 真实延迟已下降

## Use Cache-ready When

- 用户明确提到 `prompt cache`
- 用户明确提到 `cache-ready`
- 用户明确提到 `稳定前缀`
- 用户明确提到 `缓存代理实验`

## Required Inputs

使用：

- `templates/zh-CN/CACHE_READY_LITE_INPUT.json`

并保持以下字段分层：

- `verified_facts`
- `confirmed_decisions`
- `assumptions`
- `open_questions`
- `risk_boundaries`

## Scripts

- `scripts/generate_cache_ready_lite.js`
- `scripts/prompt_stability_probe.js`

## Evidence Rule

如果没有 provider 级数据，只能写：

- `更像缓存友好设计`
- `精确共享前缀更长`
- `真实缓存收益未证明`

不能写：

- `缓存命中提升已证明`
- `cached_tokens 已提升`
- `真实延迟已下降`
