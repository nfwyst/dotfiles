---
name: bytedance-jinshu
description: "Use bytedcli jinshu for Jinshu / 云锦书 message authoring, preview, and send workflows. Covers Jinshu DSL content, Feishu web session authentication, dry-run previews, and confirmed live sends."
---

# bytedance-jinshu

Use this skill when the user asks to write, preview, or send a Jinshu / 云锦书 message through bytedcli.

## Authentication

Jinshu message preview/send uses Feishu web session cookies, not Lark OpenAPI OAuth identity.

Before the first real request, run:

```bash
bytedcli auth login --session --feishu
```

Do not print or persist session cookies, mina codes, or other temporary credentials in conversation output.

## Agent Guidance

When asked to write Jinshu content, first use `references/jinshu-format.md`.

- Generate Jinshu DSL / 锦书体 directly. It uses Markdown-like punctuation, but do not treat the command input as a separate Markdown or JSON format.
- Prefer a simple static card body: title, sections, text, links, tags, buttons, single images, mentions, dividers, and notes.
- For columns, tables, charts, or other advanced card elements, read `references/jinshu-advanced-json.md`. Advanced JSON snippets are embedded inside Jinshu DSL with `--json--` / `--json-end--`; they are not a separate command input format.
- Use `--content` for short one-line bodies and `--content-file` for generated multi-line bodies.
- Preview generated content before sending. Only use `message send --yes` when the user has clearly asked for a live send.
- If a body needs an image key, user open ID, or final target that was not provided, ask for that value instead of inventing it.

## Commands

Preview a message:

```bash
bytedcli jinshu message preview --content "Demo message"
bytedcli jinshu message preview --content-file ./message.jinshu
```

Send a message:

```bash
bytedcli jinshu message send --content "Demo message" --yes
bytedcli jinshu message send --content-file ./message.jinshu --yes
```

Dry-run a send without calling Jinshu:

```bash
bytedcli jinshu message send --content-file ./message.jinshu --dry-run
```

## Input

The message body is sent as Jinshu DSL / 锦书体 content. Use `--content` for short messages and `--content-file` for multi-line content. For syntax and authoring examples, read `references/jinshu-format.md`.

## References

- `references/jinshu-format.md`: Jinshu DSL syntax for agent-generated messages.
- `references/jinshu-advanced-json.md`: JSON snippets embedded inside Jinshu DSL for columns, tables, and charts.
- `references/jinshu-feature-test.md`: feature-by-feature test plan and expected results.
- `references/invocation.md`: bytedcli invocation patterns.
- `references/troubleshooting.md`: common bytedcli troubleshooting.

## Test Fixtures

- `references/jinshu-feature-test.jinshu`: static preview template that does not require image keys or user open IDs.
- `references/jinshu-feature-test-rich.jinshu`: placeholder template for image, title icon, mention, and person list features.
- `references/jinshu-feature-test-json.jinshu`: placeholder template for JSON snippets, image columns, tables, and charts.

## Safety

- `message preview` calls the Jinshu preview path.
- `message send` calls the live send path and requires `--yes`.
- Use `--dry-run` before live sends when the content is generated or user intent is ambiguous.
