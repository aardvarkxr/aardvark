#include "aardvark_model_instance_impl.h"
#include "aardvark_gadget_impl.h"
#include "framestructs.h"

#include <capnp/message.h>

using namespace aardvark;

CAardvarkModelInstance::CAardvarkModelInstance( const std::string & sUri, CAardvarkGadget *pParentGadget )
{
	m_sSourceUri = sUri;
	m_pParentGadget = pParentGadget;
}


AvModelInstance::Client CAardvarkModelInstance::createNewClient()
{
	return AvModelInstance::Client( m_vecClients.front() );
}


::kj::Promise<void> CAardvarkModelInstance::destroy( DestroyContext context )
{
	m_pParentGadget->removeModelInstance( this );
	context.getResults().setSuccess( true );
	return kj::READY_NOW;
}

::kj::Promise<void> CAardvarkModelInstance::source( SourceContext context )
{
	return kj::READY_NOW;
}

::kj::Promise<void> CAardvarkModelInstance::setTransform( SetTransformContext context )
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

	context.getResults().setSuccess( true );
	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkModelInstance::getTransform( GetTransformContext context )
{
	auto & results = context.initResults();
	ProtoFromTransform( results.initTransform(), m_transform );
	return kj::READY_NOW;
}


void CAardvarkModelInstance::gatherVisuals( AvVisualGadget_t & visualGadget )
{
	AvModel_t model;
	model.sSourceUri = m_sSourceUri;
	model.transform = m_transform;

	visualGadget.vecModels.push_back( model );
}


