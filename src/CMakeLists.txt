cmake_minimum_required ( VERSION 3.14)
project( Aardvark VERSION 0.1
					DESCRIPTION "AR in VR"
					LANGUAGES CXX)
set(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} "${CMAKE_SOURCE_DIR}/cmake")
set(NAME Aardvark)



set( CapnProto_DIR ${CMAKE_SOURCE_DIR}/packages/capnproto/lib/cmake/CapnProto  )
set( Vulkan_LIBRARY ${CMAKE_SOURCE_DIR}/thirdparty/vulkan/libs/vulkan-1.lib  )
set( Vulkan_INCLUDE_DIR ${CMAKE_SOURCE_DIR}/thirdparty/vulkan  )

#add_compile_definitions(_ITERATOR_DEBUG_LEVEL=0)

set( AV_SRC_PUBLIC ${CMAKE_SOURCE_DIR}/public )
set( AV_SRC_THIRDPARTY ${CMAKE_SOURCE_DIR}/thirdparty )
set( AV_DATA ${CMAKE_SOURCE_DIR}/../data )

#message ( "pub" ${AV_SRC_PUBLIC} )
#message ( "tp" ${AV_SRC_THIRDPARTY} )

add_compile_options( "/std:c++17" )

add_subdirectory(aardvark)
add_subdirectory(tools)
add_subdirectory(tests)
add_subdirectory(gltfpbr_base)
add_subdirectory(avrenderer)


