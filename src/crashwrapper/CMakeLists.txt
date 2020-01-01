cmake_minimum_required ( VERSION 3.14)

add_library(crashwrapper SHARED
	crashwrapper.cpp
	${AV_SRC_PUBLIC}/crashwrapper/crashwrapper.h
)

target_compile_definitions( crashwrapper PRIVATE 
	_SILENCE_CXX17_CODECVT_HEADER_DEPRECATION_WARNING
	)

target_include_directories( crashwrapper PUBLIC ${AV_SRC_PUBLIC} )
target_include_directories( crashwrapper PRIVATE ${AV_SRC_THIRDPARTY}/backtrace/crashpad-2020-01-01-release-x64/include )
target_include_directories( crashwrapper PRIVATE ${AV_SRC_THIRDPARTY}/backtrace/crashpad-2020-01-01-release-x64/include/mini_chromium )

target_link_libraries( crashwrapper ${Backtrace_LIB_DIR}/base.lib )
target_link_libraries( crashwrapper ${Backtrace_LIB_DIR}/client.lib )
target_link_libraries( crashwrapper ${Backtrace_LIB_DIR}/util.lib )
