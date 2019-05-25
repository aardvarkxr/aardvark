#pragma once

#include "aardvark/aardvark_apps.h"
#include "aardvark_handle.h"
#include "aardvark.capnp.h"

#include <tools/capnprototools.h>
#include <string>
#include <vector>
namespace aardvark
{
	class AvServerImpl;
	struct AvVisuals_t;


	class CAardvarkApp : public AvApp::Server
	{
	public:
		CAardvarkApp( const std::string & sName, AvServerImpl *pParentServer );
		~CAardvarkApp() {}

		void AddClient( AvApp::Client & client ) { m_vecClients.push_back( AvApp::Client( client ) ); }
		void clearClients() { m_vecClients.clear(); }
		const std::string & getName() const { return m_sName;  }
		void setDxgiSharedTextureHandle( uint64_t sharedTextureHandle ) { m_dxgiSharedTextureHandle = sharedTextureHandle; }
		uint64_t getDxgiSharedTextureHandle( ) { return m_dxgiSharedTextureHandle; }

		void gatherVisuals( AvVisuals_t & visuals );

		virtual ::kj::Promise<void> destroy( DestroyContext context ) override;
		virtual ::kj::Promise<void> name( NameContext context ) override;
		virtual ::kj::Promise<void> updateSceneGraph( UpdateSceneGraphContext context ) override;
	private:
		std::string m_sName;
		std::vector< AvApp::Client > m_vecClients;
		tools::OwnCapnp<AvNodeRoot> m_sceneGraph;
		AvServerImpl *m_pParentServer = nullptr;
		uint64_t m_dxgiSharedTextureHandle = 0;
		uint32_t m_id = 0;
	};

	typedef std::shared_ptr< CAardvarkApp > AardvarkAppPtr_t;
}

