cmake_minimum_required ( VERSION 3.14)

add_library(tools STATIC
	filetools.cpp
	${AV_SRC_PUBLIC}/tools/filetools.h
	pathtools.cpp
	${AV_SRC_PUBLIC}/tools/pathtools.h
	logging.cpp
	${AV_SRC_PUBLIC}/tools/logging.h
	stringtools.cpp
	${AV_SRC_PUBLIC}/tools/stringtools.h
	systools.cpp
	${AV_SRC_PUBLIC}/tools/systools.h
	${AV_SRC_THIRDPARTY}/easyloggingpp-9.96.7/src/easylogging++.cc
)

target_include_directories( tools PUBLIC ${AV_SRC_PUBLIC} )
target_include_directories( tools PUBLIC ${AV_SRC_THIRDPARTY} )
