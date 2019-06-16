#pragma once

#include "aardvark/aardvark_apps.h"
#include "aardvark_handle.h"
#include "aardvark.capnp.h"

#include <tools/capnprototools.h>
#include <string>
#include <vector>
#include <unordered_map>

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
		kj::Maybe < AvPokerHandler::Client > findPokerHandler( uint32_t pokerLocalId );
		kj::Maybe < AvPanelHandler::Client > findPanelHandler( uint32_t pokerLocalId );

		void gatherVisuals( AvVisuals_t & visuals );

		virtual ::kj::Promise<void> destroy( DestroyContext context ) override;
		virtual ::kj::Promise<void> name( NameContext context ) override;
		virtual ::kj::Promise<void> updateSceneGraph( UpdateSceneGraphContext context ) override;
		virtual ::kj::Promise<void> pushMouseEvent( PushMouseEventContext context )override;
		virtual ::kj::Promise<void> listenForPokerProximity( ListenForPokerProximityContext context ) override;
	private:
		std::string m_sName;
		std::vector< AvApp::Client > m_vecClients;
		tools::OwnCapnp<AvNodeRoot> m_sceneGraph = nullptr;
		tools::OwnCapnp<AvSharedTextureInfo> m_sharedTexture = nullptr;
		std::unordered_map<uint32_t, AvPokerHandler::Client> m_pokerHandlers;
		std::unordered_map<uint32_t, AvPanelHandler::Client> m_panelHandlers;
		std::list<AvPokerHandler::Client> m_pokerHandler;
		AvServerImpl *m_pParentServer = nullptr;
		uint32_t m_id = 0;
	};

	typedef std::shared_ptr< CAardvarkApp > AardvarkAppPtr_t;
}

