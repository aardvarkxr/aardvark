#include "aardvark_app_impl.h"
#include "aardvark_gadget_impl.h"

#include <algorithm>
#include <assert.h>

using namespace aardvark;

CAardvarkApp::CAardvarkApp( const std::string & sName )
{
	m_sName = sName;
//	this->body.setRoot( m_body.getRoot() );
}


bool CAardvarkApp::Init( const char *pchName )
{
	if ( !pchName )
	{
		return false;
	}

	m_sName = pchName;
	return true;
}

void CAardvarkApp::AddGadget( std::shared_ptr<CAardvarkGadget> gadget )
{
//	assert( gadget->GetAppHandle() == GetPublicHandle() );
	m_gadgets.push_back( gadget );
}


void CAardvarkApp::RemoveGadget( std::shared_ptr<CAardvarkGadget> gadget )
{
//	assert( gadget->GetAppHandle() == GetPublicHandle() );
	auto i = std::find( m_gadgets.begin(), m_gadgets.end(), gadget );
	if ( i != m_gadgets.end() )
	{
		m_gadgets.erase( i );
	}
}
