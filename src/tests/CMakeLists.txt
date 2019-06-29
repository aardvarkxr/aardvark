
find_package( CapnProto 0.7.0 REQUIRED)

add_executable( tests
	test_aardvark_apps.cpp
	test_models.cpp
	test_tools.cpp
	tests.cpp
	testutils.cpp
	testutils.h
)

target_include_directories( tests PRIVATE ${AV_SRC_THIRDPARTY} )

target_link_libraries( tests aardvark )
target_link_libraries( tests tools )
#target_link_libraries( tests CapnProto::capnp )
#target_link_directories( aardvark PUBLIC ${CAPNP_LIBRARIES} )

