cmake_minimum_required ( VERSION 3.14)
project( Aardvark VERSION 0.2.0
					DESCRIPTION "AR in VR"
					LANGUAGES CXX)
set(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} "${CMAKE_SOURCE_DIR}/cmake")
set(NAME Aardvark)



set( Vulkan_LIBRARY ${CMAKE_SOURCE_DIR}/thirdparty/vulkan/libs/vulkan-1.lib  )
set( Vulkan_INCLUDE_DIR ${CMAKE_SOURCE_DIR}/thirdparty/vulkan  )

set( OpenVR_INCLUDE_DIR ${CMAKE_SOURCE_DIR}/thirdparty/openvr/headers )
set( OpenVR_LIB_DIR ${CMAKE_SOURCE_DIR}/thirdparty/openvr/lib/win64 )
set( OpenVR_BIN_DIR ${CMAKE_SOURCE_DIR}/thirdparty/openvr/bin/win64 )

set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /MT /Zi")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /MTd")
set(CMAKE_SHARED_LINKER_FLAGS_RELEASE "${CMAKE_SHARED_LINKER_FLAGS_RELEASE} /DEBUG /OPT:REF /OPT:ICF")
set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_SHARED_LINKER_FLAGS_RELEASE} /DEBUG /OPT:REF /OPT:ICF")

set( TinyProcessLibrary_INCLUDE_DIR ${CMAKE_SOURCE_DIR}/thirdparty/tiny-process-library )
set( TinyProcessLibrary_LIB_DIR ${CMAKE_LIBRARY_OUTPUT_DIRECTORY}/thirdparty/tiny-process-library/$<CONFIG> )

message ( "tpl" $TinyProcessLibrary_LIB_DIR )
set( CEF_ROOT ${CMAKE_SOURCE_DIR}/thirdparty/cef_binary_78 )
find_package( CEF )

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
add_subdirectory(thirdparty/cef_binary_78/libcef_dll )
add_subdirectory(thirdparty/tiny-process-library )


