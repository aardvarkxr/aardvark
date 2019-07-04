#pragma once

#include "aardvark.capnp.h"

#include <vector>
#include <memory>
#include <thread>

namespace aardvark
{
	class CAardvarkGadget;
	class CAardvarkModelSource;

	class AvServerImpl final : public AvServer::Server, public kj::TaskSet::ErrorHandler
	{
		friend class CServerThread;
	public:
		::kj::Promise<void> createGadget( uint32_t clientId, AvServer::Server::CreateGadgetContext context );
		::kj::Promise<void> listenForFrames( uint32_t clientId, AvServer::Server::ListenForFramesContext context );
		::kj::Promise<void> getModelSource( uint32_t clientId, AvServer::Server::GetModelSourceContext context );
		::kj::Promise<void> updateDxgiTextureForGadgets( uint32_t clientId, AvServer::Server::UpdateDxgiTextureForGadgetsContext context );
		::kj::Promise<void> pushPokerProximity( uint32_t clientId, AvServer::Server::PushPokerProximityContext context );
		::kj::Promise<void> pushGrabIntersections( uint32_t clientId, AvServer::Server::PushGrabIntersectionsContext context );
		virtual void taskFailed( kj::Exception&& exception ) override;

		void removeGadget( CAardvarkGadget *gadget );
		void markFrameDirty() { m_frameDirty = true;  }
		void runFrame();

		void addToTasks( kj::Promise<void> && promRequest );
		
		template <typename TRequest, typename TResult>
		void addRequestToTasks( capnp::Request<TRequest, TResult> && req )
		{
			auto prom = req.send().then(
				[]( TResult::Reader && results )
			{
			},
				[]( kj::Exception&& exception )
			{

			}
			);
			addToTasks( std::move( prom.eagerlyEvaluate( nullptr ) ) );
		}

		void sendHapticEvent( uint64_t targetNodeId, float amplitude, float frequency, float duration );
		void startGrab( uint64_t globalGrabberId, uint64_t globalGrabbableId );
		void endGrab( uint64_t globalGrabberId, uint64_t globalGrabbableId );

		kj::Maybe<CAardvarkGadget&> findGadget( uint32_t gadgetId );
		kj::Maybe<AvPokerProcessor::Client> findPokerProcessor( uint64_t pokerGlobalId );
		kj::Maybe<AvPanelProcessor::Client> findPanelProcessor( uint64_t panelGlobalId );
		kj::Maybe<AvGrabberProcessor::Client> findGrabberProcessor( uint64_t grabberGlobalId );
		kj::Maybe<AvGrabbableProcessor::Client> findGrabbableProcessor( uint64_t grabbableGlobalId );

		void clientDisconnected( uint32_t clientId );
	protected:
		void sendFrameToAllListeners();
		void sendFrameToListener( AvFrameListener::Client listener );
		void clearGadgets();
		CAardvarkModelSource *findOrCreateSource( const std::string & sUri );
		CAardvarkGadget *findGadgetByName( const std::string & sGadgetName );

	private:
		std::unordered_map< std::string, CAardvarkModelSource *> m_mapModelSources;
		std::vector< CAardvarkGadget * > m_vecGadgets;

		struct FrameListener_t
		{
			uint32_t clientId;
			AvFrameListener::Client client;
		};
		std::vector< FrameListener_t > m_frameListeners;
		uint64_t m_unNextFrame = 1;
		bool m_frameDirty = false;
		kj::Own< kj::TaskSet > m_eventTasks = kj::heap<kj::TaskSet>( *this );
	};


	class CServerThread
	{
	public:
		CServerThread();

		void Start();
		void Join();

	private:
		void Run();

		std::thread m_thread;
		bool m_bStop = false;
	};
};
