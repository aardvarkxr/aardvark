
add_library(gltfpbr_base STATIC 
	camera.hpp
	descriptormanager.cpp
	descriptormanager.h
	keycodes.hpp
	macros.h
	ui.hpp
	VulkanAndroid.cpp
	VulkanAndroid.h
	VulkanDevice.hpp
	VulkanExampleBase.cpp
	VulkanExampleBase.h
	VulkanglTFModel.hpp
	VulkanSwapChain.hpp
	VulkanTexture.hpp
	VulkanUtils.cpp
	VulkanUtils.hpp

	../thirdparty/imgui/imgui.cpp
	../thirdparty/imgui/imgui_demo.cpp
	../thirdparty/imgui/imgui_draw.cpp
	../thirdparty/imgui/imgui_widgets.cpp
	)



target_compile_definitions(gltfpbr_base PRIVATE -D_CRT_SECURE_NO_WARNINGS)
target_include_directories( gltfpbr_base PUBLIC ${AV_SRC_THIRDPARTY} )
target_include_directories( gltfpbr_base PUBLIC ${AV_SRC_THIRDPARTY}/glm )
target_include_directories( gltfpbr_base PUBLIC ${AV_SRC_THIRDPARTY}/gli )
target_include_directories( gltfpbr_base PUBLIC ${AV_SRC_THIRDPARTY}/tinygltf )
target_include_directories( gltfpbr_base PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_definitions( gltfpbr_base PUBLIC 
	VK_USE_PLATFORM_WIN32_KHR
	)
target_link_libraries( gltfpbr_base ${OpenVR_LIB_DIR}/openvr_api.lib )
target_link_libraries( gltfpbr_base tools )
target_include_directories( gltfpbr_base PRIVATE ${OpenVR_INCLUDE_DIR} )

if(WIN32)
    target_link_libraries(gltfpbr_base ${Vulkan_LIBRARY} ${WINLIBS} ${DRACO_DECODER_LIBRARY})
 else(WIN32)
    target_link_libraries(gltfpbr_base ${Vulkan_LIBRARY} ${XCB_LIBRARIES} ${WAYLAND_CLIENT_LIBRARIES} ${CMAKE_THREAD_LIBS_INIT} ${DRACO_DECODER_LIBRARY})
endif(WIN32)