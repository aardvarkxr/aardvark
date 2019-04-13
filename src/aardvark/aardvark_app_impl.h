#pragma once

#include "aardvark/aardvark_apps.h"
#include "aardvark_handle.h"

#include <string>

namespace aardvark
{
	class CAardvarkApp : public CAardvarkHandleBaseTyped < AppHandle_t >
	{
	public:
		CAardvarkApp( uint32_t unRawHandle ) : CAardvarkHandleBaseTyped < AppHandle_t >( unRawHandle ) {}

		bool Init( const char *pchName );

	private:
		std::string m_sName;
	};

}

