# MiniMax Agent Harness Capability Matrix

Last verified: May 16, 2026.

## Source Rules

Use only public, clean-room sources: MiniMax official docs, MiniMax public `mini-agent`, public OSS projects, and public product documentation. Do not use leaked proprietary agent implementations or other private source. Reimplement behavior from observed public contracts and project requirements rather than copying closed-source agent code.

## MiniMax API Facts

| Capability | Verified Status | FORGE Interpretation |
|---|---|---|
| `/v1/text/chatcompletion_v2` | Supports MiniMax M2.7, tools, multimodal input, and streaming text chunks. | Keep this as the primary endpoint for the production tool loop. |
| Tool calls | Model responses include complete tool-call arguments before local execution. | Validate and execute only complete arguments; do not mutate project state from partial data. |
| Projected streaming | FORGE can stream projected file updates after complete tool-call arguments arrive, before final tool execution finishes. | Use projected streaming for responsive code/preview UX while keeping tool execution authoritative. |
| Text streaming | Supported for assistant text deltas. | Useful for assistant narration and future planner mode, but not sufficient alone for safe file writes. |
| `reasoning_content` / `<think>` | Reasoning content must be preserved in model history for MiniMax interleaved thinking. | Never strip history content sent back to MiniMax; sanitize display copies separately if needed. |
| `tool_choice` | Automatic tool choice is the documented fit for the current FORGE loop. | Keep `tool_choice: "auto"` unless public docs and tests prove a stronger mode. |
| Token limits | Use current documented MiniMax parameter names and verify by endpoint. | Keep tests around `max_completion_tokens`, context budget assumptions, and timeout budgets. |

## Harness Decision

FORGE should treat MiniMax as the reasoning and tool-call producer while the local harness owns production behavior: projection, validation, diagnostics, repair replay, timing, UI streaming, and observability. The harness may learn from public agent patterns, but all implementation must remain clean-room and project-specific.
