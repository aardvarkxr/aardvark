file(GLOB BASE_SRC "*.cpp" "../thirdparty/imgui/*.cpp")
file(GLOB BASE_HEADERS "*.hpp")

add_library(gltfpbr_base STATIC ${BASE_SRC} ${BASE_HEADERS})

target_compile_definitions(gltfpbr_base PRIVATE -D_CRT_SECURE_NO_WARNINGS)
target_include_directories( gltfpbr_base PUBLIC ${AV_SRC_THIRDPARTY} )
target_include_directories( gltfpbr_base PUBLIC ${AV_SRC_THIRDPARTY}/glm )
target_include_directories( gltfpbr_base PUBLIC ${AV_SRC_THIRDPARTY}/gli )
target_include_directories( gltfpbr_base PUBLIC ${AV_SRC_THIRDPARTY}/tinygltf )
target_include_directories( gltfpbr_base PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_definitions( gltfpbr_base PUBLIC 
	VK_USE_PLATFORM_WIN32_KHR
	VK_EXAMPLE_DATA_DIR="${AV_DATA}"
	)

if(WIN32)
    target_link_libraries(gltfpbr_base ${Vulkan_LIBRARY} ${WINLIBS} ${DRACO_DECODER_LIBRARY})
 else(WIN32)
    target_link_libraries(gltfpbr_base ${Vulkan_LIBRARY} ${XCB_LIBRARIES} ${WAYLAND_CLIENT_LIBRARIES} ${CMAKE_THREAD_LIBS_INIT} ${DRACO_DECODER_LIBRARY})
endif(WIN32)