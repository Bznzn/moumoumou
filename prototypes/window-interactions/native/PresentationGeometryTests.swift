import Foundation
import CoreGraphics
@main enum GeometryTests {
    static func main() {
        let display = CGRect(x: 0, y: 0, width: 1710, height: 1107)
        let cases: [(CGRect, CGRect, CGFloat, Bool, String)] = [
            (display, display, 0, true, "exact full display"),
            (CGRect(x: 0, y: 32, width: 1710, height: 1075), display, 32, true, "full screen respecting notch"),
            (CGRect(x: 0, y: 32, width: 1710, height: 1000), display, 32, false, "ordinary maximized window stops above dock"),
            (CGRect(x: 200, y: 100, width: 660, height: 450), display, 0, false, "normal work window"),
            (CGRect(x: 1710, y: -413, width: 2560, height: 1440), CGRect(x: 1710, y: -413, width: 2560, height: 1440), 0, true, "negative origin secondary display"),
            (CGRect(x: 0, y: 0, width: 1700, height: 1107), display, 0, false, "missing horizontal strip is not fullscreen")
        ]
        var failed = 0
        for (window, screen, safeTop, expected, name) in cases {
            if coversDisplay(window: window, display: screen, safeTop: safeTop) != expected { failed += 1; print("FAIL: \(name)") }
        }
        // Observed fullscreen content: y=38 vs safe-area=33, menu-bar inset=39.
        // The system menu band and the camera safe area are not the same height.
        let menuCases: [(CGRect, CGFloat, CGFloat, Bool, String)] = [
            (CGRect(x:0,y:38,width:1710,height:1069),33,39,true,"fullscreen below actual menu band"),
            (CGRect(x:0,y:39,width:1710,height:1000),33,39,false,"maximized still stops above dock"),
            (CGRect(x:0,y:90,width:1710,height:1017),33,39,false,"large unexplained top gap"),
            (CGRect(x:0,y:24,width:1710,height:1083),0,24,true,"menu band without notch")
        ]
        for (window, safeTop, menuInset, expected, name) in menuCases {
            if coversDisplay(window:window,display:display,safeTop:safeTop,menuBarInset:menuInset) != expected { failed += 1; print("FAIL: \(name)") }
        }
        print("\(cases.count+menuCases.count-failed)/\(cases.count+menuCases.count) geometry assertions passed")
        if failed > 0 { exit(1) }
    }
}
