import Foundation
import CoreGraphics

@main enum Tests {
    static func main() {
        let panel = CGRect(x: 100, y: 100, width: 300, height: 180)
        var failures = 0
        var assertions = 0
        func check(_ condition: Bool, _ label: String) {
            assertions += 1
            if !condition { failures += 1; print("FAIL: \(label)") }
        }
        var click = GestureState()
        check(!click.handle(.down, at: CGPoint(x: 10, y: 10), panel: panel).suppress, "outside input passes untouched")
        check(click.handle(.down, at: CGPoint(x: 120, y: 120), panel: panel).suppress, "hold inside down until click or drag known")
        let clicked = click.handle(.up, at: CGPoint(x: 121, y: 120), panel: panel)
        check(clicked.suppress && clicked.actions.contains(.replayClick), "single click replays exactly after release")
        check(!click.handle(.up, at: CGPoint(x: 121, y: 120), panel: panel).actions.contains(.replayClick), "up cannot replay same click twice")

        var drag = GestureState()
        _ = drag.handle(.down, at: CGPoint(x: 120, y: 120), panel: panel)
        let moved = drag.handle(.drag, at: CGPoint(x: 150, y: 160), panel: panel)
        check(moved.suppress, "drag never reaches underlying app")
        check(moved.actions.contains(.dragging(true)), "drag exposes active state")
        check(moved.actions.contains(.movePanel(CGPoint(x: 130, y: 140))), "panel uses original pointer offset")
        let far = drag.handle(.drag, at: CGPoint(x: 900, y: 900), panel: panel)
        check(far.suppress && far.actions.contains(.movePanel(CGPoint(x: 880, y: 880))), "drag continues outside original panel")
        let ended = drag.handle(.up, at: CGPoint(x: 900, y: 900), panel: panel)
        check(ended.suppress && ended.actions.contains(.dragging(false)), "drag ends cleanly on release")
        check(!ended.actions.contains(.replayClick), "drag cannot activate background controls")

        var jitter = GestureState()
        _ = jitter.handle(.down, at: CGPoint(x: 120, y: 120), panel: panel)
        _ = jitter.handle(.drag, at: CGPoint(x: 122, y: 122), panel: panel)
        check(jitter.handle(.up, at: CGPoint(x: 122, y: 122), panel: panel).actions.contains(.replayClick), "small pointer jitter stays a click")

        var cancelled = GestureState()
        _ = cancelled.handle(.down, at: CGPoint(x: 120, y: 120), panel: panel)
        _ = cancelled.cancel()
        check(!cancelled.handle(.up, at: CGPoint(x: 120, y: 120), panel: panel).suppress, "cancel clears captured state")
        check(!cancelled.handle(.up, at: CGPoint(x: 120, y: 120), panel: panel).actions.contains(.replayClick), "cancel never replays a stale click")

        var hover = GestureState()
        check(hover.handle(.move, at: CGPoint(x: 130, y: 130), panel: panel).actions.contains(.hover(true)), "hover enters overlay")
        check(hover.handle(.move, at: CGPoint(x: 20, y: 20), panel: panel).actions.contains(.hover(false)), "hover leaves overlay")
        let base = CGRect(x: 100, y: 100, width: 300, height: 182)
        func resize(_ from: CGPoint, _ to: CGPoint) -> CGRect {
            var edge = GestureState()
            _ = edge.handle(.down, at: from, panel: base)
            let result = edge.handle(.drag, at: to, panel: base)
            check(result.suppress, "edge resize never drags background")
            for action in result.actions { if case let .resizePanel(frame) = action { return frame } }
            return .zero
        }
        let right = resize(CGPoint(x:398,y:190),CGPoint(x:458,y:190))
        check(abs(right.width-360)<0.001 && abs(right.height-218.4)<0.001, "right edge scales width and height together")
        check(abs(right.minX-100)<0.001 && abs(right.midY-base.midY)<0.001,"right resize anchors left edge and vertical centre")
        let corner = resize(CGPoint(x:398,y:280),CGPoint(x:498,y:340))
        check(abs(corner.width-400)<0.001 && abs(corner.minX-100)<0.001 && abs(corner.minY-100)<0.001,"corner preserves opposite corner")
        let minimum = resize(CGPoint(x:102,y:190),CGPoint(x:500,y:190))
        check(abs(minimum.width-240)<0.001 && abs(minimum.maxX-400)<0.001,"left edge stops at minimum without moving opposite edge")
        let maximum = resize(CGPoint(x:398,y:190),CGPoint(x:2000,y:190))
        check(abs(maximum.width-600)<0.001,"edge resize stops at maximum")
        let top = resize(CGPoint(x:250,y:102),CGPoint(x:250,y:62))
        check(abs(top.height-222)<0.001 && abs(top.maxY-282)<0.001,"top edge preserves aspect and opposite bottom edge")
        // The visible 26-point rounded corner grows with the panel. At 1.5x,
        // its 45-degree outline sits about 11.4 points inside both frame edges.
        let enlarged = CGRect(x:100,y:100,width:450,height:273)
        var visibleCorner = GestureState()
        _ = visibleCorner.handle(.down,at:CGPoint(x:538,y:361),panel:enlarged)
        let cornerDrag = visibleCorner.handle(.drag,at:CGPoint(x:588,y:391),panel:enlarged)
        check(cornerDrag.actions.contains{if case .resizePanel = $0{return true};return false},"enlarged visible rounded corner starts resize")
        check(!cornerDrag.actions.contains{if case .movePanel = $0{return true};return false},"visible rounded corner does not move the entire panel")
        print("\(assertions - failures)/\(assertions) assertions passed")
        if failures > 0 { exit(1) }
    }
}
