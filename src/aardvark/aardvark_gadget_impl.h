#pragma once

#include "aardvark.capnp.h"

#include <tools/capnprototools.h>
#include <string>
#include <vector>
#include <unordered_map>

namespace aardvark
{
	class AvServerImpl;
	struct AvVisuals_t;

	void copyGrabEvent( AvGrabEvent::Builder & outGrabEvent, AvGrabEvent::Reader &grabEvent, uint64_t globalGrabberId );

	class CAardvarkGadget : public AvGadget::Server
	{
	public:
		CAardvarkGadget( uint32_t clientId, const std::string & sName, AvServerImpl *pParentServer );
		~CAardvarkGadget() {}

		void AddClient( AvGadget::Client & client ) { m_vecClients.push_back( AvGadget::Client( client ) ); }
		void clearClients() { m_vecClients.clear(); }
		const std::string & getName() const { return m_sName;  }
		uint32_t getId() const { return m_id; }
		uint32_t getClientId() const { return m_clientId; }
		bool hasSharedTextureInfo() const { return m_sharedTexture.isSet();  }
		void setSharedTextureInfo( AvSharedTextureInfo::Reader sharedTextureInfo );
		AvSharedTextureInfo::Reader getSharedTextureInfo();
		kj::Maybe < AvPokerProcessor::Client > findPokerProcessor( uint32_t pokerLocalId );
		kj::Maybe < AvPanelProcessor::Client > findPanelProcessor( uint32_t panelLocalId );
		kj::Maybe<AvGrabberProcessor::Client> findGrabberProcessor( uint32_t grabberLocalId );
		kj::Maybe<AvGrabbableProcessor::Client> findGrabbableProcessor( uint32_t grabbableLocalId );

		void setHook( const std::string & hook ) { m_hook = hook; }
		void gatherVisuals( AvVisuals_t & visuals );
		void sendGrabEventToGlobalId( uint64_t globalSenderId, uint64_t globalNodeId, 
			uint64_t grabberGlobalId, AvGrabEvent::Reader grabEvent );

		virtual ::kj::Promise<void> destroy( DestroyContext context ) override;
		virtual ::kj::Promise<void> name( NameContext context ) override;
		virtual ::kj::Promise<void> updateSceneGraph( UpdateSceneGraphContext context ) override;
		virtual ::kj::Promise<void> pushMouseEvent( PushMouseEventContext context ) override;
		virtual ::kj::Promise<void> sendHapticEvent( SendHapticEventContext context ) override;
		virtual ::kj::Promise<void> pushGrabEvent( PushGrabEventContext context ) override;
	private:
		std::string m_sName;
		std::vector< AvGadget::Client > m_vecClients;
		tools::OwnCapnp<AvNodeRoot> m_sceneGraph = nullptr;
		tools::OwnCapnp<AvSharedTextureInfo> m_sharedTexture = nullptr;
		std::unordered_map<uint32_t, AvPokerProcessor::Client> m_pokerProcessors;
		std::unordered_map<uint32_t, AvPanelProcessor::Client> m_panelProcessors;
		std::unordered_map<uint32_t, AvGrabberProcessor::Client> m_grabberProcessors;
		std::unordered_map<uint32_t, AvGrabbableProcessor::Client> m_grabbableProcessors;
		AvServerImpl *m_pParentServer = nullptr;
		uint32_t m_id = 0;
		uint32_t m_clientId;
		std::string m_hook;
	};
}

