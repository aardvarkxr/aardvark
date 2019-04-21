#pragma once


#include "aardvark/aardvark.h"
#include "aardvark_handle.h"
#include "aardvark.capnp.h"
#include "framestructs.h"

namespace aardvark
{
	class CAardvarkApp;
	struct AvVisuals_t;

	class CAardvarkGadget : public AvGadget::Server
	{
	public:
		CAardvarkGadget( const std::string & sName, CAardvarkApp *pParentApp );

		void AddClient( AvGadget::Client & client ) { m_vecClients.push_back( AvGadget::Client( client ) ); }
		void clearClients() { m_vecClients.clear(); }

		void gatherVisuals( AvVisuals_t & visuals );

		virtual ::kj::Promise<void> destroy( DestroyContext context ) override;
		virtual ::kj::Promise<void> name( NameContext context ) override;

		virtual ::kj::Promise<void> setTransform( SetTransformContext context ) override;
		virtual ::kj::Promise<void> getTransform( GetTransformContext context ) override;

	private:
		std::string m_sName;
		CAardvarkApp *m_pParentApp = nullptr;
		std::vector< AvGadget::Client > m_vecClients;
		AvTransform_t m_transform;
		std::string m_sTransformParent;
	};
}