cmake_minimum_required ( VERSION 3.14)

add_library(tools STATIC
	filetools.cpp
	${AV_SRC_PUBLIC}/tools/filetools.h
	pathtools.cpp
	${AV_SRC_PUBLIC}/tools/pathtools.h
	stringtools.cpp
	${AV_SRC_PUBLIC}/tools/stringtools.h
)

target_include_directories( tools PUBLIC ${AV_SRC_PUBLIC} )
target_include_directories( tools PUBLIC ${AV_SRC_THIRDPARTY} )
