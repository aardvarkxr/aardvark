


add_executable( tests
	test_aardvark_apps.cpp
	test_gadget.cpp
	tests.cpp
)

target_include_directories( tests PUBLIC ../thirdparty )

target_link_libraries( tests aardvark )

