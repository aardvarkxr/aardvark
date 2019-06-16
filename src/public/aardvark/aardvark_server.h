#pragma once

#include "aardvark.capnp.h"

#include <vector>
#include <memory>
#include <thread>

namespace aardvark
{
	class CAardvarkApp;
	class CAardvarkModelSource;

	class AvServerImpl final : public AvServer::Server, public kj::TaskSet::ErrorHandler
	{
		friend class CServerThread;
	public:
		virtual ::kj::Promise<void> createApp( CreateAppContext context ) override;
		virtual ::kj::Promise<void> listenForFrames( ListenForFramesContext context ) override;
		virtual ::kj::Promise<void> getModelSource( GetModelSourceContext context ) override;
		virtual ::kj::Promise<void> updateDxgiTextureForApps( UpdateDxgiTextureForAppsContext context ) override;
		virtual ::kj::Promise<void> pushPokerProximity( PushPokerProximityContext context ) override;
		virtual void taskFailed( kj::Exception&& exception ) override;

		void removeApp( CAardvarkApp *pApp );
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

		kj::Maybe<CAardvarkApp&> findApp( uint32_t appId );
		kj::Maybe<AvPokerHandler::Client> findPokerHandler( uint64_t pokerGlobalId );
		kj::Maybe<AvPanelHandler::Client> findPanelHandler( uint64_t panelGlobalId );

	protected:
		void sendFrameToAllListeners();
		void sendFrameToListener( AvFrameListener::Client listener );
		void clearApps();
		CAardvarkModelSource *findOrCreateSource( const std::string & sUri );
		CAardvarkApp *findAppByName( const std::string & sAppName );

	private:
		std::unordered_map< std::string, CAardvarkModelSource *> m_mapModelSources;
		std::vector< CAardvarkApp * > m_vecApps;
		std::vector< AvFrameListener::Client > m_frameListeners;
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
