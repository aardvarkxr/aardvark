#pragma once

#include "aardvark_types.h"

namespace aardvark
{
	class FrameHandleClass_t;
	typedef FrameHandleClass_t *FrameHandle_t;

	EAardvarkError avComputeNextFrame( FrameHandle_t *phFrame );

}