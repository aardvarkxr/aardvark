#include "aardvark_gadget_impl.h"
#include "aardvark_app_impl.h"
#include "framestructs.h"
#include "aardvark_model_instance_impl.h"

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


::kj::Promise<void> CAardvarkGadget::createModelInstance( CreateModelInstanceContext context )
{
	auto modelInstance = kj::heap<CAardvarkModelInstance>( context.getParams().getUri(), this );
	auto& modelInstanceRef = *modelInstance;
	AvModelInstance::Client capability = kj::mv( modelInstance );

	context.getResults().setModel( capability );

	modelInstanceRef.AddClient( capability );

	m_vecModelInstances.push_back( &modelInstanceRef );

	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkGadget::models( ModelsContext context )
{
	auto bldModels = context.getResults().initModels( (uint32_t)m_vecModelInstances.size() );
	uint32_t unIndex = 0;
	for ( auto iModel : m_vecModelInstances )
	{
		bldModels.set( unIndex++, iModel->createNewClient() );
	}

	return kj::READY_NOW;
}


void CAardvarkGadget::gatherVisuals( AvVisuals_t & visuals )
{
	//AvVisualGadget_t visualGadget;
	//visualGadget.transform = m_transform;
	//for ( auto iModel : m_vecModelInstances )
	//{
	//	iModel->gatherVisuals( visualGadget );
	//}
	//visuals.vecGadgets.push_back( visualGadget );
}


void CAardvarkGadget::removeModelInstance( CAardvarkModelInstance *pModelInstance )
{
	auto iModelInstance = std::find( m_vecModelInstances.begin(), m_vecModelInstances.end(), pModelInstance );
	if ( iModelInstance != m_vecModelInstances.end() )
	{
		pModelInstance->clearClients();
		m_vecModelInstances.erase( iModelInstance );
	}
}

