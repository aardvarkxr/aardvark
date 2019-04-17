
find_package( CapnProto 0.7.0 REQUIRED)

add_executable( tests
	test_aardvark_apps.cpp
	test_gadget.cpp
	tests.cpp
)

target_include_directories( tests PRIVATE ${AV_SRC_THIRDPARTY} )

target_link_libraries( tests aardvark )
#target_link_libraries( tests CapnProto::capnp )
#target_link_directories( aardvark PUBLIC ${CAPNP_LIBRARIES} )

