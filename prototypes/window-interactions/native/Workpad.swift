import AppKit
import Foundation

final class WorkView: NSView {
    let counter = NSTextField(labelWithString: "真实后方应用：down 0 / up 0 / drag 0")
    var downs = 0
    var ups = 0
    var drags = 0
    func refresh() {
        counter.stringValue = "真实后方应用：down \(downs) / up \(ups) / drag \(drags)"
        let data: [String: Any] = ["type": "workpad-input", "downs": downs, "ups": ups, "drags": drags]
        if let line = try? JSONSerialization.data(withJSONObject: data) { FileHandle.standardOutput.write(line + Data([10])) }
    }
    override func mouseDown(with event: NSEvent) { downs += 1; refresh() }
    override func mouseUp(with event: NSEvent) { ups += 1; refresh() }
    override func mouseDragged(with event: NSEvent) { drags += 1; refresh() }
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

final class Delegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    func applicationDidFinishLaunching(_ notification: Notification) {
        let area = NSScreen.main?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1000, height: 700)
        window = NSWindow(contentRect: CGRect(x: area.midX - 330, y: area.midY - 225, width: 660, height: 450), styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Salary Probe — 独立原生后方应用"
        window.collectionBehavior = [.fullScreenPrimary]
        let view = WorkView(frame: window.contentView!.bounds)
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(calibratedWhite: 0.16, alpha: 1).cgColor
        let title = NSTextField(labelWithString: "在悬浮窗覆盖区域单击 / 拖动")
        title.textColor = .white
        title.font = .systemFont(ofSize: 22)
        title.frame = CGRect(x: 30, y: 360, width: 600, height: 35)
        view.addSubview(title)
        view.counter.textColor = .systemGreen
        view.counter.font = .monospacedSystemFont(ofSize: 15, weight: .regular)
        view.counter.frame = CGRect(x: 30, y: 30, width: 600, height: 30)
        view.addSubview(view.counter)
        let note = NSTextField(wrappingLabelWithString: "这是独立进程的 AppKit 窗口，不是网页转发计数。单击应只增加一次 down/up；拖动悬浮窗时，此处 drag 不应增加。绿色窗口按钮可用于原生全屏对照。")
        note.textColor = .lightGray
        note.font = .systemFont(ofSize: 14)
        note.frame = CGRect(x: 30, y: 95, width: 600, height: 68)
        view.addSubview(note)
        window.contentView = view
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        print("{\"type\":\"workpad-ready\",\"pid\":\(ProcessInfo.processInfo.processIdentifier)}")
        fflush(stdout)
        if CommandLine.arguments.contains("--verify-presentation") {
            NotificationCenter.default.addObserver(forName: NSWindow.didEnterFullScreenNotification, object: window, queue: .main) { [weak self] _ in
                print("{\"type\":\"workpad-fullscreen-entered\",\"presentation\":\(NSApp.currentSystemPresentationOptions.rawValue),\"appActive\":\(NSApp.isActive)}"); fflush(stdout)
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self?.window.toggleFullScreen(nil) }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                print("{\"type\":\"workpad-toggle-requested\"}"); fflush(stdout)
                self?.window.toggleFullScreen(nil)
            }
        }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = Delegate()
app.delegate = delegate
app.run()
