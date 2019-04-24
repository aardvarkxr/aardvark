cmake_minimum_required ( VERSION 3.14)

find_package( CapnProto 0.7.0 REQUIRED )

capnp_generate_cpp( CAPNP_SRCS CAPNP_HDRS aardvark.capnp )

add_library(aardvark STATIC
	aardvark_app_impl.cpp
	aardvark_app_impl.h
	aardvark_apps.cpp
	aardvark_frame_impl.cpp
	aardvark_frame_impl.h
	aardvark_frames.cpp
	aardvark_gadget_impl.cpp
	aardvark_gadget_impl.h
	aardvark_gadgets.cpp
	aardvark_model_instance_impl.cpp
	aardvark_model_instance_impl.h
	aardvark_model_source_impl.cpp
	aardvark_model_source_impl.h
	aardvark_handle.cpp
	aardvark_handle.h
	aardvark_client.cpp
	pathtools.cpp
	pathtools.h
	filetools.cpp
	filetools.h
	stringtools.cpp
	stringtools.h
	framestructs.cpp
	framestructs.h

	${AV_SRC_PUBLIC}/aardvark/aardvark_client.h
	aardvark_server.cpp
	${AV_SRC_PUBLIC}/aardvark/aardvark_server.h
	${CAPNP_SRCS}
	${CAPNP_HDRS}
	aardvark.capnp
)

target_link_libraries( aardvark PUBLIC CapnProto::capnp-rpc )


target_link_directories( aardvark PUBLIC ${CAPNP_LIBRARIES} )
target_include_directories( aardvark PUBLIC ${AV_SRC_PUBLIC} )
target_include_directories( aardvark PRIVATE ${AV_SRC_THIRDPARTY} )
target_include_directories( aardvark PUBLIC ${CMAKE_CURRENT_BINARY_DIR} )

