---
name: frontend-design-review-gate
description: Use when reviewing, refactoring, or implementing React/TypeScript frontend modules that show prop drilling, duplicated runtime state, mixed container/view responsibilities, selector sprawl, side-effect coupling, or regression-prone interaction logic. Run a mandatory two-pass architecture gate and always apply `react-best-practices` as a companion analysis pass for React components/hooks in scope.
---

# Frontend Design Review Gate

## Purpose

Apply a mandatory two-pass review gate for frontend work.

1. Pre-coding review: validate architecture before implementation.
2. Pre-merge review: validate code quality and regression risk after implementation.

Treat this as a hard gate, not optional advice.

## Invocation Contract

1. This skill is a mandatory sub-gate when `receiving-code-review` handles frontend review feedback.
2. Frontend review items must complete this gate before implementation.
3. Frontend review items must run this gate again before declaring merge-ready.
4. During internal analysis and review, always load and apply `react-best-practices` as a companion skill for React-specific diagnostics.

## Non-Negotiable Rules

1. Start from first principles: clarify business goal, user action, and state ownership before discussing structure.
2. Do not propose compatibility patches when root-cause refactor is required.
3. Do not over-design: pick the shortest correct path with clear ownership.
4. Do not invent out-of-scope fallback plans.
5. Report findings by severity with concrete file/line evidence.
6. Promote cross-component shared runtime state (for example message and panel runtime context) to `store + selector`; do not distribute it by deep prop passing.
7. For multi-field store reads in hooks/components, prefer combined selection with `useShallow`; avoid many independent store subscriptions for the same concern.
8. Store placement must follow repository domain conventions (for example under domain-side zustand structure), not module-local ad-hoc stores.
9. Prop pass-through must be justified: each prop should represent direct view input, not orchestration context or shared runtime state.
10. For business components, when state/handlers are consumed across siblings or layers, prioritize `store + selector` ownership over callback tunneling.
11. Review component architecture quality: detect and remove repeated code paths, unreasonable parent-child layering, redundant components, and unnecessary wrapper layers.
12. Review hook architecture quality: detect redundant hook splits, state split too fine (fragmented ownership), and state split too coarse (mixed responsibilities).
13. When creating or modifying stores, split by responsibility into slices; do not build monolithic stores that mix unrelated concerns.
14. Architecture work must include mandatory analysis -> design -> adjustment; do not jump directly to local code edits.
15. Every new/changed prop must be classified before coding: render input / local interaction callback / orchestration-runtime context. Only the first two are allowed in component props by default.
16. If a prop or handler is consumed across siblings/layers, default to shared `store + selector`; allow prop drilling only with explicit justification.
17. For any new shared store, require slice decomposition by responsibility (for example `runtime`, `selector`, `ui`, `actions`, `effects`) and explicit boundaries.
18. For behavior orchestration, evaluate whether it belongs in a dedicated hook or factory; avoid embedding orchestration logic directly in presentational components.
19. For complex interaction flows (multi-phase async, guarded transitions, cancel/retry loops), evaluate state machine suitability and justify yes/no explicitly.
20. For React component/hook findings, enforce `react-best-practices` checks first (effect misuse, derived state in effects, unnecessary refs, and misplaced event logic).
21. Do not force shared store for truly local state: if state is owned and consumed within one component boundary and does not affect cross-layer lifecycle/consistency, keep it local.

## Workflow

## Step 1: Scope and Model

Build a compact domain model first.

1. Define core entities: message, panel state, action, selector state, side effects.
2. Define ownership for each entity: component-local, domain context, global store, backend.
3. Define allowed state transitions.

If ownership or transition is unclear, stop and resolve before coding.

## Step 1.5: Parameter/State/Behavior Decision Matrix (Mandatory)

Before proposing edits, classify each newly introduced or modified item.

1. Parameter classification
1. Render input (can stay as prop)
2. Local view interaction callback (can stay local)
3. Orchestration/runtime context (must move to `store + selector` unless explicitly exempted)

2. Shared-state decision
1. Is this state read/written by multiple siblings or layers?
2. Does it influence lifecycle, visibility, async pending, or cross-view consistency?
3. If both answers are yes, move to shared store and define slice ownership.
4. If state is single-boundary local and has no cross-layer lifecycle impact, keep component-local state and record why.

3. Behavior placement decision
1. Is logic reusable and stateful across components? use dedicated hook.
2. Is logic deterministic transformation/config generation? consider factory.
3. Is logic event-sequence heavy with guarded transitions? evaluate state machine.

4. Required output for this step
1. List of props to keep and why.
2. List of props to remove and destination (`store`, hook, factory, state machine).
3. Slice plan for any new/changed shared store.

## Step 2: Pre-Coding Architecture Review

Check these dimensions and record findings.

1. Component architecture and layering
1. Are container/domain/view responsibilities separated?
2. Are view components primarily presentational?
3. Is behavior driven by explicit state, not boolean explosion?
4. Is component layering minimal and coherent, without duplicated logic blocks, redundant components, or wrapper-only shells without ownership value?
5. Are duplicate render branches or near-identical component variants consolidated into one architecture path?

2. State ownership and sharing
1. Is there a single source of truth for runtime state?
2. Is the same runtime state duplicated in multiple hooks/components?
3. Are state transitions explicit and deterministic?
4. For globally consumed state (for example message), is it implemented as `store + selector` rather than prop drilling?
5. Are selectors scoped/minimal to avoid broad rerender and accidental coupling?
6. If multiple store fields are consumed together, are they selected with `useShallow` composition?
7. Is the store located in the repository's domain-defined location instead of feature-local placement?
8. If store scope grows, is it split into clear responsibility slices (for example message/selector/runtime/action) with explicit boundaries?

3. Hook architecture and granularity
1. Are hooks split at the right granularity (not over-split and not under-split), with each hook owning one cohesive state transition boundary?
2. Are there redundant hooks that only tunnel params without ownership?
3. Is state ownership boundary clear per hook (no fragmented micro-state and no overloaded mega-hook)?

4. Props and API surface
1. Is there deep prop drilling for domain actions/state?
2. Are component props doing orchestration instead of rendering?
3. Can inputs be collapsed to stable domain primitives?
4. Is each prop necessary for local rendering, or is it leaked orchestration/runtime state that should live in shared store?
5. Do business components avoid passing action chains (`onXxx`/context bundles) across multiple layers when shared store ownership is feasible?
6. For each added/changed prop, is there an explicit classification result from Step 1.5?
7. Are orchestration callbacks removed from view-component props when shared selectors/actions can own them?

5. Store architecture and slice boundaries
1. Are shared states split into responsibility-aligned slices instead of one mixed store?
2. Are slice read/write APIs explicit (selector/action boundaries clear)?
3. Are cross-slice dependencies minimized and directional?

6. Behavior abstraction and transition model
1. Are reusable orchestration behaviors extracted to dedicated hooks/factories?
2. Are complex flows reviewed for state machine suitability, with explicit yes/no rationale?
3. If not using a state machine for complex transitions, is there a deterministic transition table/guard strategy?

7. Side effects and integration boundaries
1. Are external integrations (window extension, event bus, analytics, toast) behind one gateway?
2. Is side-effect lifecycle centralized and testable?
3. Are UI components free from infrastructure calls?

8. Selector and async interaction runtime
1. Is pending/loading/success/fail state managed in one place?
2. Are overlay open/close rules unified?
3. Is retry and error feedback consistent?
4. Do presentational components read shared state through selector hooks instead of receiving orchestration props?

9. React practice conformance (mandatory companion pass)
1. Was `react-best-practices` explicitly applied during this review pass?
2. Are Effects used only for external-system synchronization and not for derivation/event chains?
3. Are ref usage and custom-hook boundaries aligned with `react-best-practices` guidance?

## Step 3: Refactor Plan (PR-level)

Output a concrete multi-PR plan.

1. Each PR has one architectural target.
2. Each PR is independently mergeable and verifiable.
3. Sequence follows dependency order: domain skeleton -> prop reduction -> runtime merge -> side-effect gateway -> tests.

For each PR, include:

1. Scope (files/modules).
2. Code changes.
3. Risks.
4. Verification checklist.
5. Exit criteria.
6. Prop reduction delta (which props were removed/kept and why).
7. Store slice delta (which slices were added/changed and ownership boundaries).
8. Behavior placement delta (logic moved to hook/factory/state machine decision).

## Step 4: Pre-Merge Review

After implementation, re-run Step 2 dimensions as the baseline, then pass all execution gates below.

1. No unresolved `P0/P1` architecture findings remain after applying Step 2 checks.
2. Runtime ownership is singular and consistent (no duplicated cross-layer runtime state, no unjustified deep prop drilling).
3. Shared-state implementation is compliant (`store + selector`, `useShallow` for multi-field reads, domain-convention store placement, slice boundaries explicit).
4. Component and hook boundaries are coherent (no redundant wrappers/components, no fragmented or monolithic hook ownership).
5. Integration boundaries are clean (presentational components do not perform direct global/infrastructure calls).
6. Transition behavior is deterministic (state-machine decision documented as yes/no with rationale; guards explicit when no state machine).
7. Verification is complete (core transitions and high-risk interaction paths are test-covered and explicitly checked).
8. Review notes include both: `react-best-practices` companion-check conclusion and local-state-retention justifications.

## Severity Rubric

1. `P0`: User-facing incorrect behavior, data loss, or guaranteed regression.
2. `P1`: Structural issue with high change risk (state duplication, orchestration via props, duplicated side-effect runtime).
3. `P2`: Maintainability debt likely to cause medium-term regressions.
4. `P3`: Clarity/style issue without immediate risk.

## Required Output Format

Always output in this order.

1. Findings by severity with file references.
2. Root-cause summary.
3. Refactor plan by PR granularity.
4. Verification checklist.
5. Go/No-Go decision.
6. Parameter/State/Behavior decision appendix.

Use this template:

```md
## Findings
1. [P1] ... [file:line]

## Root Cause
...

## Refactor Plan
1. PR-1: ...
2. PR-2: ...

## Verification
1. ...

## Decision
No-Go (reason) / Go (conditions)

## Parameter/State/Behavior Appendix
1. Parameter classification table
2. Store sharing decision table
3. Slice decomposition plan
4. Hook/factory placement decisions
5. State machine applicability decision (yes/no + rationale)
6. `react-best-practices` companion-check summary
7. Local-state retention justification table (items kept local + rationale)
```

## Success Criteria

A review passes only when all conditions are true.

1. No unresolved `P0/P1` findings.
2. Domain ownership is explicit and singular for critical runtime state.
3. Shared runtime concerns use `store + selector` with explicit slice boundaries, and multi-field reads use `useShallow` where applicable.
4. Component/hook architecture is streamlined and responsibility-balanced (no avoidable duplication, no over-fragmented or over-coupled ownership).
5. Parameter classification was executed and documented; no unclassified new/changed props remain.
6. Hook/factory/state-machine decisions are explicit, justified, and reflected in implementation.
7. Main interaction flows and high-risk paths are test-covered.
8. `react-best-practices` companion analysis and local-state-retention justifications are present in final review output.
