#include "aardvark_gadget_impl.h"
#include "aardvark_app_impl.h"
#include "framestructs.h"

#include <capnp/message.h>

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

::kj::Promise<void> CAardvarkGadget::setTransform( SetTransformContext context )
{
	auto & params = context.getParams();
	if ( params.hasTransform() )
	{
		m_transform = TransformFromProto( params.getTransform() );
	}
	else
	{
		m_transform = AvTransform_t();
	}

	if ( params.hasParentPath() )
	{
		m_sTransformParent = params.getParentPath();
	}
	else
	{
		m_sTransformParent.clear();
	}

	context.getResults().setSuccess( true );
	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkGadget::getTransform( GetTransformContext context )
{
	auto & results = context.initResults();
	ProtoFromTransform( results.initTransform(), m_transform );
	if ( !m_sTransformParent.empty() )
	{
		results.setParentPath( m_sTransformParent );
	}
	return kj::READY_NOW;
}


void CAardvarkGadget::gatherVisuals( AvVisuals_t & visuals )
{
	AvModel_t model;
	model.sSourceUri = "http://somedomain.com/assets/something.gltf";
	model.transform.position = { 1, 2, 3 };

	visuals.vecModels.push_back( model );
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
