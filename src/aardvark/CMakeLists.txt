cmake_minimum_required ( VERSION 3.14)

add_library(aardvark STATIC
	aardvark_gadget_manifest.cpp
	aardvark_transform.cpp
	aardvark_scene_graph.cpp

	${AV_SRC_PUBLIC}/aardvark/aardvark_gadget_manifest.h
	${AV_SRC_PUBLIC}/aardvark/aardvark_scene_graph.h
	${AV_SRC_PUBLIC}/aardvark/aardvark_transform.h
	${AV_SRC_PUBLIC}/aardvark/irenderer.h
	${AV_SRC_PUBLIC}/aardvark/ivrmanager.h
)

target_compile_options(aardvark PRIVATE
                           /W3 /IGNORE:4267 )
target_link_libraries( aardvark PRIVATE tools )


target_include_directories( aardvark PUBLIC ${AV_SRC_PUBLIC} )
target_include_directories( aardvark PRIVATE ${AV_SRC_THIRDPARTY} )
target_include_directories( aardvark PUBLIC ${CMAKE_CURRENT_BINARY_DIR} )
target_include_directories( aardvark PUBLIC ${AV_SRC_THIRDPARTY}/glm )

