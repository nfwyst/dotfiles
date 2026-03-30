import Foundation

typealias IOHIDEventSystemClientRef = AnyObject
typealias IOHIDServiceClientRef = AnyObject
typealias IOHIDEventRef = AnyObject

@_silgen_name("IOHIDEventSystemClientCreateWithType")
func IOHIDEventSystemClientCreateWithType(
    _ allocator: CFAllocator?, _ clientType: Int32, _ attributes: CFDictionary?
) -> IOHIDEventSystemClientRef

@_silgen_name("IOHIDEventSystemClientSetMatching")
func IOHIDEventSystemClientSetMatching(_ client: IOHIDEventSystemClientRef, _ matching: CFDictionary)

@_silgen_name("IOHIDEventSystemClientCopyServices")
func IOHIDEventSystemClientCopyServices(_ client: IOHIDEventSystemClientRef) -> CFArray?

@_silgen_name("IOHIDServiceClientCopyEvent")
func IOHIDServiceClientCopyEvent(
    _ service: IOHIDServiceClientRef, _ type: Int64,
    _ matching: CFDictionary?, _ options: Int64
) -> IOHIDEventRef?

@_silgen_name("IOHIDEventGetFloatValue")
func IOHIDEventGetFloatValue(_ event: IOHIDEventRef, _ field: UInt32) -> Double

// MARK: - Config

struct Config {
    let thresholdDark: Double
    let thresholdLight: Double
    let dryRun: Bool

    init() {
        self.thresholdDark  = Self.double("ALS_THRESHOLD_DARK",  default: 50.0)
        self.thresholdLight = Self.double("ALS_THRESHOLD_LIGHT", default: 200.0)
        self.dryRun         = Self.bool("ALS_DRY_RUN",           default: false)
    }

    private static func double(_ key: String, default fallback: Double) -> Double {
        ProcessInfo.processInfo.environment[key]
            .flatMap(Double.init) ?? fallback
    }

    private static func bool(_ key: String, default fallback: Bool) -> Bool {
        guard let raw = ProcessInfo.processInfo.environment[key] else { return fallback }
        return ["1", "true", "yes"].contains(raw.lowercased())
    }
}

// MARK: - Read ALS

func readALS() -> (lux: Double, level: Double)? {
    // Apple Silicon: ALS registered under vendor-defined usage page
    let client = IOHIDEventSystemClientCreateWithType(kCFAllocatorDefault, 1, nil)

    let matching: [String: Int] = [
        "PrimaryUsagePage": 65280,  // 0xFF00
        "PrimaryUsage":     4,
    ]
    IOHIDEventSystemClientSetMatching(client, matching as CFDictionary)

    guard let services = IOHIDEventSystemClientCopyServices(client) as? [AnyObject],
          let service = services.first else {
        return nil
    }

    guard let event = IOHIDServiceClientCopyEvent(service, 12, nil, 0) else {
        return nil
    }

    let lux   = IOHIDEventGetFloatValue(event, 0x000C_0004)
    let level = IOHIDEventGetFloatValue(event, 0x000C_0001)
    return (lux: lux, level: level)
}

// MARK: - Theme

func isDarkMode() -> Bool {
    UserDefaults.standard.string(forKey: "AppleInterfaceStyle") == "Dark"
}

func setDarkMode(_ enabled: Bool) {
    let mode = enabled ? "true" : "false"
    let script = "tell application \"System Events\" to tell appearance preferences to set dark mode to \(mode)"
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    proc.arguments = ["-e", script]
    proc.standardOutput = FileHandle.nullDevice
    proc.standardError = FileHandle.nullDevice
    try? proc.run()
    proc.waitUntilExit()
}

// MARK: - Main

let config = Config()

guard let als = readALS() else { exit(1) }

let dark = isDarkMode()

if !config.dryRun {
    if als.lux < config.thresholdDark && !dark {
        setDarkMode(true)
    } else if als.lux > config.thresholdLight && dark {
        setDarkMode(false)
    }
}
