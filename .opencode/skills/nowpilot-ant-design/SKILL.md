---
name: nowpilot-ant-design
description: Implement and review NowPilot React UI using Ant Design v6 and selected Ant Design X presentation components with token, provider, and accessibility discipline.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: frontend
---
# NowPilot Ant Design Rules

- Use Ant Design v6 components before bespoke widgets.
- Use Ant Design X for presentation only. NowPilot owns state, streaming, tools, providers, persistence, permissions, and cancellation.
- Use one root provider per extension surface.
- Use global, semantic, and component tokens. Do not hard-code colours in page components.
- Do not add Tailwind or another component/icon system.
- Do not wrap every Ant component. Add a NowPilot wrapper only for a repeated stable product contract.
- Use documented APIs and Context7 for version-sensitive behaviour.
- Avoid static imperative APIs that escape provider context.
- Icon-only actions require tooltips and accessible names.
- Loading, disabled, validation, empty, error, and recovery states are mandatory where applicable.
- Chat composer exposes Workflow, not a raw model selector.

Before completion run focused tests, typecheck, UI state checks, keyboard/focus checks, and screenshot review.
