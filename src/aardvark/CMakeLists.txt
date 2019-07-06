cmake_minimum_required ( VERSION 3.14)

find_package( CapnProto 0.7.0 REQUIRED )

capnp_generate_cpp( CAPNP_SRCS CAPNP_HDRS aardvark.capnp )

add_library(aardvark STATIC
	aardvark_gadget_impl.cpp
	aardvark_gadget_impl.h
	aardvark_gadget_manifest.cpp
	aardvark_grabbable_processor.cpp
	aardvark_grabbable_processor.h
	aardvark_grabber_processor.cpp
	aardvark_grabber_processor.h
	aardvark_panel_processor.cpp
	aardvark_panel_processor.h
	aardvark_poker_processor.cpp
	aardvark_poker_processor.h
	aardvark_scene_graph.cpp
	aardvark_client.cpp
	framestructs.cpp
	framestructs.h

	${AV_SRC_PUBLIC}/aardvark/aardvark_client.h
	aardvark_server.cpp
	${AV_SRC_PUBLIC}/aardvark/aardvark_gadget_manifest.h
	${AV_SRC_PUBLIC}/aardvark/aardvark_server.h
	${AV_SRC_PUBLIC}/aardvark/aardvark_scene_graph.h
	${CAPNP_SRCS}
	${CAPNP_HDRS}
	aardvark.capnp
)

target_compile_options(aardvark PRIVATE
                           /W3 /IGNORE:4267 )
target_link_libraries( aardvark PUBLIC CapnProto::capnp-rpc )
target_link_libraries( aardvark PRIVATE tools )


target_link_directories( aardvark PUBLIC ${CAPNP_LIBRARIES} )
target_include_directories( aardvark PUBLIC ${AV_SRC_PUBLIC} )
target_include_directories( aardvark PRIVATE ${AV_SRC_THIRDPARTY} )
target_include_directories( aardvark PUBLIC ${CMAKE_CURRENT_BINARY_DIR} )

