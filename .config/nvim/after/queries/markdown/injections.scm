; extends

; Import/export statements on their own line are parsed as (paragraph > inline)
; by the CommonMark markdown parser. Inject tsx for these.
((inline) @injection.content
 (#match? @injection.content "^\\s*(import|export)\\s")
 (#set! injection.language "tsx")
 (#set! injection.combined))

; Standalone JSX components (<Story>, <Meta>, <Canvas>, etc.) on their own line
; are parsed as (html_block) by the CommonMark markdown parser.
(html_block) @injection.content
 (#set! injection.language "tsx")
 (#set! injection.combined)

; Inline JSX tags within paragraphs (e.g. <Badge>text</Badge>) are parsed
; as (inline) containing raw HTML by CommonMark.
((inline) @injection.content
 (#match? @injection.content "<[A-Z][a-zA-Z]*")
 (#set! injection.language "tsx")
 (#set! injection.combined))
