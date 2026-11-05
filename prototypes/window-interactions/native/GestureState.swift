import Foundation
import CoreGraphics

enum PointerKind { case down, move, drag, up }
enum GestureAction: Equatable {
    case hover(Bool)
    case dragging(Bool)
    case movePanel(CGPoint)
    case resizePanel(CGRect)
    case replayClick
    static func == (lhs: GestureAction, rhs: GestureAction) -> Bool {
        switch (lhs, rhs) {
        case let (.hover(a), .hover(b)), let (.dragging(a), .dragging(b)): return a == b
        case let (.movePanel(a), .movePanel(b)): return a.x == b.x && a.y == b.y
        case let (.resizePanel(a), .resizePanel(b)): return a.origin.x == b.origin.x && a.origin.y == b.origin.y && a.width == b.width && a.height == b.height
        case (.replayClick, .replayClick): return true
        default: return false
        }
    }
}
struct GestureDecision {
    var suppress: Bool
    var actions: [GestureAction]
}
struct GestureState {
    private var down: CGPoint?
    private var origin: CGPoint?
    private var moved = false
    private var hovered = false
    private var original = CGRect.zero
    private var edgeX: CGFloat = 0
    private var edgeY: CGFloat = 0
    mutating func handle(_ kind: PointerKind, at point: CGPoint, panel: CGRect) -> GestureDecision {
        var actions: [GestureAction] = []
        let inside = panel.contains(point)
        if hovered != inside { hovered = inside; actions.append(.hover(inside)) }
        switch kind {
        case .down:
            guard inside else { return GestureDecision(suppress: false, actions: actions) }
            down = point
            origin = panel.origin
            original = panel
            let edgeWidth = 12 * panel.width / 300
            edgeX = point.x-panel.minX <= edgeWidth ? -1 : panel.maxX-point.x <= edgeWidth ? 1 : 0
            edgeY = point.y-panel.minY <= edgeWidth ? -1 : panel.maxY-point.y <= edgeWidth ? 1 : 0
            moved = false
            return GestureDecision(suppress: true, actions: actions)
        case .drag:
            guard let down = down, let origin = origin else { return GestureDecision(suppress: false, actions: actions) }
            let dx = point.x - down.x
            let dy = point.y - down.y
            if !moved && hypot(dx, dy) > 5 { moved = true; actions.append(.dragging(true)) }
            if moved {
                if edgeX != 0 || edgeY != 0 {
                    let aspect: CGFloat = 300 / 182
                    let horizontal = dx * edgeX
                    let vertical = dy * edgeY * aspect
                    let delta = edgeX == 0 ? vertical : edgeY == 0 ? horizontal : abs(horizontal) >= abs(vertical) ? horizontal : vertical
                    let width = min(600, max(240, original.width + delta))
                    let height = width / aspect
                    let x = edgeX < 0 ? original.maxX-width : edgeX > 0 ? original.minX : original.midX-width/2
                    let y = edgeY < 0 ? original.maxY-height : edgeY > 0 ? original.minY : original.midY-height/2
                    actions.append(.resizePanel(CGRect(x:x,y:y,width:width,height:height)))
                } else { actions.append(.movePanel(CGPoint(x: origin.x + dx, y: origin.y + dy))) }
            }
            return GestureDecision(suppress: true, actions: actions)
        case .up:
            guard down != nil else { return GestureDecision(suppress: false, actions: actions) }
            if moved { actions.append(.dragging(false)) } else { actions.append(.replayClick) }
            down = nil
            origin = nil
            moved = false
            return GestureDecision(suppress: true, actions: actions)
        case .move:
            return GestureDecision(suppress: false, actions: actions)
        }
    }
    mutating func cancel() -> GestureDecision {
        down = nil
        origin = nil
        let wasMoving = moved
        moved = false
        return GestureDecision(suppress: false, actions: wasMoving ? [.dragging(false)] : [])
    }
}
