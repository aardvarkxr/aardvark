#include "aardvark_app_impl.h"

using namespace aardvark;

bool CAardvarkApp::Init( const char *pchName )
{
	if ( !pchName )
	{
		return false;
	}

	m_sName = pchName;
	return true;
}