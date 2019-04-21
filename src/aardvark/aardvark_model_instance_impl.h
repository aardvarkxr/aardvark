#pragma once


#include "aardvark/aardvark.h"
#include "aardvark_handle.h"
#include "aardvark.capnp.h"
#include "framestructs.h"

namespace aardvark
{
	class CAardvarkGadget;
	struct AvVisuals_t;

	class CAardvarkModelInstance : public AvModelInstance::Server
	{
	public:
		CAardvarkModelInstance( const std::string & sName, CAardvarkGadget *pParentGadget );

		void AddClient( AvModelInstance::Client & client ) { m_vecClients.push_back( AvModelInstance::Client( client ) ); }
		void clearClients() { m_vecClients.clear(); }
		AvModelInstance::Client createNewClient();

		void gatherVisuals( AvVisuals_t & visuals, const std::string & sParentPath, const AvTransform_t & transformParent );

		virtual ::kj::Promise<void> destroy( DestroyContext context ) override;
		virtual ::kj::Promise<void> source( SourceContext context ) override;

		virtual ::kj::Promise<void> setTransform( SetTransformContext context ) override;
		virtual ::kj::Promise<void> getTransform( GetTransformContext context ) override;

	private:
		std::string m_sSourceUri;
		CAardvarkGadget *m_pParentGadget = nullptr;
		std::vector< AvModelInstance::Client > m_vecClients;
		AvTransform_t m_transform;
		std::string m_sTransformParent;
	};
}
