# qr2url.nu — decode QR payloads from images via macOS Vision framework.
#
# Source from config.nu, then call directly:
#   qr2url a.png b.png      decode one or more image files (escaped text to stdout)
#   qr2url -                read image from stdin
#   qr2url --json a.png     output as JSON array of {file, payload, type}
#   qr2url --urls-only ...  only emit payloads classified as urls
#   qr2url --raw ...        display raw payloads without stderr hints
#
# type classification: url | qrlogin | wifi | vcard | totp | plain
# Exit codes: 0 = at least one payload decoded; 1 = none decoded /
#             missing or unreadable image / helper failure (--urls-only: 1 = no url payloads).
#
# No deps — uses macOS built-in Vision barcode detector. First run compiles
# a tiny Swift helper binary (cached under ~/.cache/qr2url/); the cache is
# invalidated by MD5 when the embedded Swift source changes.

#
# Limitations:
#   - NUL bytes inside a payload truncate the payload at the first NUL.
#   - Binary / non-UTF-8 payloads are emitted as 'hex:' prefixed hex.
#   - Default text output escapes terminal control bytes; --raw preserves raw
#     payloads.
#
# Resolve cache paths under ~/.cache/qr2url (never pollute the repo).
def qr2url-cache-paths [] {
    let home = ($env.HOME? | default $nu.home-dir | if ($in | is-empty) { $nu.home-dir } else { $in })
    let base = ($home | path join ".cache" "qr2url")
    { helper: ($base | path join ".qr_decode_helper"), hash: ($base | path join ".qr_decode_helper.md5") }
}

const QR2URL_SWIFT_SRC = '
import Cocoa
import Vision
import CoreImage
import CoreML

let args = CommandLine.arguments
guard args.count == 2 else { exit(1) }
let path = args[1]

guard let img = CIImage(contentsOf: URL(fileURLWithPath: path)) else { exit(2) }

let request = VNDetectBarcodesRequest()
request.symbologies = [.qr, .microQR]
if #available(macOS 14.0, *) {
    if let cpu = MLComputeDevice.allComputeDevices.first(where: {
        if case .cpu = $0 { return true }
        return false
    }) {
        request.setComputeDevice(cpu, for: .main)
    }
} else {
    request.usesCPUOnly = true
}
let handler = VNImageRequestHandler(ciImage: img)
do {
    try handler.perform([request])
} catch {
    exit(4)
}

guard let results = request.results, !results.isEmpty else { exit(3) }
for r in results {
    if let p = r.payloadStringValue { print(p, terminator: "\0") }
    else if let d = r.payloadData { print("hex:" + d.map { String(format: "%02x", $0) }.joined(), terminator: "\0") }
}
'

# Compile the Swift barcode detector binary if not cached or source changed.
def qr2url-ensure-helper [] {
    let paths = (qr2url-cache-paths)
    let src_hash = ($QR2URL_SWIFT_SRC | hash md5)
    let base = ($paths.helper | path dirname)
    let base_exists = ($base | path exists)
    let uid = (^id -u | str trim)
    let owned = (if $base_exists { (^stat -f %u $base | str trim) == $uid } else { false })
    let mode_700 = (if $base_exists { (^stat -f %Lp $base | str trim) == '700' } else { false })
    # 缓存信任前提: 目录存在、属当前用户、权限 700(防 group/other 可写投毒)。
    # 不信任时不返回缓存, 走下方重建分支。
    if $owned and $mode_700 and ($paths.helper | path exists) and ($paths.hash | path exists) {
        let cached_hash = (open $paths.hash | str trim)
        if ($cached_hash == $src_hash) { return { path: $paths.helper, temporary: false } }
    }
    mkdir $base
    # 重建前确保目录归我们且 700; 无法 chmod(非属主)则本次编译落到 $TMPDIR, 不落缓存。
    let cache_secure = (if ((^stat -f %u $base | str trim) == $uid) {
        (^chmod 700 $base | complete).exit_code == 0
    } else {
        false
    })
    let src = (mktemp -t XXXXXX.swift)
    let tmpdir = (if $cache_secure {
        ($base | path join $'.qr_decode_helper.(random chars --length 8).tmp')
    } else {
        (mktemp -d -t qr2url.XXXXXX)
    })
    mkdir $tmpdir
    let tmpbin = ($tmpdir | path join "helper")
    let dest = (if $cache_secure { $paths.helper } else { (mktemp -t qr2url.XXXXXX) })
    $QR2URL_SWIFT_SRC | save -f $src
    let build = (do {
        ^bash -c '
src=$1
tmpdir=$2
tmpbin=$3
dest=$4
temporary=$5
child=
cleanup() {
    status=$?
    trap - EXIT HUP INT TERM
    if [ -n "$child" ]; then
        kill -TERM "$child" 2>/dev/null
        wait "$child" 2>/dev/null
    fi
    rm -f -- "$src"
    rm -rf -- "$tmpdir"
    if [ "$temporary" = 1 ] && [ "$status" -ne 0 ]; then
        rm -f -- "$dest"
    fi
    exit "$status"
}
trap cleanup EXIT
trap "exit 129" HUP
trap "exit 130" INT
trap "exit 143" TERM
touch "$tmpbin"
swiftc -O -o "$tmpbin" "$src" &
child=$!
wait "$child"
status=$?
child=
[ "$status" -eq 0 ] || exit "$status"
mv "$tmpbin" "$dest" || exit 70
rmdir "$tmpdir" || exit 70
' bash $src $tmpdir $tmpbin $dest (if $cache_secure { "0" } else { "1" })
    } | complete)
    if $build.exit_code != 0 {
        rm -rf $tmpdir
        error make {msg: (if $build.exit_code == 70 { "helper publish failed" } else { "swiftc compile failed" })}
    }
    if $cache_secure { $src_hash | save -f $paths.hash }
    { path: $dest, temporary: (not $cache_secure) }
}

def escape-control-chars [payload: string]: nothing -> string {
    $payload
    | str replace --all "\e" "\\e"
    | str replace --all "\u{7}" "\\a"
    | str replace --all "\u{8}" "\\b"
    | str replace --all "\t" "\\t"
    | str replace --all "\n" "\\n"
    | str replace --all "\r" "\\r"
    # C0 之外还须转义 DEL (U+007F) 与 C1 控制符 (U+0080-U+009F): CSI/U+009B、
    # OSC/U+009D 会被终端解释, 造成注入。逐码点替换为 \xNN 字面量。
    | str replace --all "\u{7f}" "\\x7f"
    | str replace --all "\u{80}" "\\x80"
    | str replace --all "\u{81}" "\\x81"
    | str replace --all "\u{82}" "\\x82"
    | str replace --all "\u{83}" "\\x83"
    | str replace --all "\u{84}" "\\x84"
    | str replace --all "\u{85}" "\\x85"
    | str replace --all "\u{86}" "\\x86"
    | str replace --all "\u{87}" "\\x87"
    | str replace --all "\u{88}" "\\x88"
    | str replace --all "\u{89}" "\\x89"
    | str replace --all "\u{8a}" "\\x8a"
    | str replace --all "\u{8b}" "\\x8b"
    | str replace --all "\u{8c}" "\\x8c"
    | str replace --all "\u{8d}" "\\x8d"
    | str replace --all "\u{8e}" "\\x8e"
    | str replace --all "\u{8f}" "\\x8f"
    | str replace --all "\u{90}" "\\x90"
    | str replace --all "\u{91}" "\\x91"
    | str replace --all "\u{92}" "\\x92"
    | str replace --all "\u{93}" "\\x93"
    | str replace --all "\u{94}" "\\x94"
    | str replace --all "\u{95}" "\\x95"
    | str replace --all "\u{96}" "\\x96"
    | str replace --all "\u{97}" "\\x97"
    | str replace --all "\u{98}" "\\x98"
    | str replace --all "\u{99}" "\\x99"
    | str replace --all "\u{9a}" "\\x9a"
    | str replace --all "\u{9b}" "\\x9b"
    | str replace --all "\u{9c}" "\\x9c"
    | str replace --all "\u{9d}" "\\x9d"
    | str replace --all "\u{9e}" "\\x9e"
    | str replace --all "\u{9f}" "\\x9f"
}

def display-payload [payload: string, type: string, raw: bool]: nothing -> string {
    if $raw {
        $payload
    } else if $type == "qrlogin" {
        "[redacted qrlogin token; rerun with --raw to print]"
    } else if $type == "totp" {
        "[redacted totp secret; rerun with --raw to print]"
    } else {
        escape-control-chars $payload
    }
}

# Decode one image file → {code, payloads}. helper exit codes: 0 ok, 2 unreadable, 3 no barcodes.
# helper is ensured once by the caller: a per-image ensure would recompile
# on every file when the cache dir is untrusted (temporary: true).
def qr2url-decode [helper: record, image_path: string] {
    let res = (do { ^$helper.path $image_path } | complete)
    if $res.exit_code == 0 {
        { code: 0, payloads: ($res.stdout | split row "\u{0}" | where {|s| ($s | str length) > 0}) }
    } else {
        { code: $res.exit_code, payloads: [] }
    }
}

# qrlogin 判定(双层):URL 载荷按 host 标签段/路径段精确匹配(禁 contains);
# 非 URL 载荷先走 JSON 结构谓词(record + qrlogin.record + token.string, 容忍额外键),
# 解析失败或非 JSON 时窄化兜底:含 qrlogin 且无空白的 token 形字符串。
# 旧版 host contains 会把 myqrlogin-tool.com 这类域名误判并 redact。
def is-qrlogin [payload: string]: nothing -> bool {
    let p = ($payload | str lowercase)
    if ($p | str starts-with 'http://') or ($p | str starts-with 'https://') {
        let parsed = (try { $p | url parse } catch { null })
        if $parsed == null { return false }
        let host = ($parsed.host? | default '')
        let path_segs = ($parsed.path? | default '' | str trim --char '/' | split row '/' | where {|s| not ($s | is-empty)})
        (($host | str lowercase | split row '.' | any {|l| $l == 'qrlogin'})
            or ($path_segs | any {|s| $s == 'qrlogin'}))
    } else {
        let parsed = (try { $p | from json } catch { null })
        if ($parsed | describe | str starts-with 'record') {
            let struct_ok = (($parsed.qrlogin? | describe | str starts-with 'record') and (($parsed.qrlogin.token? | describe) == 'string'))
            # redact-on-doubt: 结构谓词失败但载荷含带引号的 'qrlogin' 键标记(数字 token、
            # 嵌套/带空格 JSON)也判 qrlogin, 宁 redact 不泄漏
            $struct_ok or ($p | str contains '"qrlogin"')
        } else {
            ($p | str contains 'qrlogin') and (not ($p | str contains ' '))
        }
    }
}


def classify-payload [payload: string]: nothing -> string {
    let p = ($payload | str lowercase)
    if ($p | str starts-with 'http://') or ($p | str starts-with 'https://') {
        if (is-qrlogin $p) {
            'qrlogin'
        } else {
            'url'
        }
    } else if ($p | str starts-with 'wifi:') {
        'wifi'
    } else if ($p | str starts-with 'begin:vcard') {
        'vcard'
    } else if ($p | str starts-with 'otpauth://') {
        'totp'
    } else {
        if (is-qrlogin $p) { 'qrlogin' } else { 'plain' }
    }
}

# Decode QR payloads from images.
export def qr2url [
    --json          # output records as JSON array {file, payload, type}
    --urls-only     # only emit payloads classified as urls
    --raw           # display raw payloads without stderr hints
    ...images: string  # image file paths (use '-' for stdin)
] {
    let stdin_data = $in
    if ($images | is-empty) {
        error make {msg: "no image given (use '-' for stdin)"}
    }

    # Ensure the helper once for the whole batch; a temporary helper
    # (untrusted cache dir) is cleaned up on both success and error paths.
    let helper = (qr2url-ensure-helper)
    let result = (try {
        qr2url-main $helper $stdin_data $json $urls_only $raw ...$images
    } catch { |e|
        if $helper.temporary { rm -f $helper.path }
        error make {msg: $e.msg}
    })
    if $helper.temporary { rm -f $helper.path }
    $result
}

def qr2url-main [helper: record, stdin_data, json: bool, urls_only: bool, raw: bool, ...images: string] {
    mut all_results = []

    for img_path in $images {
        let decoded = if $img_path == "-" {
            let data = (if (($stdin_data | is-empty) and (is-terminal --stdin)) {
                error make {msg: "stdin is a terminal — pipe an image in or pass a file path"}
            } else if ($stdin_data | is-empty) {
                (^cat)
            } else {
                $stdin_data
            })
            let tmp = (mktemp -t XXXXXX.bin)
            try {
                $data | save -fr $tmp
                let r = (qr2url-decode $helper $tmp)
                rm -f $tmp
                $r
            } catch {
                rm -f $tmp
                error make {msg: "failed to decode image from stdin"}
            }
        } else {
            if not ($img_path | path exists) {
                print -e $"file not found: ($img_path)"
                continue
            }
            qr2url-decode $helper $img_path
        }

        let payloads = match $decoded.code {
            0 => $decoded.payloads
            2 => { print -e $"cannot read image: ($img_path)"; [] }
            3 => []   # no QR in this file; aggregate decides below
            _ => { print -e ("decode failed: " + $img_path + " (helper exit " + ($decoded.code | into string) + ")"); [] }
        }

        for payload in $payloads {
            let t = (classify-payload $payload)
            if (not $raw) and ($t != 'url') and ($t != 'plain') {
                if $t == 'qrlogin' {
                    print -e "login token — scan with the app that displayed this QR; cannot be converted to a link."
                } else if $t == 'totp' {
                    print -e "totp secret exposed — treat as sensitive."
                    print -e "redacted; rerun with --raw only if you intentionally need the secret."
                } else {
                    print -e ("not convertible to a link (type: " + $t + ")")
                }
            }
            $all_results = ($all_results | append {file: $img_path, payload: (display-payload $payload $t $raw), type: $t})
        }
    }

    let out = (if $urls_only { $all_results | where type == url } else { $all_results })

    if ($out | is-empty) {
        if $json { print "[]" }
        error make {msg: (if $urls_only { "no urls found" } else { "no QR codes found" })}
    }
    if $json {
        $out | to json
    } else {
        for r in $out {
            print $r.payload
        }
    }
}

hide classify-payload
hide display-payload
hide escape-control-chars
hide qr2url-cache-paths
hide qr2url-decode
hide qr2url-ensure-helper
hide qr2url-main
hide is-qrlogin
