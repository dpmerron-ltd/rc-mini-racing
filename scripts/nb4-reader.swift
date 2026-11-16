import Foundation
import IOKit.hid
let manager = IOHIDManagerCreate(kCFAllocatorDefault, 0)
IOHIDManagerSetDeviceMatching(manager, [kIOHIDVendorIDKey:0x284e, kIOHIDProductIDKey:0x8d00] as CFDictionary)
IOHIDManagerScheduleWithRunLoop(manager, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
let status = IOHIDManagerOpen(manager,0)
func emit(_ object:[String:Any]) { if let data=try? JSONSerialization.data(withJSONObject:object), let line=String(data:data,encoding:.utf8) { print(line);fflush(stdout) } }
var devices:[IOHIDDevice]=[]
var elements:[IOHIDElement]=[]
var tick=0
let timer=Timer.scheduledTimer(withTimeInterval:1.0/60.0,repeats:true) { _ in
 if tick % 60 == 0 {
  devices=(IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>).map(Array.init) ?? []
  elements=[]
  for device in devices {
   if let all=IOHIDDeviceCopyMatchingElements(device,nil,0) as? [IOHIDElement] {
    elements += all.filter { IOHIDElementGetUsagePage($0)==1 && (48...55).contains(IOHIDElementGetUsage($0)) }
   }
  }
  elements.sort { IOHIDElementGetUsage($0)<IOHIDElementGetUsage($1) }
 }
 tick += 1
 var axes:[Double]=[]
 for element in elements {
  let pointer=UnsafeMutablePointer<Unmanaged<IOHIDValue>>.allocate(capacity:1)
  defer { pointer.deallocate() }
  let device=IOHIDElementGetDevice(element)
  if IOHIDDeviceGetValue(device,element,pointer)==kIOReturnSuccess {
   let value=pointer.pointee.takeUnretainedValue()
   let lo=IOHIDElementGetLogicalMin(element), hi=IOHIDElementGetLogicalMax(element)
   axes.append(hi>lo ? max(-1,min(1,Double(IOHIDValueGetIntegerValue(value)-lo)/Double(hi-lo)*2-1)):0)
  }
 }
 emit(["connected":!axes.isEmpty,"id":"Flysky Noble NB4 · local USB","axes":axes,"status":status])
}
RunLoop.current.add(timer,forMode:.common)
RunLoop.current.run()
