#pragma once


#include "aardvark/aardvark.h"
#include "aardvark_handle.h"

namespace aardvark
{
	class CAardvarkGadget : public CAardvarkHandleBaseTyped< GadgetHandle_t >
	{
	public:
		CAardvarkGadget( uint32_t unRawHandle ) : CAardvarkHandleBaseTyped < GadgetHandle_t >( unRawHandle ) {}

		bool Init( const char *pchName, AppHandle_t hApp );

		AppHandle_t GetAppHandle() const { return m_hApp; }
	private:
		std::string m_sName;
		AppHandle_t m_hApp;

	};
}