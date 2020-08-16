find_package(Vulkan)

SET(EXAMPLE_NAME "avrenderer")
file(GLOB SHADERS "${AV_DATA}/shaders/*.vert" "${AV_DATA}/shaders/*.frag" "${AV_DATA}/shaders/*.comp" "${AV_DATA}/shaders/*.geom" "${AV_DATA}/shaders/*.tesc" "${AV_DATA}/shaders/*.tese")
source_group("Shaders" FILES ${SHADERS})

add_executable(avrenderer 
	aardvark_renderer.cpp
	aardvark_renderer.h
	avrenderer_main.cpp
	avserver.cpp
	avserver.h
	av_cef_app.cpp
	av_cef_app.h
	av_cef_handler_win.cpp
	av_cef_handler.cpp
	av_cef_handler.h
	av_cef_javascript.cpp
	av_cef_javascript.h
	iapplication.h
	javascript_object.cpp
	javascript_object.h
	javascript_renderer.cpp
	javascript_renderer.h
	uri_request_handler.cpp
	uri_request_handler.h
	vrmanager.cpp
	vrmanager.h

	${SHADERS}
	)

target_link_libraries(avrenderer ${Vulkan_LIBRARY} ${WINLIBS})
target_link_libraries( avrenderer aardvark )
target_link_libraries( avrenderer tools )
target_link_libraries( avrenderer sentry )
target_link_libraries( avrenderer ${OpenVR_LIB_DIR}/openvr_api.lib )
target_link_libraries( avrenderer DXGI.lib )

target_include_directories( avrenderer PUBLIC ${AV_SRC_THIRDPARTY} )
target_include_directories( avrenderer PRIVATE ${OpenVR_INCLUDE_DIR} )
target_link_libraries( avrenderer gltfpbr_base)
target_compile_definitions(avrenderer PRIVATE 
	_CRT_SECURE_NO_WARNINGS
	_USE_MATH_DEFINES
	_SILENCE_CXX17_OLD_ALLOCATOR_MEMBERS_DEPRECATION_WARNING
	NOMINMAX
	)

target_link_directories( avrenderer PRIVATE ${CEF_BINARY_DIR} )

if(RESOURCE_INSTALL_DIR)
	install(TARGETS avrenderer DESTINATION ${CMAKE_INSTALL_BINDIR})
endif()

# configure_file( ${OpenVR_BIN_DIR}/openvr_api.dll ${CMAKE_CURRENT_BINARY_DIR}/openvr_api.dll COPYONLY )
add_custom_command(TARGET avrenderer POST_BUILD
                   COMMAND "${CMAKE_COMMAND}" -E copy_if_different "${OpenVR_BIN_DIR}/openvr_api.dll" "${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>/"
)

#message ( "in " ${CMAKE_BINARY_DIR}/thirdparty/sentry-native/crashpad_build/handler/$<CONFIG> )
#message ( "out " "${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>/" )
add_custom_command(TARGET avrenderer POST_BUILD
                   COMMAND "${CMAKE_COMMAND}" -E copy_if_different 
						"${CMAKE_BINARY_DIR}/thirdparty/sentry-native/crashpad_build/handler/$<CONFIG>/crashpad_handler.exe"
						"${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>/"
)

target_link_libraries( avrenderer Dwmapi.lib )

set( CEF_TARGET_OUT_DIR "${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>/")

#
# Windows configuration.
#

if(OS_WINDOWS)
  # Executable target.
  set( CEF_TARGET avrenderer )
  SET_EXECUTABLE_TARGET_PROPERTIES(${CEF_TARGET})
  target_link_libraries(avrenderer libcef libcef_dll_wrapper ${CEF_STANDARD_LIBS})

  if(USE_SANDBOX)
    # Logical target used to link the cef_sandbox library.
    ADD_LOGICAL_TARGET("cef_sandbox_lib" "${CEF_SANDBOX_LIB_DEBUG}" "${CEF_SANDBOX_LIB_RELEASE}")
    target_link_libraries(${CEF_TARGET} cef_sandbox_lib ${CEF_SANDBOX_STANDARD_LIBS})
  endif()

  # Add the custom manifest files to the executable.
  ADD_WINDOWS_MANIFEST("${CMAKE_CURRENT_SOURCE_DIR}" "${CEF_TARGET}" "exe")

  # Copy binary and resource files to the target output directory.
  COPY_FILES("${CEF_TARGET}" "${CEF_BINARY_FILES}" "${CEF_BINARY_DIR}" "${CEF_TARGET_OUT_DIR}")
  COPY_FILES("${CEF_TARGET}" "${CEF_RESOURCE_FILES}" "${CEF_RESOURCE_DIR}" "${CEF_TARGET_OUT_DIR}")
endif()

target_include_directories( avrenderer PRIVATE ${TinyProcessLibrary_INCLUDE_DIR} )
target_link_directories( avrenderer PRIVATE ${TinyProcessLibrary_LIB_DIR} )
target_link_libraries( avrenderer tiny-process-library )
target_link_libraries( avrenderer D3D11 )
