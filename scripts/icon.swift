import AppKit
import Foundation
// Packaging conversion only: preserve the generated artwork and its alpha.
let source=CommandLine.arguments[1]
let destination=CommandLine.arguments[2]
guard let original=NSImage(contentsOfFile:source) else {fatalError("Cannot read icon source")}
try FileManager.default.createDirectory(atPath:destination,withIntermediateDirectories:true)
for size in [16,32,64,128,256,512,1024] {
    let pixels=CGFloat(size)
    let image=NSImage(size:NSSize(width:pixels,height:pixels))
    image.lockFocus()
    NSGraphicsContext.current?.imageInterpolation = .high
    original.draw(in:NSRect(x:0,y:0,width:pixels,height:pixels),from:.zero,operation:.copy,fraction:1)
    image.unlockFocus()
    let rep=NSBitmapImageRep(data:image.tiffRepresentation!)!
    let png=rep.representation(using:.png,properties:[:])!
    let names:[String]
    switch size {
    case 16:names=["icon_16x16.png"]
    case 32:names=["icon_16x16@2x.png","icon_32x32.png"]
    case 64:names=["icon_32x32@2x.png"]
    case 128:names=["icon_128x128.png"]
    case 256:names=["icon_128x128@2x.png","icon_256x256.png"]
    case 512:names=["icon_256x256@2x.png","icon_512x512.png"]
    default:names=["icon_512x512@2x.png"]
    }
    for name in names {try png.write(to:URL(fileURLWithPath:destination).appendingPathComponent(name))}
}
