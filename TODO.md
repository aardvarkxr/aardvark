# Overlay Creation / Usage

- [reference](https://github.com/ValveSoftware/openvr/blob/master/samples/helloworldoverlay/openvroverlaycontroller.cpp)
- https://github.com/ValveSoftware/openvr/wiki/IVROverlay_Overview
- vr::VROverlay() <-- global IVROverlay

- create overlay
- set width
- set transform type (absolute world for now)
- set position
- set texture (follow eye buffer submits but use IVRComp) (once at creation)
- set visible

- update texture each loop with equirect texture

in manager
- create/ destroy overlay
- store / provide overlay handle
- set overlay texture
- set overlay visible

in renderer
- set position / width
- update trexture each loop
- provide texture to manager
- request overlay from manager