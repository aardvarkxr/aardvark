find_package(Vulkan)

SET(EXAMPLE_NAME "avrenderer")
file(GLOB SHADERS "${AV_DATA}/shaders/*.vert" "${AV_DATA}/shaders/*.frag" "${AV_DATA}/shaders/*.comp" "${AV_DATA}/shaders/*.geom" "${AV_DATA}/shaders/*.tesc" "${AV_DATA}/shaders/*.tese")
source_group("Shaders" FILES ${SHADERS})

add_executable(avrenderer 
	avrenderer_main.cpp
	${SHADERS}
	)
target_link_libraries(avrenderer ${Vulkan_LIBRARY} ${WINLIBS})

target_include_directories( avrenderer PUBLIC ${AV_SRC_THIRDPARTY} )
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