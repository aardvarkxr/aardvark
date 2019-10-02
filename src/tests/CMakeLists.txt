
add_executable( tests
	test_tools.cpp
	tests.cpp
	testutils.cpp
	testutils.h
)

target_include_directories( tests PRIVATE ${AV_SRC_THIRDPARTY} )

target_link_libraries( tests aardvark )
target_link_libraries( tests tools )

