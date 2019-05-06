find_package(Vulkan)

SET(EXAMPLE_NAME "avrenderer")
file(GLOB SHADERS "${AV_DATA}/shaders/*.vert" "${AV_DATA}/shaders/*.frag" "${AV_DATA}/shaders/*.comp" "${AV_DATA}/shaders/*.geom" "${AV_DATA}/shaders/*.tesc" "${AV_DATA}/shaders/*.tese")
source_group("Shaders" FILES ${SHADERS})

add_executable(avrenderer 
	avrenderer_main.cpp
	${SHADERS}
	)
target_link_libraries(avrenderer ${Vulkan_LIBRARY} ${WINLIBS})
target_link_libraries( avrenderer aardvark )
target_link_libraries( avrenderer tools )
target_link_libraries( avrenderer ${OpenVR_LIB_DIR}/openvr_api.lib )

target_include_directories( avrenderer PUBLIC ${AV_SRC_THIRDPARTY} )
target_include_directories( avrenderer PRIVATE ${OpenVR_INCLUDE_DIR} )
target_link_libraries( avrenderer gltfpbr_base)
target_compile_definitions(avrenderer PRIVATE 
	_CRT_SECURE_NO_WARNINGS
	_USE_MATH_DEFINES
	_SILENCE_CXX17_OLD_ALLOCATOR_MEMBERS_DEPRECATION_WARNING
	NOMINMAX
	VK_EXAMPLE_DATA_DIR="${AV_DATA}"
	)

if(RESOURCE_INSTALL_DIR)
	install(TARGETS avrenderer DESTINATION ${CMAKE_INSTALL_BINDIR})
endif()

# configure_file( ${OpenVR_BIN_DIR}/openvr_api.dll ${CMAKE_CURRENT_BINARY_DIR}/openvr_api.dll COPYONLY )
message ( "in" ${OpenVR_BIN_DIR}/openvr_api.dll )
message ( "out" ${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>/openvr_api.dll )
add_custom_command(TARGET avrenderer POST_BUILD
                   COMMAND "${CMAKE_COMMAND}" -E copy_if_different "${OpenVR_BIN_DIR}/openvr_api.dll" "${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>/"
)