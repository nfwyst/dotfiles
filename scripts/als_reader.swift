import Foundation

typealias IOHIDEventSystemClientRef = AnyObject
typealias IOHIDServiceClientRef = AnyObject
typealias IOHIDEventRef = AnyObject

@_silgen_name("IOHIDEventSystemClientCreateWithType")
func IOHIDEventSystemClientCreateWithType(
    _ allocator: CFAllocator?, _ clientType: Int32, _ attributes: CFDictionary?
) -> IOHIDEventSystemClientRef

@_silgen_name("IOHIDEventSystemClientCopyServices")
func IOHIDEventSystemClientCopyServices(_ client: IOHIDEventSystemClientRef) -> CFArray?

@_silgen_name("IOHIDServiceClientCopyEvent")
func IOHIDServiceClientCopyEvent(
    _ service: IOHIDServiceClientRef, _ type: Int64,
    _ matching: CFDictionary?, _ options: Int64
) -> IOHIDEventRef?

@_silgen_name("IOHIDEventGetFloatValue")
func IOHIDEventGetFloatValue(_ event: IOHIDEventRef, _ field: UInt32) -> Double

@_silgen_name("IOHIDServiceClientCopyProperty")
func IOHIDServiceClientCopyProperty(_ service: IOHIDServiceClientRef, _ key: CFString) -> CFTypeRef?

// MARK: - Config

struct Config {
    let thresholdDark: Double
    let thresholdLight: Double
    let dryRun: Bool

    init(environment: [String: String] = ProcessInfo.processInfo.environment) throws {
        let thresholds = try parseThresholds(environment)
        self.thresholdDark = thresholds.dark
        self.thresholdLight = thresholds.light
        self.dryRun = Self.bool("ALS_DRY_RUN", default: false, environment: environment)
    }

    private static func bool(
        _ key: String, default fallback: Bool, environment: [String: String]
    ) -> Bool {
        guard let raw = environment[key] else { return fallback }
        return ["1", "true", "yes"].contains(raw.lowercased())
    }
}

struct Thresholds {
    let dark: Double
    let light: Double
}

private let defaultDarkThreshold = 50.0
private let defaultLightThreshold = 200.0

enum ConfigError: Error, CustomStringConvertible {
    case invalidThreshold(key: String, value: String)
    case invalidOrder(dark: Double, light: Double)

    var description: String {
        switch self {
        case let .invalidThreshold(key, value):
            return "invalid \(key)=\(value); expected a finite non-negative number"
        case let .invalidOrder(dark, light):
            return "ALS_THRESHOLD_DARK (\(dark)) must be less than ALS_THRESHOLD_LIGHT (\(light))"
        }
    }
}

func parseThresholds(_ environment: [String: String]) throws -> Thresholds {
    func parse(_ key: String, fallback: Double) throws -> Double {
        guard let raw = environment[key] else { return fallback }
        guard let value = Double(raw), value.isFinite, value >= 0 else {
            throw ConfigError.invalidThreshold(key: key, value: raw)
        }
        return value
    }

    let dark = try parse("ALS_THRESHOLD_DARK", fallback: defaultDarkThreshold)
    let light = try parse("ALS_THRESHOLD_LIGHT", fallback: defaultLightThreshold)
    guard dark < light else { throw ConfigError.invalidOrder(dark: dark, light: light) }
    return Thresholds(dark: dark, light: light)
}

// MARK: - Read ALS

func readALS() -> Double? {
    // Apple Silicon: ALS registered under vendor-defined usage page
    let client = IOHIDEventSystemClientCreateWithType(kCFAllocatorDefault, 1, nil)

    // 注意:不用 SetMatching 过滤后同步 CopyServices — launchd 环境下会拿不到服务;
    // 全量枚举 + 手动过滤(实测两种环境均可靠,lux 可读)
    guard let services = IOHIDEventSystemClientCopyServices(client) as? [AnyObject] else {
        return nil
    }
    guard let service = services.first(where: {
        let page = IOHIDServiceClientCopyProperty($0, "PrimaryUsagePage" as CFString) as? NSNumber
        let usage = IOHIDServiceClientCopyProperty($0, "PrimaryUsage" as CFString) as? NSNumber
        return page?.intValue == 0xFF00 && usage?.intValue == 4
    }) else {
        return nil
    }

    guard let event = IOHIDServiceClientCopyEvent(service, 12, nil, 0) else {
        return nil
    }

    return IOHIDEventGetFloatValue(event, 0x000C_0004)
}

// MARK: - Theme

func isDarkMode() -> Bool {
    UserDefaults.standard.string(forKey: "AppleInterfaceStyle") == "Dark"
}

@discardableResult func setDarkMode(_ enabled: Bool) -> Bool {
    let mode = enabled ? "true" : "false"
    let script = "tell application \"System Events\" to tell appearance preferences to set dark mode to \(mode)"
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    proc.arguments = ["-e", script]
    proc.standardOutput = FileHandle.nullDevice
    proc.standardError = FileHandle.nullDevice
    do {
        try proc.run()
    } catch {
        FileHandle.standardError.write(Data("als_reader: osascript launch failed: \(error)\n".utf8))
        return false
    }
    proc.waitUntilExit()
    if proc.terminationStatus != 0 {
        FileHandle.standardError.write(Data("als_reader: osascript failed status=\(proc.terminationStatus)\n".utf8))
    }
    return proc.terminationStatus == 0
}

func run(
    config: Config,
    readLux: () -> Double?,
    currentDarkMode: () -> Bool,
    changeDarkMode: (Bool) -> Bool,
    sync: (Bool, Bool) throws -> Void
) throws {
    guard let lux = readLux() else {
        try sync(currentDarkMode(), config.dryRun)
        return
    }

    let dark = currentDarkMode()
    var effectiveDark = dark
    if !config.dryRun {
        if lux < config.thresholdDark && !dark {
            effectiveDark = changeDarkMode(true) ? true : dark
        } else if lux > config.thresholdLight && dark {
            effectiveDark = changeDarkMode(false) ? false : dark
        }
    }
    try sync(effectiveDark, config.dryRun)
}

func run() throws {
    try run(
        config: Config(),
        readLux: readALS,
        currentDarkMode: isDarkMode,
        changeDarkMode: setDarkMode,
        sync: { try syncTheme($0, dryRun: $1) }
    )
}

#if !ALS_TESTING
@main
struct ALSReader {
    static func main() {
        do {
            try run()
        } catch {
            FileHandle.standardError.write(Data("als_reader: \(error)\n".utf8))
            exit(64)
        }
    }
}
#endif
