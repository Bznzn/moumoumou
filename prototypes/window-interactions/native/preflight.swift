import AppKit
import ApplicationServices
import Foundation

// Read-only: never request or grant OS access, never inject input events.
let result: [String: Any] = [
    "os": ProcessInfo.processInfo.operatingSystemVersionString,
    "accessibilityTrusted": AXIsProcessTrusted(),
    "listenEventAccess": CGPreflightListenEventAccess(),
    "postEventAccess": CGPreflightPostEventAccess(),
    "threeFingerDragBuiltIn": UserDefaults(suiteName: "com.apple.AppleMultitouchTrackpad")?.object(forKey: "TrackpadThreeFingerDrag") ?? NSNull(),
    "threeFingerDragBluetooth": UserDefaults(suiteName: "com.apple.driver.AppleBluetoothMultitouch.trackpad")?.object(forKey: "TrackpadThreeFingerDrag") ?? NSNull(),
    "displays": NSScreen.screens.count
]
let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
print(String(decoding: data, as: UTF8.self))
