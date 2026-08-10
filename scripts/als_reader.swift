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

// MARK: - Theme state sync

func atomicWrite(_ content: String, to url: URL) throws {
    let dir = url.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let tmp = dir.appendingPathComponent(".\(url.lastPathComponent).tmp-\(getpid())")
    try Data(content.utf8).write(to: tmp, options: [.atomic])
    _ = try FileManager.default.replaceItemAt(url, withItemAt: tmp)
}

func syncTheme(_ dark: Bool) {
    let fm = FileManager.default
    let home = fm.homeDirectoryForCurrentUser
    let state = home.appendingPathComponent(".local/state", isDirectory: true)
    let themeDir = state.appendingPathComponent("theme", isDirectory: true)
    let deltaDir = state.appendingPathComponent("delta", isDirectory: true)
    let modeURL = themeDir.appendingPathComponent("mode")
    let deltaURL = deltaDir.appendingPathComponent("theme.gitconfig")

    let modeContent = dark ? "dark\n" : "light\n"
    let features = dark ? "woolly-mammoth" : "hoopoe"
    let deltaContent = "[delta]\n    features = \(features)\n"

    let themePath = home.appendingPathComponent(
        dark ? ".config/tmux/tmux-dark.conf" : ".config/tmux/tmux-light.conf"
    ).path
    let socket = "/private/tmp/tmux-\(getuid())/default"
    let socketExists = fm.fileExists(atPath: socket)

    if config.dryRun {
        print("[dry-run] write mode '\(modeContent.trimmingCharacters(in: .newlines))' -> \(modeURL.path)")
        print("[dry-run] write delta 'features = \(features)' -> \(deltaURL.path)")
        if socketExists {
            print("[dry-run] run tmux -S \(socket) source-file \(themePath)")
        } else {
            print("[dry-run] tmux: skip (no socket \(socket))")
        }
        print("[dry-run] plist: untouched (env.nu owns ~/Library/LaunchAgents/com.user.als-theme.plist)")
        return
    }

    // Content-compare guard: skip writes + tmux source when state already matches.
    // (External edits still heal: content differs → reconcile. No last-mode state:
    //  als_reader is a fresh process each poll, disk is the source of truth.)
    let existingMode = (try? String(contentsOf: modeURL, encoding: .utf8)) ?? ""
    let existingDelta = (try? String(contentsOf: deltaURL, encoding: .utf8)) ?? ""
    if existingMode == modeContent && existingDelta == deltaContent {
        return
    }

    do {
        try fm.createDirectory(at: themeDir, withIntermediateDirectories: true)
        try fm.createDirectory(at: deltaDir, withIntermediateDirectories: true)
        try atomicWrite(modeContent, to: modeURL)
        try atomicWrite(deltaContent, to: deltaURL)
    } catch {
        FileHandle.standardError.write(Data("als_reader: theme state write failed: \(error)\n".utf8))
    }

    guard socketExists else { return }
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/tmux")
    proc.arguments = ["-S", socket, "source-file", themePath]
    proc.standardOutput = FileHandle.nullDevice
    proc.standardError = FileHandle.nullDevice
    do {
        try proc.run()
        proc.waitUntilExit()
    } catch {
        FileHandle.standardError.write(Data("als_reader: tmux source failed: \(error)\n".utf8))
    }
}

let config = Config()

guard let als = readALS() else {
    FileHandle.standardError.write(Data("als_reader: sensor unavailable, syncing from system appearance\n".utf8))
    syncTheme(isDarkMode())
    exit(0)
}

let dark = isDarkMode()
var effectiveDark = dark

if !config.dryRun {
    if als.lux < config.thresholdDark && !dark {
        effectiveDark = setDarkMode(true) ? true : dark
    } else if als.lux > config.thresholdLight && dark {
        effectiveDark = setDarkMode(false) ? false : dark
    }
}

syncTheme(effectiveDark)
