#pragma once

#include <aardvark/aardvark_frames.h>
#include "aardvark_app_impl.h"

#include <vector>
namespace aardvark
{

	class CAardvarkFrame : public CAardvarkHandleBaseTyped < FrameHandle_t >
	{
	public:
		CAardvarkFrame( uint32_t unRawHandle ) : CAardvarkHandleBaseTyped < FrameHandle_t >( unRawHandle ) {}

		bool Init();

	private:
		std::vector< std::shared_ptr<CAardvarkApp> > m_apps;
	};

}

