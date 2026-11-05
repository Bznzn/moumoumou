import AppKit
import Foundation

// Public AppKit presentation API. No AX attributes, window titles, screen capture,
// private Space APIs or additional permissions are used.
@main enum PresentationMain {
static func main() {
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
var lastValue: Bool?
func emitPresentation() {
    let options = app.currentSystemPresentationOptions
    var matchesDisplay = false
    if let frontPID = NSWorkspace.shared.frontmostApplication?.processIdentifier,
       let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] {
        for info in windows {
            guard (info[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == frontPID,
                  (info[kCGWindowLayer as String] as? NSNumber)?.intValue == 0,
                  let bounds = info[kCGWindowBounds as String] as? NSDictionary,
                  let rectangle = CGRect(dictionaryRepresentation: bounds) else { continue }
            for screen in NSScreen.screens {
                guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else { continue }
                let menuInset = max(0,screen.frame.maxY-screen.visibleFrame.maxY)
                if coversDisplay(window: rectangle, display: CGDisplayBounds(number.uint32Value), safeTop: screen.safeAreaInsets.top, menuBarInset: menuInset) { matchesDisplay = true }
            }
        }
    }
    let full = options.contains(.fullScreen) || matchesDisplay
    guard lastValue != full else { return }
    lastValue = full
    let value: [String: Any] = ["type": "fullscreen", "value": full, "rawValue": options.rawValue, "source": matchesDisplay ? "public-window-geometry" : "NSApplication.currentSystemPresentationOptions"]
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) { FileHandle.standardOutput.write(data + Data([10])) }
}
if CommandLine.arguments.contains("--once") { emitPresentation(); exit(0) }
let observation = app.observe(\.currentSystemPresentationOptions, options: [.initial, .new]) { _, _ in emitPresentation() }
let timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { _ in emitPresentation() }
withExtendedLifetime((observation, timer)) { app.run() }
}
}
