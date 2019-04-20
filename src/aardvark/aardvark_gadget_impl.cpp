#include "aardvark_gadget_impl.h"
#include "aardvark_app_impl.h"

using namespace aardvark;

CAardvarkGadget::CAardvarkGadget( const std::string & sName, CAardvarkApp *pParentApp )
{
	m_sName = sName;
	m_pParentApp = pParentApp;
}


::kj::Promise<void> CAardvarkGadget::destroy( DestroyContext context )
{
	m_pParentApp->removeGadget( this );
	context.getResults().setSuccess( true );
	return kj::READY_NOW;
}

::kj::Promise<void> CAardvarkGadget::name( NameContext context )
{
	context.getResults().setName( m_sName );
	return kj::READY_NOW;
}


//::kj::Promise<void> CAardvarkApp::createGadget( CreateGadgetContext context )
//{
//	auto gadget = kj::heap<CAardvarkGadget>( context.getParams().getName(), this );
//	auto& gadgetRef = *gadget;
//	AvGadget::Client capability = kj::mv( gadget );
//
//	context.getResults().setGadget( capability );
//
//	gadgetRef.AddClient( capability );
//
//	m_vecGadgets.push_back( &gadgetRef );
//
//	return kj::READY_NOW;
//}
//
//void AvServerImpl::removeGadget( CAardvarkGadget *pGadget )
//{
//	auto iApp = std::find( m_vecGadgets.begin(), m_vecGadgets.end(), pGadget );
//	if ( iApp != m_vecGadgets.end() )
//	{
//		pGadget->clearClients();
//		m_vecGadgets.erase( iApp );
//	}
//}
//
