import AppKit
import ApplicationServices
import Foundation

// Experimental adapter. Observes pointer events only, never keyboard/text.
// Input is modified ONLY for a down originating inside the supplied overlay bounds.
// Without Accessibility permission it exits; it does not request permission.
func emit(_ value: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) else { return }
    FileHandle.standardOutput.write(data + Data([10]))
}

final class Router {
    var state = GestureState()
    var panel = CGRect.zero
    var enabled = false
    var tap: CFMachPort?
    var pendingDown: CGEvent?
    let marker: Int64 = 0x53414C415259

    func handle(type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            _ = state.cancel()
            pendingDown = nil
            enabled = false
            emit(["type": "disabled", "reason": "event-tap-disabled"])
            // Fail open; do not silently re-enable an OS-disabled input hook.
            return Unmanaged.passUnretained(event)
        }
        if event.getIntegerValueField(.eventSourceUserData) == marker { return Unmanaged.passUnretained(event) }
        guard enabled else { return Unmanaged.passUnretained(event) }
        let kind: PointerKind
        switch type {
        case .leftMouseDown: kind = .down
        case .leftMouseUp: kind = .up
        case .leftMouseDragged: kind = .drag
        case .mouseMoved: kind = .move
        default: return Unmanaged.passUnretained(event)
        }
        let decision = state.handle(kind, at: event.location, panel: panel)
        if type == .leftMouseDown && decision.suppress { pendingDown = event.copy() }
        for action in decision.actions {
            switch action {
            case let .hover(value): emit(["type": "hover", "value": value])
            case let .dragging(value): emit(["type": "dragging", "value": value])
            case let .movePanel(point): emit(["type": "move", "x": point.x, "y": point.y])
            case let .resizePanel(frame): emit(["type":"resize","x":frame.minX,"y":frame.minY,"width":frame.width,"height":frame.height])
            case .replayClick:
                // Preserve the real mouse events (including click count and flags).
                // Replays are tagged so this tap cannot consume them a second time.
                if let down = pendingDown, let up = event.copy() {
                    down.setIntegerValueField(.eventSourceUserData, value: marker)
                    up.setIntegerValueField(.eventSourceUserData, value: marker)
                    down.post(tap: .cghidEventTap)
                    up.post(tap: .cghidEventTap)
                    emit(["type": "replayed-click"])
                }
            }
        }
        if type == .leftMouseUp { pendingDown = nil }
        return decision.suppress ? nil : Unmanaged.passUnretained(event)
    }
}

@main enum Main {
    static func main() {
        let trusted = AXIsProcessTrusted()
        emit(["type": "permissions", "accessibility": trusted, "listen": CGPreflightListenEventAccess(), "post": CGPreflightPostEventAccess()])
        if CommandLine.arguments.contains("--check") { exit(0) }
        guard trusted else {
            emit(["type": "unavailable", "reason": "accessibility-permission-required", "requestedPermission": false])
            exit(2)
        }
        let router = Router()
        let mask = [CGEventType.leftMouseDown, .leftMouseUp, .leftMouseDragged, .mouseMoved].reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }
        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .defaultTap, eventsOfInterest: mask, callback: { _, type, event, context in
            guard let context = context else { return Unmanaged.passUnretained(event) }
            return Unmanaged<Router>.fromOpaque(context).takeUnretainedValue().handle(type: type, event: event)
        }, userInfo: Unmanaged.passUnretained(router).toOpaque()) else {
            emit(["type": "unavailable", "reason": "event-tap-create-failed"])
            exit(3)
        }
        router.tap = tap
        let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        emit(["type": "ready", "pid": ProcessInfo.processInfo.processIdentifier])
        var buffer = Data()
        FileHandle.standardInput.readabilityHandler = { input in
            let data = input.availableData
            if data.isEmpty {
                DispatchQueue.main.async { router.enabled = false; _ = router.state.cancel(); exit(0) }
                return
            }
            buffer.append(data)
            while let newline = buffer.firstIndex(of: 10) {
                let line = buffer[..<newline]
                buffer.removeSubrange(...newline)
                guard let command = try? JSONSerialization.jsonObject(with: Data(line)) as? [String: Any] else { continue }
                DispatchQueue.main.async {
                    if let enabled = command["enabled"] as? Bool {
                        router.enabled = enabled
                        if !enabled { _ = router.state.cancel(); router.pendingDown = nil }
                    }
                    if let x = command["x"] as? Double, let y = command["y"] as? Double, let width = command["width"] as? Double, let height = command["height"] as? Double,
                       [x,y,width,height].allSatisfy({ $0.isFinite }), width > 0, height > 0 {
                        router.panel = CGRect(x: x, y: y, width: width, height: height)
                    }
                }
            }
        }
        withExtendedLifetime(router) { CFRunLoopRun() }
    }
}
