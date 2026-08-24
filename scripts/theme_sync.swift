import Foundation
import Darwin

// MARK: - Theme state sync

func atomicWrite(_ content: String, to url: URL) throws {
    let dir = url.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    try Data(content.utf8).write(to: url, options: [.atomic])
}

struct ThemePaths {
    let home: URL
    let socketDirectory: URL

    static var live: ThemePaths {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let socketDirectory = URL(fileURLWithPath: "/private/tmp/tmux-\(getuid())", isDirectory: true)
        return ThemePaths(home: home, socketDirectory: socketDirectory)
    }
}

struct ThemeState {
    let modeURL: URL
    let deltaURL: URL
    let modeContent: String
    let deltaContent: String
    let tmuxPath: String

    init(dark: Bool, home: URL) {
        let state = home.appendingPathComponent(".local/state", isDirectory: true)
        self.modeURL = state.appendingPathComponent("theme/mode")
        self.deltaURL = state.appendingPathComponent("delta/theme.gitconfig")
        self.modeContent = dark ? "dark\n" : "light\n"
        let features = dark ? "woolly-mammoth" : "hoopoe"
        self.deltaContent = "[delta]\n    features = \(features)\n"
        self.tmuxPath = home.appendingPathComponent(
            dark ? ".config/tmux/tmux-dark.conf" : ".config/tmux/tmux-light.conf"
        ).path
    }
}

private let tmuxExecutable = "/opt/homebrew/bin/tmux"
private let tmuxCommandTimeout: TimeInterval = 5
private let tmuxTerminationGrace: TimeInterval = 0.1

private struct TmuxSocket: Equatable {
    let url: URL
    let device: UInt64
    let inode: UInt64
}

private func ownedTmuxSocket(at url: URL) -> TmuxSocket? {
    var metadata = stat()
    guard lstat(url.path, &metadata) == 0,
          metadata.st_mode & S_IFMT == S_IFSOCK,
          metadata.st_uid == getuid() else { return nil }
    return TmuxSocket(url: url, device: UInt64(metadata.st_dev), inode: metadata.st_ino)
}

private func ownedTmuxSockets(in directory: URL) throws -> [TmuxSocket] {
    let fm = FileManager.default
    guard fm.fileExists(atPath: directory.path) else { return [] }
    return try fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        .compactMap(ownedTmuxSocket)
}

private enum TmuxCommandResult {
    case exited(status: Int32, output: Data)
    case timedOut
    case launchFailed(Error)
}

private func runTmux(_ arguments: [String], captureOutput: Bool = false) -> TmuxCommandResult {
    let process = Process()
    let output = captureOutput ? Pipe() : nil
    let exited = DispatchSemaphore(value: 0)
    process.executableURL = URL(fileURLWithPath: tmuxExecutable)
    process.arguments = arguments
    process.standardOutput = output ?? FileHandle.nullDevice
    process.standardError = FileHandle.nullDevice
    process.terminationHandler = { _ in exited.signal() }
    do {
        try process.run()
    } catch {
        return .launchFailed(error)
    }
    guard exited.wait(timeout: .now() + tmuxCommandTimeout) == .timedOut else {
        process.waitUntilExit()
        return .exited(
            status: process.terminationStatus,
            output: output?.fileHandleForReading.readDataToEndOfFile() ?? Data()
        )
    }
    process.terminate()
    if exited.wait(timeout: .now() + tmuxTerminationGrace) == .timedOut {
        _ = kill(process.processIdentifier, SIGKILL)
    }
    process.waitUntilExit()
    return .timedOut
}

func updateThemeState(_ state: ThemeState) throws {
    let fm = FileManager.default
    let existingMode = (try? String(contentsOf: state.modeURL, encoding: .utf8)) ?? ""
    let existingDelta = (try? String(contentsOf: state.deltaURL, encoding: .utf8)) ?? ""
    // Content-compare guard: skip writes when state already matches.
    // (External edits still heal: content differs → reconcile. No last-mode state:
    //  als_reader is a fresh process each poll, disk is the source of truth.)
    guard existingMode != state.modeContent || existingDelta != state.deltaContent else { return }

    try fm.createDirectory(at: state.modeURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try fm.createDirectory(at: state.deltaURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try atomicWrite(state.modeContent, to: state.modeURL)
    do {
        try atomicWrite(state.deltaContent, to: state.deltaURL)
    } catch {
        if existingMode.isEmpty {
            try fm.removeItem(at: state.modeURL)
        } else {
            try atomicWrite(existingMode, to: state.modeURL)
        }
        throw error
    }
}

struct TmuxSyncError: Error, CustomStringConvertible {
    let failures: [String]

    var description: String {
        "tmux theme sync failed: \(failures.joined(separator: "; "))"
    }
}

func sourceTmuxTheme(_ themePath: String, mode: String, sockets: [URL]) throws {
    try sourceTmuxTheme(themePath, mode: mode, sockets: sockets.compactMap(ownedTmuxSocket))
}

private func sourceTmuxTheme(_ themePath: String, mode: String, sockets: [TmuxSocket]) throws {
    var failures: [String] = []
    for socket in sockets {
        guard ownedTmuxSocket(at: socket.url) == socket else { continue }
        let query = runTmux(
            ["-S", socket.url.path, "show-options", "-gqv", "@theme_mode"],
            captureOutput: true
        )
        guard case let .exited(status, output) = query else {
            switch query {
            case .timedOut:
                failures.append("query socket=\(socket.url.path) timed out")
            case let .launchFailed(error):
                failures.append("query socket=\(socket.url.path): \(error)")
            case .exited:
                break
            }
            continue
        }
        guard status == 0 else { continue }
        let currentMode = String(data: output, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard currentMode != mode else { continue }
        guard ownedTmuxSocket(at: socket.url) == socket else { continue }
        switch runTmux(["-S", socket.url.path, "source-file", themePath]) {
        case let .exited(status, _):
            if status != 0 { failures.append("source socket=\(socket.url.path) status=\(status)") }
        case .timedOut:
            failures.append("source socket=\(socket.url.path) timed out")
        case let .launchFailed(error):
            failures.append("source socket=\(socket.url.path): \(error)")
        }
    }
    if !failures.isEmpty { throw TmuxSyncError(failures: failures) }
}

func syncTheme(_ dark: Bool, dryRun: Bool, paths: ThemePaths = .live) throws {
    let state = ThemeState(dark: dark, home: paths.home)
    let sockets = try ownedTmuxSockets(in: paths.socketDirectory)
    if dryRun {
        print("[dry-run] write mode '\(state.modeContent.trimmingCharacters(in: .newlines))' -> \(state.modeURL.path)")
        print("[dry-run] write delta -> \(state.deltaURL.path)")
        if sockets.isEmpty {
            print("[dry-run] tmux: skip (no sockets in \(paths.socketDirectory.path))")
        } else {
            for socket in sockets {
                print("[dry-run] run tmux -S \(socket.url.path) source-file \(state.tmuxPath)")
            }
        }
        print("[dry-run] plist: untouched (env.nu owns ~/Library/LaunchAgents/com.user.als-theme.plist)")
        return
    }
    try updateThemeState(state)
    try sourceTmuxTheme(
        state.tmuxPath,
        mode: state.modeContent.trimmingCharacters(in: .newlines),
        sockets: sockets
    )
}
