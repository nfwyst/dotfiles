import Foundation

private var failures = 0

private func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() {
        failures += 1
        FileHandle.standardError.write(Data("FAIL: \(message)\n".utf8))
    }
}

private struct RunCase {
    let name: String
    let lux: Double
    let initialDark: Bool
    let changeSucceeds: Bool
    let dryRun: Bool
    let expectedChange: Bool?
    let expectedDark: Bool
}

private func testRun(_ test: RunCase) {
    do {
        let config = try Config(environment: [
            "ALS_THRESHOLD_DARK": "100",
            "ALS_THRESHOLD_LIGHT": "200",
            "ALS_DRY_RUN": test.dryRun ? "1" : "0",
        ])
        var requestedChange: Bool?
        var synchronizedDark: Bool?
        var synchronizedDryRun: Bool?
        try run(
            config: config,
            readLux: { test.lux },
            currentDarkMode: { test.initialDark },
            changeDarkMode: { requested in
                requestedChange = requested
                return test.changeSucceeds
            },
            sync: { dark, synchronizedDry in
                synchronizedDark = dark
                synchronizedDryRun = synchronizedDry
            }
        )
        expect(requestedChange == test.expectedChange, "\(test.name): unexpected appearance change")
        expect(synchronizedDark == test.expectedDark, "\(test.name): synchronized wrong appearance")
        expect(synchronizedDryRun == test.dryRun, "\(test.name): synchronized wrong dry-run value")
    } catch {
        expect(false, "\(test.name) failed: \(error)")
    }
}

if CommandLine.arguments.count == 5, CommandLine.arguments[1] == "sync" {
    let paths = ThemePaths(
        home: URL(fileURLWithPath: CommandLine.arguments[3], isDirectory: true),
        socketDirectory: URL(fileURLWithPath: CommandLine.arguments[4], isDirectory: true)
    )
    do {
        try syncTheme(CommandLine.arguments[2] == "dark", dryRun: false, paths: paths)
    } catch {
        FileHandle.standardError.write(Data("FAIL: theme synchronization: \(error)\n".utf8))
        exit(1)
    }
    exit(0)
}

do {
    let thresholds = try parseThresholds([
        "ALS_THRESHOLD_DARK": "100",
        "ALS_THRESHOLD_LIGHT": "200",
    ])
    expect(thresholds.dark == 100, "dark threshold was not preserved")
    expect(thresholds.light == 200, "light threshold was not preserved")
} catch {
    expect(false, "valid thresholds failed: \(error)")
}

do {
    let config = try Config(environment: ["ALS_DRY_RUN": "1"])
    var synchronizedDark: Bool?
    var synchronizedDryRun: Bool?
    var modeChangeAttempted = false
    try run(
        config: config,
        readLux: { nil },
        currentDarkMode: { true },
        changeDarkMode: { _ in
            modeChangeAttempted = true
            return false
        },
        sync: { dark, dryRun in
            synchronizedDark = dark
            synchronizedDryRun = dryRun
        }
    )
    expect(synchronizedDark == true, "missing sensor did not preserve current appearance")
    expect(synchronizedDryRun == true, "missing sensor did not preserve dry-run mode")
    expect(!modeChangeAttempted, "missing sensor attempted an appearance change")
} catch {
    expect(false, "missing-sensor fallback failed: \(error)")
}

testRun(RunCase(
    name: "lux below dark threshold", lux: 99, initialDark: false,
    changeSucceeds: true, dryRun: false, expectedChange: true, expectedDark: true
))
testRun(RunCase(
    name: "lux above light threshold", lux: 201, initialDark: true,
    changeSucceeds: true, dryRun: false, expectedChange: false, expectedDark: false
))
testRun(RunCase(
    name: "dark boundary inside hysteresis band", lux: 100, initialDark: false,
    changeSucceeds: true, dryRun: false, expectedChange: nil, expectedDark: false
))
testRun(RunCase(
    name: "light boundary inside hysteresis band", lux: 200, initialDark: true,
    changeSucceeds: true, dryRun: false, expectedChange: nil, expectedDark: true
))
testRun(RunCase(
    name: "appearance change failure", lux: 99, initialDark: false,
    changeSucceeds: false, dryRun: false, expectedChange: true, expectedDark: false
))
testRun(RunCase(
    name: "dry run", lux: 99, initialDark: false,
    changeSucceeds: true, dryRun: true, expectedChange: nil, expectedDark: false
))

for (name, environment) in [
    ("NaN", ["ALS_THRESHOLD_DARK": "nan", "ALS_THRESHOLD_LIGHT": "200"]),
    ("negative", ["ALS_THRESHOLD_DARK": "-1", "ALS_THRESHOLD_LIGHT": "200"]),
    ("reversed", ["ALS_THRESHOLD_DARK": "300", "ALS_THRESHOLD_LIGHT": "100"]),
] {
    do {
        _ = try parseThresholds(environment)
        expect(false, "\(name) thresholds were accepted")
    } catch {
        continue
    }
}

if failures > 0 { exit(1) }
print("PASS: threshold validation, run hysteresis, and missing-sensor fallback")
