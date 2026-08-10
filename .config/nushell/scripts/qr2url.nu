# qr2url.nu — decode QR payloads from images via macOS Vision framework.
#
# Source from config.nu, then call directly:
#   qr2url a.png b.png      decode one or more image files (escaped text to stdout)
#   qr2url -                read image from stdin
#   qr2url --json a.png     output as JSON array of {file, payload, type}
#   qr2url --urls-only ...  only emit payloads classified as urls
#   qr2url --raw ...        skip type classification, stderr hints, and text escaping
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
    if (($paths.helper | path exists) and ($paths.hash | path exists)) {
        let cached_hash = (open $paths.hash | str trim)
        if ($cached_hash == $src_hash) { return $paths.helper }
    }
    mkdir ($paths.helper | path dirname)
    let src = (mktemp -t XXXXXX.swift)
    let tmpbin = ($paths.helper | path dirname | path join $".qr_decode_helper.(random chars --length 8).tmp")
    $QR2URL_SWIFT_SRC | save -f $src
    try {
        swiftc -O -o $tmpbin $src
    } catch {
        rm -f $src
        rm -f $tmpbin
        error make {msg: "swiftc compile failed"}
    }
    rm -f $src
    try {
        ^mv $tmpbin $paths.helper
    } catch {
        rm -f $tmpbin
        error make {msg: "helper publish failed"}
    }
    $src_hash | save -f $paths.hash
    $paths.helper
}

def escape-control-chars [payload: string]: nothing -> string {
    $payload
    | str replace --all "\e" "\\e"
    | str replace --all "\u{7}" "\\a"
    | str replace --all "\u{8}" "\\b"
    | str replace --all "\t" "\\t"
    | str replace --all "\n" "\\n"
    | str replace --all "\r" "\\r"
}

def display-payload [payload: string, type: string, raw: bool]: nothing -> string {
    if $raw {
        $payload
    } else if $type == "totp" {
        "[redacted totp secret; rerun with --raw to print]"
    } else {
        escape-control-chars $payload
    }
}

# Decode one image file → {code, payloads}. helper exit codes: 0 ok, 2 unreadable, 3 no barcodes.
def qr2url-decode [image_path: string] {
    let helper = (qr2url-ensure-helper)
    let res = (do { ^$helper $image_path } | complete)
    if $res.exit_code == 0 {
        { code: 0, payloads: ($res.stdout | split row "\u{0}" | where {|s| ($s | str length) > 0}) }
    } else {
        { code: $res.exit_code, payloads: [] }
    }
}

def classify-payload [payload: string]: nothing -> string {
    let p = ($payload | str lowercase)
    if ($p | str starts-with 'http://') or ($p | str starts-with 'https://') {
        'url'
    } else if ($p | str starts-with 'wifi:') {
        'wifi'
    } else if ($p | str starts-with 'begin:vcard') {
        'vcard'
    } else if ($p | str starts-with 'otpauth://') {
        'totp'
    } else if ($p | str contains 'qrlogin') {
        'qrlogin'
    } else {
        'plain'
    }
}

# Decode QR payloads from images.
export def qr2url [
    --json          # output records as JSON array {file, payload, type}
    --urls-only     # only emit payloads classified as urls
    --raw           # skip type classification and stderr hints
    ...images: string  # image file paths (use '-' for stdin)
] {
    let stdin_data = $in
    if ($images | is-empty) {
        error make {msg: "no image given (use '-' for stdin)"}
    }

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
                let r = (qr2url-decode $tmp)
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
            qr2url-decode $img_path
        }

        let payloads = match $decoded.code {
            0 => $decoded.payloads
            2 => { print -e $"cannot read image: ($img_path)"; [] }
            3 => []   # no QR in this file; aggregate decides below
            _ => { print -e ("decode failed: " + $img_path + " (helper exit " + ($decoded.code | into string) + ")"); [] }
        }

        for payload in $payloads {
            let t = (if $raw { 'plain' } else { classify-payload $payload })
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
