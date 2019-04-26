cmake_minimum_required ( VERSION 3.14)
project( Aardvark VERSION 0.1
					DESCRIPTION "AR in VR"
					LANGUAGES CXX)

set( CapnProto_DIR ${CMAKE_SOURCE_DIR}/packages/capnproto/lib/cmake/CapnProto  )
#add_compile_definitions(_ITERATOR_DEBUG_LEVEL=0)

set( AV_SRC_PUBLIC ${CMAKE_SOURCE_DIR}/public )
set( AV_SRC_THIRDPARTY ${CMAKE_SOURCE_DIR}/thirdparty )

message ( "pub" ${AV_SRC_PUBLIC} )
message ( "tp" ${AV_SRC_THIRDPARTY} )

add_compile_options( "/std:c++17" )

add_subdirectory(aardvark)
add_subdirectory(tools)
add_subdirectory(tests)



