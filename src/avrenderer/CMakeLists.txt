find_package(Vulkan)

SET(EXAMPLE_NAME "avrenderer")
file(GLOB SOURCE *.cpp ${BASE_HEADERS})
file(GLOB SHADERS "../data/shaders/*.vert" "../data/shaders/*.frag" "../data/shaders/*.comp" "../data/shaders/*.geom" "../data/shaders/*.tesc" "../data/shaders/*.tese")
source_group("Shaders" FILES ${SHADERS})

add_executable(avrenderer 
	avrenderer_main.cpp
	${SHADERS}
	)
target_link_libraries(${EXAMPLE_NAME} ${Vulkan_LIBRARY} ${WINLIBS})

target_include_directories( avrenderer PUBLIC ${AV_SRC_THIRDPARTY} )
target_link_libraries( avrenderer gltfpbr_base)
target_compile_definitions(avrenderer PRIVATE 
	_CRT_SECURE_NO_WARNINGS
	_USE_MATH_DEFINES
	_SILENCE_CXX17_OLD_ALLOCATOR_MEMBERS_DEPRECATION_WARNING
	NOMINMAX
	)

if(RESOURCE_INSTALL_DIR)
	install(TARGETS ${EXAMPLE_NAME} DESTINATION ${CMAKE_INSTALL_BINDIR})
endif()