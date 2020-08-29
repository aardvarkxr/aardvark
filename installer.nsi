
Unicode True

# define installer name
OutFile "aardvarkinstaller_0.13.3.exe"
 
LoadLanguageFile "${NSISDIR}\Contrib\Language files\English.nlf"

# set desktop as install directory
InstallDir $PROGRAMFILES64\Aardvark
 
VIProductVersion "0.13.3.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "Aardvark Installer"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "Aardvark Team"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "Aardvark Installer"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "0.13.3"


# default section start
Section
 
# define output path
SetOutPath $INSTDIR
 
# specify file to go in output path
CreateDirectory "$INSTDIR\data\avcmd"
CreateDirectory "$INSTDIR\data\environments"
CreateDirectory "$INSTDIR\data\gadgets\aardvark_master"
CreateDirectory "$INSTDIR\data\gadgets\aardvark_monitor"
CreateDirectory "$INSTDIR\data\gadgets\aardvark_renderer"
CreateDirectory "$INSTDIR\data\gadgets\control_test"
CreateDirectory "$INSTDIR\data\gadgets\default_hands"
CreateDirectory "$INSTDIR\data\gadgets\desktop_window"
CreateDirectory "$INSTDIR\data\gadgets\gadget_installer"
CreateDirectory "$INSTDIR\data\gadgets\gadget_menu"
CreateDirectory "$INSTDIR\data\gadgets\hand_mirror"
CreateDirectory "$INSTDIR\data\gadgets\messagebox"
CreateDirectory "$INSTDIR\data\gadgets\simple_social"
CreateDirectory "$INSTDIR\data\gadgets\test_panel"
CreateDirectory "$INSTDIR\data\gadgets\whiteboard"
CreateDirectory "$INSTDIR\data\gadgets"
CreateDirectory "$INSTDIR\data\input"
CreateDirectory "$INSTDIR\data\models\Box\glTF-Embedded"
CreateDirectory "$INSTDIR\data\models\Box\screenshot"
CreateDirectory "$INSTDIR\data\models\Box"
CreateDirectory "$INSTDIR\data\models\DamagedHelmet\glTF-Embedded"
CreateDirectory "$INSTDIR\data\models\DamagedHelmet\screenshot"
CreateDirectory "$INSTDIR\data\models\DamagedHelmet"
CreateDirectory "$INSTDIR\data\models\Panel"
CreateDirectory "$INSTDIR\data\models\sphere"
CreateDirectory "$INSTDIR\data\models"
CreateDirectory "$INSTDIR\data\server\bin"
CreateDirectory "$INSTDIR\data\server"
CreateDirectory "$INSTDIR\data\shaders"
CreateDirectory "$INSTDIR\data\textures"
CreateDirectory "$INSTDIR\data"
CreateDirectory "$INSTDIR\locales"
CreateDirectory "$INSTDIR\swiftshader"
CreateDirectory "$INSTDIR\"
File /oname=avrenderer.exe E:\homedev\relbuild\aardvark_0.13.3\avrenderer.exe
File /oname=avrenderer.pdb E:\homedev\relbuild\aardvark_0.13.3\avrenderer.pdb
File /oname=cef.pak E:\homedev\relbuild\aardvark_0.13.3\cef.pak
File /oname=cef_100_percent.pak E:\homedev\relbuild\aardvark_0.13.3\cef_100_percent.pak
File /oname=cef_200_percent.pak E:\homedev\relbuild\aardvark_0.13.3\cef_200_percent.pak
File /oname=cef_extensions.pak E:\homedev\relbuild\aardvark_0.13.3\cef_extensions.pak
File /oname=chrome_elf.dll E:\homedev\relbuild\aardvark_0.13.3\chrome_elf.dll
File /oname=crashpad_handler.exe E:\homedev\relbuild\aardvark_0.13.3\crashpad_handler.exe
File /oname=d3dcompiler_47.dll E:\homedev\relbuild\aardvark_0.13.3\d3dcompiler_47.dll
File /oname=data\aardvark.vrmanifest E:\homedev\relbuild\aardvark_0.13.3\data\aardvark.vrmanifest
File /oname=data\aardvark_capsule_main.png E:\homedev\relbuild\aardvark_0.13.3\data\aardvark_capsule_main.png
File /oname=data\aardvark_portrait_main.png E:\homedev\relbuild\aardvark_0.13.3\data\aardvark_portrait_main.png
File /oname=data\avcmd\avcmd.js E:\homedev\relbuild\aardvark_0.13.3\data\avcmd\avcmd.js
File /oname=data\environments\papermill.ktx E:\homedev\relbuild\aardvark_0.13.3\data\environments\papermill.ktx
File /oname=data\environments\README.md E:\homedev\relbuild\aardvark_0.13.3\data\environments\README.md
File /oname=data\environments\softboxes_hdr16f_cube.ktx E:\homedev\relbuild\aardvark_0.13.3\data\environments\softboxes_hdr16f_cube.ktx
File /oname=data\gadgets\aardvark_master\aardvark_master.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_master\aardvark_master.css
File /oname=data\gadgets\aardvark_master\aardvark_master_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_master\aardvark_master_bundle.js
File /oname=data\gadgets\aardvark_master\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_master\gadget_manifest.json
File /oname=data\gadgets\aardvark_master\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_master\index.html
File /oname=data\gadgets\aardvark_master\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_master\manifest.webmanifest
File /oname=data\gadgets\aardvark_monitor\aardvark_monitor.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_monitor\aardvark_monitor.css
File /oname=data\gadgets\aardvark_monitor\aardvark_monitor_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_monitor\aardvark_monitor_bundle.js
File /oname=data\gadgets\aardvark_monitor\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_monitor\gadget_manifest.json
File /oname=data\gadgets\aardvark_monitor\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_monitor\index.html
File /oname=data\gadgets\aardvark_monitor\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_monitor\manifest.webmanifest
File /oname=data\gadgets\aardvark_renderer\aardvark_renderer_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_renderer\aardvark_renderer_bundle.js
File /oname=data\gadgets\aardvark_renderer\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_renderer\gadget_manifest.json
File /oname=data\gadgets\aardvark_renderer\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_renderer\index.html
File /oname=data\gadgets\aardvark_renderer\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\aardvark_renderer\manifest.webmanifest
File /oname=data\gadgets\control_test\control_test.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\control_test\control_test.css
File /oname=data\gadgets\control_test\control_test_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\control_test\control_test_bundle.js
File /oname=data\gadgets\control_test\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\control_test\gadget_manifest.json
File /oname=data\gadgets\control_test\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\control_test\index.html
File /oname=data\gadgets\control_test\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\control_test\manifest.webmanifest
File /oname=data\gadgets\default_hands\default_hands.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\default_hands\default_hands.css
File /oname=data\gadgets\default_hands\default_hands_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\default_hands\default_hands_bundle.js
File /oname=data\gadgets\default_hands\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\default_hands\gadget_manifest.json
File /oname=data\gadgets\default_hands\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\default_hands\index.html
File /oname=data\gadgets\default_hands\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\default_hands\manifest.webmanifest
File /oname=data\gadgets\desktop_window\desktop_window.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\desktop_window\desktop_window.css
File /oname=data\gadgets\desktop_window\desktop_window_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\desktop_window\desktop_window_bundle.js
File /oname=data\gadgets\desktop_window\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\desktop_window\index.html
File /oname=data\gadgets\desktop_window\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\desktop_window\manifest.webmanifest
File /oname=data\gadgets\gadget_installer\gadget_installer.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_installer\gadget_installer.css
File /oname=data\gadgets\gadget_installer\gadget_installer_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_installer\gadget_installer_bundle.js
File /oname=data\gadgets\gadget_installer\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_installer\gadget_manifest.json
File /oname=data\gadgets\gadget_installer\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_installer\index.html
File /oname=data\gadgets\gadget_installer\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_installer\manifest.webmanifest
File /oname=data\gadgets\gadget_menu\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_menu\gadget_manifest.json
File /oname=data\gadgets\gadget_menu\gadget_menu.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_menu\gadget_menu.css
File /oname=data\gadgets\gadget_menu\gadget_menu_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_menu\gadget_menu_bundle.js
File /oname=data\gadgets\gadget_menu\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_menu\index.html
File /oname=data\gadgets\gadget_menu\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\gadget_menu\manifest.webmanifest
File /oname=data\gadgets\hand_mirror\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\hand_mirror\gadget_manifest.json
File /oname=data\gadgets\hand_mirror\hand_mirror.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\hand_mirror\hand_mirror.css
File /oname=data\gadgets\hand_mirror\hand_mirror_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\hand_mirror\hand_mirror_bundle.js
File /oname=data\gadgets\hand_mirror\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\hand_mirror\index.html
File /oname=data\gadgets\hand_mirror\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\hand_mirror\manifest.webmanifest
File /oname=data\gadgets\messagebox\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\messagebox\index.html
File /oname=data\gadgets\messagebox\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\messagebox\manifest.webmanifest
File /oname=data\gadgets\messagebox\messagebox.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\messagebox\messagebox.css
File /oname=data\gadgets\messagebox\messagebox_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\messagebox\messagebox_bundle.js
File /oname=data\gadgets\simple_social\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\simple_social\gadget_manifest.json
File /oname=data\gadgets\simple_social\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\simple_social\index.html
File /oname=data\gadgets\simple_social\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\simple_social\manifest.webmanifest
File /oname=data\gadgets\simple_social\simple_social.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\simple_social\simple_social.css
File /oname=data\gadgets\simple_social\simple_social_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\simple_social\simple_social_bundle.js
File /oname=data\gadgets\test_panel\gadget_manifest.json E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\test_panel\gadget_manifest.json
File /oname=data\gadgets\test_panel\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\test_panel\index.html
File /oname=data\gadgets\test_panel\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\test_panel\manifest.webmanifest
File /oname=data\gadgets\test_panel\test_panel.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\test_panel\test_panel.css
File /oname=data\gadgets\test_panel\test_panel_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\test_panel\test_panel_bundle.js
File /oname=data\gadgets\whiteboard\index.html E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\whiteboard\index.html
File /oname=data\gadgets\whiteboard\manifest.webmanifest E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\whiteboard\manifest.webmanifest
File /oname=data\gadgets\whiteboard\whiteboard.css E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\whiteboard\whiteboard.css
File /oname=data\gadgets\whiteboard\whiteboard.glb E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\whiteboard\whiteboard.glb
File /oname=data\gadgets\whiteboard\whiteboard_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\gadgets\whiteboard\whiteboard_bundle.js
File /oname=data\input\aardvarkxr_aardvark_binding_vive_controller.json E:\homedev\relbuild\aardvark_0.13.3\data\input\aardvarkxr_aardvark_binding_vive_controller.json
File /oname=data\input\aardvarkxr_binding_holographic_controller.json E:\homedev\relbuild\aardvark_0.13.3\data\input\aardvarkxr_binding_holographic_controller.json
File /oname=data\input\aardvark_actions.json E:\homedev\relbuild\aardvark_0.13.3\data\input\aardvark_actions.json
File /oname=data\input\aardvark_binding_knuckles.json E:\homedev\relbuild\aardvark_0.13.3\data\input\aardvark_binding_knuckles.json
File /oname=data\input\aardvark_binding_oculus_touch.json E:\homedev\relbuild\aardvark_0.13.3\data\input\aardvark_binding_oculus_touch.json
File /oname=data\models\aardvark.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\aardvark.glb
File /oname=data\models\arrow.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\arrow.blend
File /oname=data\models\arrow.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\arrow.glb
File /oname=data\models\arrow_flat.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\arrow_flat.glb
File /oname=data\models\barcode_reader.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\barcode_reader.glb
File /oname=data\models\bounding_box.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\bounding_box.blend
File /oname=data\models\bounding_box.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\bounding_box.glb
File /oname=data\models\bounding_box.png E:\homedev\relbuild\aardvark_0.13.3\data\models\bounding_box.png
File /oname=data\models\Box\glTF-Embedded\Box.gltf E:\homedev\relbuild\aardvark_0.13.3\data\models\Box\glTF-Embedded\Box.gltf
File /oname=data\models\Box\README.md E:\homedev\relbuild\aardvark_0.13.3\data\models\Box\README.md
File /oname=data\models\Box\screenshot\screenshot.png E:\homedev\relbuild\aardvark_0.13.3\data\models\Box\screenshot\screenshot.png
File /oname=data\models\box.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\box.blend
File /oname=data\models\box.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\box.glb
File /oname=data\models\bracelet.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\bracelet.blend
File /oname=data\models\bracelet.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\bracelet.glb
File /oname=data\models\cylinder.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\cylinder.blend
File /oname=data\models\cylinder.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\cylinder.glb
File /oname=data\models\DamagedHelmet\glTF-Embedded\DamagedHelmet.gltf E:\homedev\relbuild\aardvark_0.13.3\data\models\DamagedHelmet\glTF-Embedded\DamagedHelmet.gltf
File /oname=data\models\DamagedHelmet\README.md E:\homedev\relbuild\aardvark_0.13.3\data\models\DamagedHelmet\README.md
File /oname=data\models\DamagedHelmet\screenshot\screenshot.png E:\homedev\relbuild\aardvark_0.13.3\data\models\DamagedHelmet\screenshot\screenshot.png
File /oname=data\models\drop_attract.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\drop_attract.blend
File /oname=data\models\drop_attract.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\drop_attract.glb
File /oname=data\models\error.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\error.glb
File /oname=data\models\gear.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\gear.blend
File /oname=data\models\gear.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\gear.glb
File /oname=data\models\hammerwrench.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\hammerwrench.glb
File /oname=data\models\hand_left.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\hand_left.glb
File /oname=data\models\hand_mirror.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\hand_mirror.glb
File /oname=data\models\hand_right.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\hand_right.glb
File /oname=data\models\head.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\head.glb
File /oname=data\models\hook.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\hook.blend
File /oname=data\models\hook.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\hook.glb
File /oname=data\models\magnet_closed.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\magnet_closed.glb
File /oname=data\models\magnet_open.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\magnet_open.glb
File /oname=data\models\minus.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\minus.blend
File /oname=data\models\minus.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\minus.glb
File /oname=data\models\network.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\network.glb
File /oname=data\models\Panel\panel.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\Panel\panel.blend
File /oname=data\models\Panel\panel.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\Panel\panel.glb
File /oname=data\models\Panel\panel_inverted.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\Panel\panel_inverted.blend
File /oname=data\models\Panel\panel_inverted.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\Panel\panel_inverted.glb
File /oname=data\models\Panel\panel_placeholder.png E:\homedev\relbuild\aardvark_0.13.3\data\models\Panel\panel_placeholder.png
File /oname=data\models\plus.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\plus.blend
File /oname=data\models\plus.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\plus.glb
File /oname=data\models\room.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\room.glb
File /oname=data\models\sphere\sphere.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\sphere\sphere.blend
File /oname=data\models\sphere\sphere.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\sphere\sphere.glb
File /oname=data\models\sphere\sphere_unlit.blend E:\homedev\relbuild\aardvark_0.13.3\data\models\sphere\sphere_unlit.blend
File /oname=data\models\sphere\sphere_unlit.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\sphere\sphere_unlit.glb
File /oname=data\models\star.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\star.glb
File /oname=data\models\trashcan.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\trashcan.glb
File /oname=data\models\window_icon.glb E:\homedev\relbuild\aardvark_0.13.3\data\models\window_icon.glb
File /oname=data\Robot-Medium-license.txt E:\homedev\relbuild\aardvark_0.13.3\data\Robot-Medium-license.txt
File /oname=data\Roboto-Medium.ttf E:\homedev\relbuild\aardvark_0.13.3\data\Roboto-Medium.ttf
File /oname=data\server\bin\node.exe E:\homedev\relbuild\aardvark_0.13.3\data\server\bin\node.exe
File /oname=data\server\server_bundle.js E:\homedev\relbuild\aardvark_0.13.3\data\server\server_bundle.js
File /oname=data\shaders\Compiling_Shaders.md E:\homedev\relbuild\aardvark_0.13.3\data\shaders\Compiling_Shaders.md
File /oname=data\shaders\filtercube.vert E:\homedev\relbuild\aardvark_0.13.3\data\shaders\filtercube.vert
File /oname=data\shaders\filtercube.vert.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\filtercube.vert.spv
File /oname=data\shaders\genbrdflut.frag E:\homedev\relbuild\aardvark_0.13.3\data\shaders\genbrdflut.frag
File /oname=data\shaders\genbrdflut.frag.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\genbrdflut.frag.spv
File /oname=data\shaders\genbrdflut.vert E:\homedev\relbuild\aardvark_0.13.3\data\shaders\genbrdflut.vert
File /oname=data\shaders\genbrdflut.vert.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\genbrdflut.vert.spv
File /oname=data\shaders\irradiancecube.frag E:\homedev\relbuild\aardvark_0.13.3\data\shaders\irradiancecube.frag
File /oname=data\shaders\irradiancecube.frag.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\irradiancecube.frag.spv
File /oname=data\shaders\pbr.vert E:\homedev\relbuild\aardvark_0.13.3\data\shaders\pbr.vert
File /oname=data\shaders\pbr.vert.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\pbr.vert.spv
File /oname=data\shaders\pbr_khr.frag E:\homedev\relbuild\aardvark_0.13.3\data\shaders\pbr_khr.frag
File /oname=data\shaders\pbr_khr.frag.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\pbr_khr.frag.spv
File /oname=data\shaders\prefilterenvmap.frag E:\homedev\relbuild\aardvark_0.13.3\data\shaders\prefilterenvmap.frag
File /oname=data\shaders\prefilterenvmap.frag.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\prefilterenvmap.frag.spv
File /oname=data\shaders\skybox.frag E:\homedev\relbuild\aardvark_0.13.3\data\shaders\skybox.frag
File /oname=data\shaders\skybox.frag.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\skybox.frag.spv
File /oname=data\shaders\skybox.vert E:\homedev\relbuild\aardvark_0.13.3\data\shaders\skybox.vert
File /oname=data\shaders\skybox.vert.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\skybox.vert.spv
File /oname=data\shaders\ui.frag E:\homedev\relbuild\aardvark_0.13.3\data\shaders\ui.frag
File /oname=data\shaders\ui.frag.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\ui.frag.spv
File /oname=data\shaders\ui.vert E:\homedev\relbuild\aardvark_0.13.3\data\shaders\ui.vert
File /oname=data\shaders\ui.vert.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\ui.vert.spv
File /oname=data\shaders\varggles.frag E:\homedev\relbuild\aardvark_0.13.3\data\shaders\varggles.frag
File /oname=data\shaders\varggles.frag.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\varggles.frag.spv
File /oname=data\shaders\varggles.vert E:\homedev\relbuild\aardvark_0.13.3\data\shaders\varggles.vert
File /oname=data\shaders\varggles.vert.spv E:\homedev\relbuild\aardvark_0.13.3\data\shaders\varggles.vert.spv
File /oname=data\textures\empty.ktx E:\homedev\relbuild\aardvark_0.13.3\data\textures\empty.ktx
File /oname=data\textures\hand.svg E:\homedev\relbuild\aardvark_0.13.3\data\textures\hand.svg
File /oname=data\textures\head.svg E:\homedev\relbuild\aardvark_0.13.3\data\textures\head.svg
File /oname=data\third_party_licenses.txt E:\homedev\relbuild\aardvark_0.13.3\data\third_party_licenses.txt
File /oname=data\web_third_party_licenses.txt E:\homedev\relbuild\aardvark_0.13.3\data\web_third_party_licenses.txt
File /oname=devtools_resources.pak E:\homedev\relbuild\aardvark_0.13.3\devtools_resources.pak
File /oname=icudtl.dat E:\homedev\relbuild\aardvark_0.13.3\icudtl.dat
File /oname=libcef.dll E:\homedev\relbuild\aardvark_0.13.3\libcef.dll
File /oname=libEGL.dll E:\homedev\relbuild\aardvark_0.13.3\libEGL.dll
File /oname=libGLESv2.dll E:\homedev\relbuild\aardvark_0.13.3\libGLESv2.dll
File /oname=locales\am.pak E:\homedev\relbuild\aardvark_0.13.3\locales\am.pak
File /oname=locales\ar.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ar.pak
File /oname=locales\bg.pak E:\homedev\relbuild\aardvark_0.13.3\locales\bg.pak
File /oname=locales\bn.pak E:\homedev\relbuild\aardvark_0.13.3\locales\bn.pak
File /oname=locales\ca.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ca.pak
File /oname=locales\cs.pak E:\homedev\relbuild\aardvark_0.13.3\locales\cs.pak
File /oname=locales\da.pak E:\homedev\relbuild\aardvark_0.13.3\locales\da.pak
File /oname=locales\de.pak E:\homedev\relbuild\aardvark_0.13.3\locales\de.pak
File /oname=locales\el.pak E:\homedev\relbuild\aardvark_0.13.3\locales\el.pak
File /oname=locales\en-GB.pak E:\homedev\relbuild\aardvark_0.13.3\locales\en-GB.pak
File /oname=locales\en-US.pak E:\homedev\relbuild\aardvark_0.13.3\locales\en-US.pak
File /oname=locales\es-419.pak E:\homedev\relbuild\aardvark_0.13.3\locales\es-419.pak
File /oname=locales\es.pak E:\homedev\relbuild\aardvark_0.13.3\locales\es.pak
File /oname=locales\et.pak E:\homedev\relbuild\aardvark_0.13.3\locales\et.pak
File /oname=locales\fa.pak E:\homedev\relbuild\aardvark_0.13.3\locales\fa.pak
File /oname=locales\fi.pak E:\homedev\relbuild\aardvark_0.13.3\locales\fi.pak
File /oname=locales\fil.pak E:\homedev\relbuild\aardvark_0.13.3\locales\fil.pak
File /oname=locales\fr.pak E:\homedev\relbuild\aardvark_0.13.3\locales\fr.pak
File /oname=locales\gu.pak E:\homedev\relbuild\aardvark_0.13.3\locales\gu.pak
File /oname=locales\he.pak E:\homedev\relbuild\aardvark_0.13.3\locales\he.pak
File /oname=locales\hi.pak E:\homedev\relbuild\aardvark_0.13.3\locales\hi.pak
File /oname=locales\hr.pak E:\homedev\relbuild\aardvark_0.13.3\locales\hr.pak
File /oname=locales\hu.pak E:\homedev\relbuild\aardvark_0.13.3\locales\hu.pak
File /oname=locales\id.pak E:\homedev\relbuild\aardvark_0.13.3\locales\id.pak
File /oname=locales\it.pak E:\homedev\relbuild\aardvark_0.13.3\locales\it.pak
File /oname=locales\ja.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ja.pak
File /oname=locales\kn.pak E:\homedev\relbuild\aardvark_0.13.3\locales\kn.pak
File /oname=locales\ko.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ko.pak
File /oname=locales\lt.pak E:\homedev\relbuild\aardvark_0.13.3\locales\lt.pak
File /oname=locales\lv.pak E:\homedev\relbuild\aardvark_0.13.3\locales\lv.pak
File /oname=locales\ml.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ml.pak
File /oname=locales\mr.pak E:\homedev\relbuild\aardvark_0.13.3\locales\mr.pak
File /oname=locales\ms.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ms.pak
File /oname=locales\nb.pak E:\homedev\relbuild\aardvark_0.13.3\locales\nb.pak
File /oname=locales\nl.pak E:\homedev\relbuild\aardvark_0.13.3\locales\nl.pak
File /oname=locales\pl.pak E:\homedev\relbuild\aardvark_0.13.3\locales\pl.pak
File /oname=locales\pt-BR.pak E:\homedev\relbuild\aardvark_0.13.3\locales\pt-BR.pak
File /oname=locales\pt-PT.pak E:\homedev\relbuild\aardvark_0.13.3\locales\pt-PT.pak
File /oname=locales\ro.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ro.pak
File /oname=locales\ru.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ru.pak
File /oname=locales\sk.pak E:\homedev\relbuild\aardvark_0.13.3\locales\sk.pak
File /oname=locales\sl.pak E:\homedev\relbuild\aardvark_0.13.3\locales\sl.pak
File /oname=locales\sr.pak E:\homedev\relbuild\aardvark_0.13.3\locales\sr.pak
File /oname=locales\sv.pak E:\homedev\relbuild\aardvark_0.13.3\locales\sv.pak
File /oname=locales\sw.pak E:\homedev\relbuild\aardvark_0.13.3\locales\sw.pak
File /oname=locales\ta.pak E:\homedev\relbuild\aardvark_0.13.3\locales\ta.pak
File /oname=locales\te.pak E:\homedev\relbuild\aardvark_0.13.3\locales\te.pak
File /oname=locales\th.pak E:\homedev\relbuild\aardvark_0.13.3\locales\th.pak
File /oname=locales\tr.pak E:\homedev\relbuild\aardvark_0.13.3\locales\tr.pak
File /oname=locales\uk.pak E:\homedev\relbuild\aardvark_0.13.3\locales\uk.pak
File /oname=locales\vi.pak E:\homedev\relbuild\aardvark_0.13.3\locales\vi.pak
File /oname=locales\zh-CN.pak E:\homedev\relbuild\aardvark_0.13.3\locales\zh-CN.pak
File /oname=locales\zh-TW.pak E:\homedev\relbuild\aardvark_0.13.3\locales\zh-TW.pak
File /oname=natives_blob.bin E:\homedev\relbuild\aardvark_0.13.3\natives_blob.bin
File /oname=openvr_api.dll E:\homedev\relbuild\aardvark_0.13.3\openvr_api.dll
File /oname=registerapp.bat E:\homedev\relbuild\aardvark_0.13.3\registerapp.bat
File /oname=snapshot_blob.bin E:\homedev\relbuild\aardvark_0.13.3\snapshot_blob.bin
File /oname=swiftshader\libEGL.dll E:\homedev\relbuild\aardvark_0.13.3\swiftshader\libEGL.dll
File /oname=swiftshader\libGLESv2.dll E:\homedev\relbuild\aardvark_0.13.3\swiftshader\libGLESv2.dll
File /oname=unregisterapp.bat E:\homedev\relbuild\aardvark_0.13.3\unregisterapp.bat
File /oname=v8_context_snapshot.bin E:\homedev\relbuild\aardvark_0.13.3\v8_context_snapshot.bin

# let node talk through windows firewall
ExecWait 'netsh advfirewall firewall add rule name=AardvarkServer dir=in action=allow program="$INSTDIR\data\server\bin\node.exe" enable=yes profile=public,private'

# Register the install with Aardvark
ExecWait '$INSTDIR\avrenderer.exe register'
  
# define uninstaller name
WriteUninstaller $INSTDIR\uninstaller.exe
 
 
#-------
# default section end
SectionEnd
 
# create a section to define what the uninstaller does.
# the section will always be named "Uninstall"
Section "Uninstall"

# Unregister the install with Aardvark
ExecWait '$INSTDIR\avrenderer.exe unregister'
 
# Remove firewall rule
ExecWait 'netsh advfirewall firewall delete rule name=AardvarkServer'

 
# Always delete uninstaller first
Delete $INSTDIR\uninstaller.exe

# now delete installed files and directories
Delete $INSTDIR\avrenderer.exe
Delete $INSTDIR\avrenderer.pdb
Delete $INSTDIR\cef.pak
Delete $INSTDIR\cef_100_percent.pak
Delete $INSTDIR\cef_200_percent.pak
Delete $INSTDIR\cef_extensions.pak
Delete $INSTDIR\chrome_elf.dll
Delete $INSTDIR\crashpad_handler.exe
Delete $INSTDIR\d3dcompiler_47.dll
Delete $INSTDIR\data\aardvark.vrmanifest
Delete $INSTDIR\data\aardvark_capsule_main.png
Delete $INSTDIR\data\aardvark_portrait_main.png
Delete $INSTDIR\data\avcmd\avcmd.js
Delete $INSTDIR\data\environments\papermill.ktx
Delete $INSTDIR\data\environments\README.md
Delete $INSTDIR\data\environments\softboxes_hdr16f_cube.ktx
Delete $INSTDIR\data\gadgets\aardvark_master\aardvark_master.css
Delete $INSTDIR\data\gadgets\aardvark_master\aardvark_master_bundle.js
Delete $INSTDIR\data\gadgets\aardvark_master\gadget_manifest.json
Delete $INSTDIR\data\gadgets\aardvark_master\index.html
Delete $INSTDIR\data\gadgets\aardvark_master\manifest.webmanifest
Delete $INSTDIR\data\gadgets\aardvark_monitor\aardvark_monitor.css
Delete $INSTDIR\data\gadgets\aardvark_monitor\aardvark_monitor_bundle.js
Delete $INSTDIR\data\gadgets\aardvark_monitor\gadget_manifest.json
Delete $INSTDIR\data\gadgets\aardvark_monitor\index.html
Delete $INSTDIR\data\gadgets\aardvark_monitor\manifest.webmanifest
Delete $INSTDIR\data\gadgets\aardvark_renderer\aardvark_renderer_bundle.js
Delete $INSTDIR\data\gadgets\aardvark_renderer\gadget_manifest.json
Delete $INSTDIR\data\gadgets\aardvark_renderer\index.html
Delete $INSTDIR\data\gadgets\aardvark_renderer\manifest.webmanifest
Delete $INSTDIR\data\gadgets\control_test\control_test.css
Delete $INSTDIR\data\gadgets\control_test\control_test_bundle.js
Delete $INSTDIR\data\gadgets\control_test\gadget_manifest.json
Delete $INSTDIR\data\gadgets\control_test\index.html
Delete $INSTDIR\data\gadgets\control_test\manifest.webmanifest
Delete $INSTDIR\data\gadgets\default_hands\default_hands.css
Delete $INSTDIR\data\gadgets\default_hands\default_hands_bundle.js
Delete $INSTDIR\data\gadgets\default_hands\gadget_manifest.json
Delete $INSTDIR\data\gadgets\default_hands\index.html
Delete $INSTDIR\data\gadgets\default_hands\manifest.webmanifest
Delete $INSTDIR\data\gadgets\desktop_window\desktop_window.css
Delete $INSTDIR\data\gadgets\desktop_window\desktop_window_bundle.js
Delete $INSTDIR\data\gadgets\desktop_window\index.html
Delete $INSTDIR\data\gadgets\desktop_window\manifest.webmanifest
Delete $INSTDIR\data\gadgets\gadget_installer\gadget_installer.css
Delete $INSTDIR\data\gadgets\gadget_installer\gadget_installer_bundle.js
Delete $INSTDIR\data\gadgets\gadget_installer\gadget_manifest.json
Delete $INSTDIR\data\gadgets\gadget_installer\index.html
Delete $INSTDIR\data\gadgets\gadget_installer\manifest.webmanifest
Delete $INSTDIR\data\gadgets\gadget_menu\gadget_manifest.json
Delete $INSTDIR\data\gadgets\gadget_menu\gadget_menu.css
Delete $INSTDIR\data\gadgets\gadget_menu\gadget_menu_bundle.js
Delete $INSTDIR\data\gadgets\gadget_menu\index.html
Delete $INSTDIR\data\gadgets\gadget_menu\manifest.webmanifest
Delete $INSTDIR\data\gadgets\hand_mirror\gadget_manifest.json
Delete $INSTDIR\data\gadgets\hand_mirror\hand_mirror.css
Delete $INSTDIR\data\gadgets\hand_mirror\hand_mirror_bundle.js
Delete $INSTDIR\data\gadgets\hand_mirror\index.html
Delete $INSTDIR\data\gadgets\hand_mirror\manifest.webmanifest
Delete $INSTDIR\data\gadgets\messagebox\index.html
Delete $INSTDIR\data\gadgets\messagebox\manifest.webmanifest
Delete $INSTDIR\data\gadgets\messagebox\messagebox.css
Delete $INSTDIR\data\gadgets\messagebox\messagebox_bundle.js
Delete $INSTDIR\data\gadgets\simple_social\gadget_manifest.json
Delete $INSTDIR\data\gadgets\simple_social\index.html
Delete $INSTDIR\data\gadgets\simple_social\manifest.webmanifest
Delete $INSTDIR\data\gadgets\simple_social\simple_social.css
Delete $INSTDIR\data\gadgets\simple_social\simple_social_bundle.js
Delete $INSTDIR\data\gadgets\test_panel\gadget_manifest.json
Delete $INSTDIR\data\gadgets\test_panel\index.html
Delete $INSTDIR\data\gadgets\test_panel\manifest.webmanifest
Delete $INSTDIR\data\gadgets\test_panel\test_panel.css
Delete $INSTDIR\data\gadgets\test_panel\test_panel_bundle.js
Delete $INSTDIR\data\gadgets\whiteboard\index.html
Delete $INSTDIR\data\gadgets\whiteboard\manifest.webmanifest
Delete $INSTDIR\data\gadgets\whiteboard\whiteboard.css
Delete $INSTDIR\data\gadgets\whiteboard\whiteboard.glb
Delete $INSTDIR\data\gadgets\whiteboard\whiteboard_bundle.js
Delete $INSTDIR\data\input\aardvarkxr_aardvark_binding_vive_controller.json
Delete $INSTDIR\data\input\aardvarkxr_binding_holographic_controller.json
Delete $INSTDIR\data\input\aardvark_actions.json
Delete $INSTDIR\data\input\aardvark_binding_knuckles.json
Delete $INSTDIR\data\input\aardvark_binding_oculus_touch.json
Delete $INSTDIR\data\models\aardvark.glb
Delete $INSTDIR\data\models\arrow.blend
Delete $INSTDIR\data\models\arrow.glb
Delete $INSTDIR\data\models\arrow_flat.glb
Delete $INSTDIR\data\models\barcode_reader.glb
Delete $INSTDIR\data\models\bounding_box.blend
Delete $INSTDIR\data\models\bounding_box.glb
Delete $INSTDIR\data\models\bounding_box.png
Delete $INSTDIR\data\models\Box\glTF-Embedded\Box.gltf
Delete $INSTDIR\data\models\Box\README.md
Delete $INSTDIR\data\models\Box\screenshot\screenshot.png
Delete $INSTDIR\data\models\box.blend
Delete $INSTDIR\data\models\box.glb
Delete $INSTDIR\data\models\bracelet.blend
Delete $INSTDIR\data\models\bracelet.glb
Delete $INSTDIR\data\models\cylinder.blend
Delete $INSTDIR\data\models\cylinder.glb
Delete $INSTDIR\data\models\DamagedHelmet\glTF-Embedded\DamagedHelmet.gltf
Delete $INSTDIR\data\models\DamagedHelmet\README.md
Delete $INSTDIR\data\models\DamagedHelmet\screenshot\screenshot.png
Delete $INSTDIR\data\models\drop_attract.blend
Delete $INSTDIR\data\models\drop_attract.glb
Delete $INSTDIR\data\models\error.glb
Delete $INSTDIR\data\models\gear.blend
Delete $INSTDIR\data\models\gear.glb
Delete $INSTDIR\data\models\hammerwrench.glb
Delete $INSTDIR\data\models\hand_left.glb
Delete $INSTDIR\data\models\hand_mirror.glb
Delete $INSTDIR\data\models\hand_right.glb
Delete $INSTDIR\data\models\head.glb
Delete $INSTDIR\data\models\hook.blend
Delete $INSTDIR\data\models\hook.glb
Delete $INSTDIR\data\models\magnet_closed.glb
Delete $INSTDIR\data\models\magnet_open.glb
Delete $INSTDIR\data\models\minus.blend
Delete $INSTDIR\data\models\minus.glb
Delete $INSTDIR\data\models\network.glb
Delete $INSTDIR\data\models\Panel\panel.blend
Delete $INSTDIR\data\models\Panel\panel.glb
Delete $INSTDIR\data\models\Panel\panel_inverted.blend
Delete $INSTDIR\data\models\Panel\panel_inverted.glb
Delete $INSTDIR\data\models\Panel\panel_placeholder.png
Delete $INSTDIR\data\models\plus.blend
Delete $INSTDIR\data\models\plus.glb
Delete $INSTDIR\data\models\room.glb
Delete $INSTDIR\data\models\sphere\sphere.blend
Delete $INSTDIR\data\models\sphere\sphere.glb
Delete $INSTDIR\data\models\sphere\sphere_unlit.blend
Delete $INSTDIR\data\models\sphere\sphere_unlit.glb
Delete $INSTDIR\data\models\star.glb
Delete $INSTDIR\data\models\trashcan.glb
Delete $INSTDIR\data\models\window_icon.glb
Delete $INSTDIR\data\Robot-Medium-license.txt
Delete $INSTDIR\data\Roboto-Medium.ttf
Delete $INSTDIR\data\server\bin\node.exe
Delete $INSTDIR\data\server\server_bundle.js
Delete $INSTDIR\data\shaders\Compiling_Shaders.md
Delete $INSTDIR\data\shaders\filtercube.vert
Delete $INSTDIR\data\shaders\filtercube.vert.spv
Delete $INSTDIR\data\shaders\genbrdflut.frag
Delete $INSTDIR\data\shaders\genbrdflut.frag.spv
Delete $INSTDIR\data\shaders\genbrdflut.vert
Delete $INSTDIR\data\shaders\genbrdflut.vert.spv
Delete $INSTDIR\data\shaders\irradiancecube.frag
Delete $INSTDIR\data\shaders\irradiancecube.frag.spv
Delete $INSTDIR\data\shaders\pbr.vert
Delete $INSTDIR\data\shaders\pbr.vert.spv
Delete $INSTDIR\data\shaders\pbr_khr.frag
Delete $INSTDIR\data\shaders\pbr_khr.frag.spv
Delete $INSTDIR\data\shaders\prefilterenvmap.frag
Delete $INSTDIR\data\shaders\prefilterenvmap.frag.spv
Delete $INSTDIR\data\shaders\skybox.frag
Delete $INSTDIR\data\shaders\skybox.frag.spv
Delete $INSTDIR\data\shaders\skybox.vert
Delete $INSTDIR\data\shaders\skybox.vert.spv
Delete $INSTDIR\data\shaders\ui.frag
Delete $INSTDIR\data\shaders\ui.frag.spv
Delete $INSTDIR\data\shaders\ui.vert
Delete $INSTDIR\data\shaders\ui.vert.spv
Delete $INSTDIR\data\shaders\varggles.frag
Delete $INSTDIR\data\shaders\varggles.frag.spv
Delete $INSTDIR\data\shaders\varggles.vert
Delete $INSTDIR\data\shaders\varggles.vert.spv
Delete $INSTDIR\data\textures\empty.ktx
Delete $INSTDIR\data\textures\hand.svg
Delete $INSTDIR\data\textures\head.svg
Delete $INSTDIR\data\third_party_licenses.txt
Delete $INSTDIR\data\web_third_party_licenses.txt
Delete $INSTDIR\devtools_resources.pak
Delete $INSTDIR\icudtl.dat
Delete $INSTDIR\libcef.dll
Delete $INSTDIR\libEGL.dll
Delete $INSTDIR\libGLESv2.dll
Delete $INSTDIR\locales\am.pak
Delete $INSTDIR\locales\ar.pak
Delete $INSTDIR\locales\bg.pak
Delete $INSTDIR\locales\bn.pak
Delete $INSTDIR\locales\ca.pak
Delete $INSTDIR\locales\cs.pak
Delete $INSTDIR\locales\da.pak
Delete $INSTDIR\locales\de.pak
Delete $INSTDIR\locales\el.pak
Delete $INSTDIR\locales\en-GB.pak
Delete $INSTDIR\locales\en-US.pak
Delete $INSTDIR\locales\es-419.pak
Delete $INSTDIR\locales\es.pak
Delete $INSTDIR\locales\et.pak
Delete $INSTDIR\locales\fa.pak
Delete $INSTDIR\locales\fi.pak
Delete $INSTDIR\locales\fil.pak
Delete $INSTDIR\locales\fr.pak
Delete $INSTDIR\locales\gu.pak
Delete $INSTDIR\locales\he.pak
Delete $INSTDIR\locales\hi.pak
Delete $INSTDIR\locales\hr.pak
Delete $INSTDIR\locales\hu.pak
Delete $INSTDIR\locales\id.pak
Delete $INSTDIR\locales\it.pak
Delete $INSTDIR\locales\ja.pak
Delete $INSTDIR\locales\kn.pak
Delete $INSTDIR\locales\ko.pak
Delete $INSTDIR\locales\lt.pak
Delete $INSTDIR\locales\lv.pak
Delete $INSTDIR\locales\ml.pak
Delete $INSTDIR\locales\mr.pak
Delete $INSTDIR\locales\ms.pak
Delete $INSTDIR\locales\nb.pak
Delete $INSTDIR\locales\nl.pak
Delete $INSTDIR\locales\pl.pak
Delete $INSTDIR\locales\pt-BR.pak
Delete $INSTDIR\locales\pt-PT.pak
Delete $INSTDIR\locales\ro.pak
Delete $INSTDIR\locales\ru.pak
Delete $INSTDIR\locales\sk.pak
Delete $INSTDIR\locales\sl.pak
Delete $INSTDIR\locales\sr.pak
Delete $INSTDIR\locales\sv.pak
Delete $INSTDIR\locales\sw.pak
Delete $INSTDIR\locales\ta.pak
Delete $INSTDIR\locales\te.pak
Delete $INSTDIR\locales\th.pak
Delete $INSTDIR\locales\tr.pak
Delete $INSTDIR\locales\uk.pak
Delete $INSTDIR\locales\vi.pak
Delete $INSTDIR\locales\zh-CN.pak
Delete $INSTDIR\locales\zh-TW.pak
Delete $INSTDIR\natives_blob.bin
Delete $INSTDIR\openvr_api.dll
Delete $INSTDIR\registerapp.bat
Delete $INSTDIR\snapshot_blob.bin
Delete $INSTDIR\swiftshader\libEGL.dll
Delete $INSTDIR\swiftshader\libGLESv2.dll
Delete $INSTDIR\unregisterapp.bat
Delete $INSTDIR\v8_context_snapshot.bin
RMDir $INSTDIR\data\avcmd
RMDir $INSTDIR\data\environments
RMDir $INSTDIR\data\gadgets\aardvark_master
RMDir $INSTDIR\data\gadgets\aardvark_monitor
RMDir $INSTDIR\data\gadgets\aardvark_renderer
RMDir $INSTDIR\data\gadgets\control_test
RMDir $INSTDIR\data\gadgets\default_hands
RMDir $INSTDIR\data\gadgets\desktop_window
RMDir $INSTDIR\data\gadgets\gadget_installer
RMDir $INSTDIR\data\gadgets\gadget_menu
RMDir $INSTDIR\data\gadgets\hand_mirror
RMDir $INSTDIR\data\gadgets\messagebox
RMDir $INSTDIR\data\gadgets\simple_social
RMDir $INSTDIR\data\gadgets\test_panel
RMDir $INSTDIR\data\gadgets\whiteboard
RMDir $INSTDIR\data\gadgets
RMDir $INSTDIR\data\input
RMDir $INSTDIR\data\models\Box\glTF-Embedded
RMDir $INSTDIR\data\models\Box\screenshot
RMDir $INSTDIR\data\models\Box
RMDir $INSTDIR\data\models\DamagedHelmet\glTF-Embedded
RMDir $INSTDIR\data\models\DamagedHelmet\screenshot
RMDir $INSTDIR\data\models\DamagedHelmet
RMDir $INSTDIR\data\models\Panel
RMDir $INSTDIR\data\models\sphere
RMDir $INSTDIR\data\models
RMDir $INSTDIR\data\server\bin
RMDir $INSTDIR\data\server
RMDir $INSTDIR\data\shaders
RMDir $INSTDIR\data\textures
RMDir $INSTDIR\data
RMDir $INSTDIR\locales
RMDir $INSTDIR\swiftshader
RMDir $INSTDIR
 
SectionEnd

		