#include "aardvark_app_impl.h"
#include "aardvark_gadget_impl.h"
#include "aardvark/aardvark_server.h"

#include <algorithm>
#include <assert.h>

using namespace aardvark;

CAardvarkApp::CAardvarkApp( const std::string & sName, AvServerImpl *pParentServer )
{
	m_sName = sName;
	m_pParentServer = pParentServer;
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

::kj::Promise<void> CAardvarkApp::destroy( DestroyContext context )
{
	m_pParentServer->removeApp( this );
	context.getResults().setSuccess( true );
	return kj::READY_NOW;
}

::kj::Promise<void> CAardvarkApp::name( NameContext context )
{
	context.getResults().setName( m_sName );
	return kj::READY_NOW;
}

