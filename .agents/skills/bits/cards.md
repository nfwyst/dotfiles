# Card → Project Mapping

Maps business / colloquial card names to their source path and Bits project. The `bits` skill reads this table in § 1 Step 1 to resolve the target space, project, and template from a card name alone (no need to ask the user for low-level IDs).

## How the Skill Uses This

When the user says something like *"create a dev task for the 交易卡"*, the skill looks up the user's term in two resolvers, in order:

1. **Mapping Table** (primary) — match against **Card name** or any entry in **Aliases**.
2. **Project Families** (fallback) — match against a family's sub-page name or sub-page alias. See the [Project Families](#project-families-shared-bits-project) section below.

Resolution outcomes (same semantics for both resolvers):

- **Exactly one row/sub-page matches** → single-card batch. Use that row directly.
- **Multiple rows match** → multi-card batch. This happens when the user lists multiple cards explicitly, or when they use an umbrella term that is listed as an alias on several rows (see *Umbrella Aliases* below). The skill confirms the final list with the user before creating tasks.
- **No row matches in either resolver** → ask the user to clarify, then offer to append a new row (see checklist below).

For each matched row the skill reads:

- **Bits space** → determines which Known Project Config block in `SKILL.md` to load (`general-search` / `vertical-search` / `cloud-platform`).
- **Bits project** → used as the `--change "service=..."` target. If it is a namespaced name (e.g. `tiktok.search.vertical-cards`), resolve it to the numeric `projectUniqueId` via the space's Known Project Config or via `bytedcli bits develop get --dev-id <templateId> -j`.
- **Path** → used to scope `git diff` when showing an optional change summary, and to produce the `cd` hint after task creation.

For matches inside a Project Family, the **Bits space / project / psm / service-type / from-dev-id** come from the family header and only the **Path** varies per sub-page.

### Umbrella Aliases

To group several cards under a single business term, add that term to the **Aliases** column of every member row. For example, if `生活服务` (Local Services) covers both `local-service-poi-card` and some future `local-service-filter-card`, both rows would list `生活服务` in their Aliases. Asking for *"生活服务"* then returns both rows and the skill will ask the user which subset to create tasks for.

### Ambiguous / Generic Terms (Always Ask)

Some terms are too generic to safely resolve to a single row even if only one row currently matches — they will collide with future rows as the repo grows. For these terms, the skill MUST explicitly ask the user to pick a specific sub-page before proceeding; never auto-resolve.

| Generic term | Possible meanings | Required follow-up question |
|--------------|-------------------|------------------------------|
| 垂搜页 / vertical search page / 垂搜 | The `tiktok.search.vertical` **project family** — one shared Bits project, many sub-pages (`vertical-poi`, `vertical-live`, `vertical-photolog`, `vertical-sounds`, `vertical-hashtag`, and more). See [Project Families](#project-families-shared-bits-project). The Bits project / psm / service-type are fixed for the whole family; only `Path` changes per sub-page. | *"`垂搜页`对应的 Bits project 是 `tiktok.search.vertical`（共享 psm `678e2dd0839b1f4383114c4c`）。请确认具体是哪个子页面？例如 `vertical-poi`（地点）、`vertical-live`（直播）、`vertical-photolog`（图文）、`vertical-sounds`（声音）、`vertical-hashtag`（话题）……"* |

When a user uses one of these generic terms, confirm the exact sub-page before looking up the Path; the Bits project-level fields can still be reused from the project family even if the specific sub-page has no row in the Mapping Table.

## Mapping Table

| Card name | Aliases | Path | Bits project | Bits space |
|-----------|---------|------|--------------|------------|
| Location Banner (提示更新地理位置) | 生服定位 Banner, 定位 Banner, local-service-location-banner-card | `subspaces/search/apps/search-vertical-ttml/src/pages/local-service-location-banner-card/` | `tiktok.search.general` | `general-search` |
| LS AI fuzzy card (生服AI泛搜卡) | AI 泛搜卡, 生服 AI 泛搜卡, fe_search_vertical_card_ai_fuzzy | `subspaces/search/apps/search-vertical-reactlynx/src/pages/fe_search_vertical_card_ai_fuzzy/` | `tiktok.search.vertical.card.ai_fuzzy` | `vertical-search` |
| LS AI fuzzy card lite (生服AI泛搜卡lite) | AI 泛搜卡 lite, 生服 AI 泛搜卡 lite, fe_search_vertical_card_ai_fuzzy_lite | `subspaces/search/apps/search-vertical-reactlynx/src/pages/fe_search_vertical_card_ai_fuzzy_lite/` | `tiktok.search.vertical.card.ai_fuzzy_lite` | `vertical-search` |
| LS AI fuzzy nav card (生服AI泛搜导航卡) | AI 泛搜导航卡, 生服 AI 泛搜导航卡, fe_search_vertical_card_ai_fuzzy_navigation_bar | `subspaces/search/apps/search-vertical-reactlynx/src/pages/fe_search_vertical_card_ai_fuzzy_navigation_bar/` | `tiktok.search.vertical.card.ai_fuzzy_nav` | `vertical-search` |
| LS AI fuzzy page (AI泛搜落地页) | 生服 AI 泛搜落地页, local-service-ai-landing-page | `subspaces/search/apps/search-landing-page/src/pages-vertical/local-service-ai-landing-page/` | `tiktok.search.vertical-landing-page` | `vertical-search` |
| LS AI precise page (AI精搜落地页) | 生服 AI 精搜落地页, local-service-ai-precise-landing-page | `subspaces/search/apps/search-landing-page/src/pages-vertical/local-service-ai-precise-landing-page/` | `tiktok.search.vertical-landing-page` | `vertical-search` |
| LS Anchor Point (生服视频锚点卡) | 视频内流锚点卡, 生服锚点卡, fe_search_vertical_card_anchor_point | `subspaces/search/apps/search-vertical-reactlynx/src/pages/fe_search_vertical_card_anchor_point/` | `tiktok.search.vertical.card.anchor_point` | `vertical-search` |
| LS fusion card (生服融合卡) | POI 融合卡, AI 精搜卡, local-service-fusion-card | `subspaces/search/apps/search-vertical-ttml/src/pages/local-service-fusion-card/` | `tiktok.search.vertical-cards` | `vertical-search` |
| LS inflow review page (内流Review页) | 生服融合卡评论内流页, local-service-review-innerflow | `subspaces/search/apps/search-landing-page/src/pages-vertical/local-service-review-innerflow/` | `tiktok.search.vertical-landing-page` | `vertical-search` |
| LS Mini transaction general card (生服交易泛搜小卡) | 交易泛搜小卡, mini_transaction_general | `subspaces/search/apps/search-vertical-reactlynx/src/pages/mini_transaction_general/` | `tiktok.search.vertical.card.mini_transaction_general` | `vertical-search` |
| LS Mini transaction precise card (生服交易精搜小卡) | 交易精搜小卡, mini_transaction_precise | `subspaces/search/apps/search-vertical-reactlynx/src/pages/mini_transaction_precise/` | `tiktok.search.vertical.card.mini_transaction_precise` | `vertical-search` |
| LS Transaction card (生服交易卡) | 交易卡, Transaction Card, POI card, local-service-poi-card | `subspaces/search/apps/search-vertical-ttml/src/pages/local-service-poi-card/` | `tiktok.search.vertical-cards` | `vertical-search` |

> For `search-vertical` app sub-pages (`vertical-poi`, `vertical-live`, `vertical-photolog`, `vertical-sounds`, `vertical-hashtag`, ...), look them up in the [Project Families](#project-families-shared-bits-project) section below, not here. They share one Bits project and are tracked there as a family.

## Project Families (Shared Bits Project)

Some app directories in this repo map **multiple sub-pages to a single Bits project**. When a user refers to any sub-page in such a family, the Bits space / project / psm / service-type / recommended `from-dev-id` are **fixed by the family** — only `Path` (where to `cd` for development) varies per sub-page.

Project Families act as a fallback resolver after the Mapping Table (see [How the Skill Uses This](#how-the-skill-uses-this)). If a sub-page alias matches here but has no row in the Mapping Table, still use it.

### `tiktok.search.vertical` — 垂搜页家族 (`search-vertical` app)

Shared fields for every sub-page in this family:

| Field                     | Value                                  |
| ------------------------- | -------------------------------------- |
| Bits space                | `vertical-search` (`4084696834`)       |
| Bits project              | `tiktok.search.vertical`               |
| psm / projectUniqueId     | `678e2dd0839b1f4383114c4c`             |
| service-type              | `PROJECT_TYPE_HYBRID`                  |
| Recommended `from-dev-id` | `2220967` (Places Tab Optimization — a dev task that already uses this project) |
| Broad aliases             | 垂搜, 垂搜页, vertical search page, search-vertical |

Sub-pages (all located under `subspaces/search/apps/search-vertical/src/pages/`). The skill matches the user's term against Sub-page name or any Aliases; the `Path` column is used for the post-creation `cd` hint.

| Sub-page name | Aliases | Path |
|---------------|---------|------|
| vertical-poi | 地点垂搜页, Places Tab, POI/Place page | `subspaces/search/apps/search-vertical/src/pages/vertical-poi/` |
| vertical-live | 直播垂搜页, Live 垂搜 | `subspaces/search/apps/search-vertical/src/pages/vertical-live/` |
| vertical-photolog | 图文垂搜页, Photolog 垂搜 | `subspaces/search/apps/search-vertical/src/pages/vertical-photolog/` |
| vertical-sounds | 声音垂搜页, 音乐垂搜页, Sounds 垂搜 | `subspaces/search/apps/search-vertical/src/pages/vertical-sounds/` |
| vertical-hashtag | 话题垂搜页, Hashtag 垂搜 | `subspaces/search/apps/search-vertical/src/pages/vertical-hashtag/` |
| image-aggregation-detail | 图片聚合详情页 | `subspaces/search/apps/search-vertical/src/pages/image-aggregation-detail/` |
| ai-bots-full-page | AI Bots 全屏页 | `subspaces/search/apps/search-vertical/src/pages/ai-bots-full-page/` |
| inspire-advice-detail | Inspire Advice 详情页 | `subspaces/search/apps/search-vertical/src/pages/inspire-advice-detail/` |
| inspire-comments-detail | Inspire Comments 详情页 | `subspaces/search/apps/search-vertical/src/pages/inspire-comments-detail/` |
| music-create-results | Music Create 结果页 | `subspaces/search/apps/search-vertical/src/pages/music-create-results/` |

Keep sub-page rows aligned with the actual folders under `subspaces/search/apps/search-vertical/src/pages/`. When adding a new sub-page, verify the folder exists and add it here (not to the Mapping Table).

## Adding a New Row — Checklist

When the user tells you about a new card, first decide **which resolver it belongs to**:

- If the card's Bits project is already listed in [Project Families](#project-families-shared-bits-project), append it as a new sub-page row under that family's table (only Sub-page name / Aliases / Path required).
- Otherwise, append a new row to the [Mapping Table](#mapping-table) and collect all of the following:

1. **Card name**: the primary business name users refer to the card by (Chinese is fine — put the English translation in parentheses).
2. **Aliases**: any other names users or code use for the same thing. If the folder name differs from the business name, include it here.
3. **Path**: relative path from the repo root to the card's source folder. Verify the folder exists.
4. **Bits project**: the Bits project namespaced name (e.g. `tiktok.search.vertical-cards`). If unsure, ask the user.
5. **Bits space**: one of `general-search` / `vertical-search` / `cloud-platform`. Usually inferable from the path, but confirm with the user if ambiguous.

Keep the Mapping Table sorted by Bits space, then alphabetically by card name. Keep Project Family sub-page tables in folder-order (same order as `ls` on `src/pages/`).

If during a task you discover a new Project Family (i.e. a Bits project that will cover multiple sub-pages), create a new family section instead of adding sibling rows to the Mapping Table.
