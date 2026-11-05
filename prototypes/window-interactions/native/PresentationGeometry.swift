import CoreGraphics
func coversDisplay(window: CGRect, display: CGRect, safeTop: CGFloat, menuBarInset: CGFloat = 0) -> Bool {
    let tolerance: CGFloat = 2
    let horizontal = abs(window.minX - display.minX) <= tolerance && abs(window.maxX - display.maxX) <= tolerance
    let bottom = abs(window.maxY - display.maxY) <= tolerance
    let top = [CGFloat(0),safeTop,menuBarInset].contains { inset in
        inset >= 0 && abs(window.minY - display.minY - inset) <= tolerance
    }
    return horizontal && bottom && top && window.width > 0 && window.height > 0
}
