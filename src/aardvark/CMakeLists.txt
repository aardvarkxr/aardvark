cmake_minimum_required ( VERSION 3.14)


add_library(aardvark STATIC
	aardvark_app_impl.cpp
	aardvark_app_impl.h
	aardvark_apps.cpp
	aardvark_frame_impl.cpp
	aardvark_frame_impl.h
	aardvark_frames.cpp
	aardvark_gadget_impl.cpp
	aardvark_gadget_impl.h
	aardvark_gadgets.cpp
	aardvark_handle.cpp
	aardvark_handle.h
)


target_include_directories( aardvark PUBLIC ${AV_SRC_PUBLIC} )
target_include_directories( aardvark PRIVATE ${AV_SRC_THIRDPARTY} )

