#include "aardvark_gadget_impl.h"

using namespace aardvark;

bool CAardvarkGadget::Init( const char *pchName, AppHandle_t hApp )
{
	if ( !pchName || !hApp )
	{
		return false;
	}

	m_sName = pchName;
	m_hApp = hApp;
	return true;
}