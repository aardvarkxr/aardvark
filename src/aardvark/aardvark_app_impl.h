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
		uint32_t getId() const { return m_id; }
		bool hasSharedTextureInfo() const { return m_sharedTexture.isSet();  }
		void setSharedTextureInfo( AvSharedTextureInfo::Reader sharedTextureInfo );
		AvSharedTextureInfo::Reader getSharedTextureInfo();

		void gatherVisuals( AvVisuals_t & visuals );

		virtual ::kj::Promise<void> destroy( DestroyContext context ) override;
		virtual ::kj::Promise<void> name( NameContext context ) override;
		virtual ::kj::Promise<void> updateSceneGraph( UpdateSceneGraphContext context ) override;
	private:
		std::string m_sName;
		std::vector< AvApp::Client > m_vecClients;
		tools::OwnCapnp<AvNodeRoot> m_sceneGraph = nullptr;
		tools::OwnCapnp<AvSharedTextureInfo> m_sharedTexture = nullptr;
		AvServerImpl *m_pParentServer = nullptr;
		uint32_t m_id = 0;
	};

	typedef std::shared_ptr< CAardvarkApp > AardvarkAppPtr_t;
}

