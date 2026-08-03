# qr2url.nu — decode QR code images to URLs via macOS Vision framework.
#
# Source from config.nu, then call directly:
#   qr2url a.png b.png      decode one or more image files
#   qr2url -                read image from stdin
#   qr2url --json a.png     output as JSON array
#
# No deps — uses macOS built-in Vision barcode detector. First run compiles
# a tiny Swift helper binary and caches it next to this script.

const QR2URL_HELPER = "/Users/bytedance/dotfiles/.qr_decode_helper"

const QR2URL_SWIFT_SRC = '
import Cocoa
import Vision
import CoreImage

let args = CommandLine.arguments
guard args.count == 2 else { exit(1) }
let path = args[1]

guard let img = CIImage(contentsOf: URL(fileURLWithPath: path)) else { exit(1) }

let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
let handler = VNImageRequestHandler(ciImage: img)
try handler.perform([request])

guard let results = request.results, !results.isEmpty else { exit(1) }
for r in results {
    if let p = r.payloadStringValue { print(p) }
}
'

# Compile the Swift barcode detector binary if not already cached.
def qr2url-ensure-helper [] {
    if ($QR2URL_HELPER | path exists) {
        return $QR2URL_HELPER
    }
    let src = (mktemp -t XXXXXX.swift)
    $QR2URL_SWIFT_SRC | save -f $src
    try {
        swiftc -O -o $QR2URL_HELPER $src
    } catch {
        rm -f $src
        error make {msg: "swiftc compile failed"}
    }
    rm -f $src
    $QR2URL_HELPER
}

# Decode one image file → list of payload strings.
def qr2url-decode [image_path: string] {
    let helper = (qr2url-ensure-helper)
    let res = (do { ^$helper $image_path } | complete)
    if $res.exit_code != 0 {
        return []
    }
    $res.stdout | str trim | lines | where {|l| ($l | str length) > 0 }
}

# Decode QR codes from images to URLs.
export def qr2url [
    --json          # output as JSON array
    ...images: string  # image file paths (use '-' for stdin)
] {
    if ($images | is-empty) {
        error make {msg: "no image given (use '-' for stdin)"}
    }

    mut all_results = []

    for img_path in $images {
        let urls = if $img_path == "-" {
            let data = ($in | default (^cat))
            let tmp = (mktemp -t XXXXXX.bin)
            $data | save -fr $tmp
            let r = (qr2url-decode $tmp)
            rm -f $tmp
            $r
        } else {
            if not ($img_path | path exists) {
                print -e $"File not found: ($img_path)"
                return
            }
            qr2url-decode $img_path
        }

        for url in $urls {
            $all_results = ($all_results | append {file: $img_path, url: $url})
        }
    }

    if ($all_results | is-empty) {
        print -e "No QR codes found."
        return
    }

    if $json {
        $all_results | to json
    } else {
        for r in $all_results { print $r.url }
    }
}
