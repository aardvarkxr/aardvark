#include "aardvark/aardvark_server.h"
#include "aardvark_app_impl.h"
#include "aardvark_model_source_impl.h"
#include "framestructs.h"
#include "tools/filetools.h"
#include "tools/pathtools.h"
#include <map>
#include <capnp/rpc-twoparty.h>
#include <capnp/rpc.capnp.h>
#include <kj/async-io.h>
#include <kj/threadlocal.h>
#include <kj/debug.h>

using namespace capnp;

namespace aardvark
{

	void AvServerImpl::taskFailed( kj::Exception&& exception )
	{
		// we don't really care about failed requests on our task set
	}

	::kj::Promise<void> AvServerImpl::createApp( uint32_t clientId, CreateAppContext context )
	{
		auto server = kj::heap<CAardvarkApp>( clientId, context.getParams().getName(), this );
		auto& serverRef = *server;

		AvApp::Client capability = kj::mv( server );

		context.getResults().setApp( capability );

		serverRef.AddClient( capability );
		
		m_vecApps.push_back( &serverRef );

		return kj::READY_NOW;
	}

	void AvServerImpl::clearApps()
	{
		for ( auto iApp : m_vecApps )
		{
			iApp->clearClients();
		}
		m_vecApps.clear();
	}

	void AvServerImpl::removeApp( CAardvarkApp *pApp )
	{
		auto iApp = std::find( m_vecApps.begin(), m_vecApps.end(), pApp );
		if ( iApp != m_vecApps.end() )
		{
			pApp->clearClients();
			m_vecApps.erase( iApp );
		}
	}

	void CopyTransform( AvTransform::Builder & out, const AvTransform_t & in )
	{
		out.getPosition().setX( in.position.x );
		out.getPosition().setY( in.position.y );
		out.getPosition().setZ( in.position.z );
		out.getRotation().setX( in.rotation.x );
		out.getRotation().setY( in.rotation.y );
		out.getRotation().setZ( in.rotation.z );
		out.getRotation().setW( in.rotation.w );
		out.getScale().setX( in.scale.x );
		out.getScale().setY( in.scale.y );
		out.getScale().setZ( in.scale.z );
	}

	::kj::Promise<void> AvServerImpl::listenForFrames( uint32_t clientId, ListenForFramesContext context )
	{
		AvServer::Server::ListenForFramesParams::Reader params = context.getParams();
		m_frameListeners.push_back( { clientId, context.getParams().getListener() } );
		markFrameDirty();
		return kj::READY_NOW;
	}

	void AvServerImpl::sendFrameToAllListeners()
	{
		for ( auto & listener : m_frameListeners )
		{
			sendFrameToListener( listener.client );
		}
	}

	void AvServerImpl::sendFrameToListener( AvFrameListener::Client listener )
	{
		std::map<std::string, AvSharedTextureInfo::Reader> sharedTextureHandles;
		AvVisuals_t visuals;
		for ( auto app : m_vecApps )
		{
			app->gatherVisuals( visuals );

			if ( app->hasSharedTextureInfo() )
			{
				sharedTextureHandles.insert_or_assign( app->getName(), app->getSharedTextureInfo() );
			}
		}

		auto reqNewFrame = listener.newFrameRequest();
		auto bldFrame = reqNewFrame.initFrame();
		bldFrame.setId( m_unNextFrame++ );

		if ( !visuals.vecSceneGraphs.empty() )
		{
			auto bldRoots = bldFrame.initRoots( (uint32_t)visuals.vecSceneGraphs.size() );
			for ( uint32_t unIndex = 0; unIndex < visuals.vecSceneGraphs.size(); unIndex++ )
			{
				bldRoots[unIndex].setNodes( visuals.vecSceneGraphs[unIndex].root.getNodes() );
				bldRoots[unIndex].setSourceId( visuals.vecSceneGraphs[unIndex].appId );
			}

			auto bldTextures = bldFrame.initAppTextures( (uint32_t)sharedTextureHandles.size() );
			uint32_t unIndex = 0;
			for ( auto handle : sharedTextureHandles )
			{
				CAardvarkApp *pApp = findAppByName( handle.first );
				if ( pApp )
				{
					bldTextures[unIndex].setAppName( handle.first );
					bldTextures[unIndex].setAppId( pApp->getId() );
					bldTextures[unIndex].setSharedTextureInfo( handle.second );
					unIndex++;
				}
			}
		}

		addRequestToTasks( std::move( reqNewFrame ) );
	}

	CAardvarkApp *AvServerImpl::findAppByName( const std::string & sAppName )
	{
		for ( auto pApp : m_vecApps )
		{
			if ( pApp->getName() == sAppName )
			{
				return pApp;
			}
		}

		return nullptr;
	}

	::kj::Promise<void> AvServerImpl::updateDxgiTextureForApps( uint32_t clientId, UpdateDxgiTextureForAppsContext context )
	{
		if ( context.getParams().hasAppNames() )
		{
			for ( auto app : m_vecApps )
			{
				bool bSetThisOne = false;
				for ( auto appName : context.getParams().getAppNames() )
				{
					if ( appName == app->getName() )
					{
						app->setSharedTextureInfo( context.getParams().getSharedTextureInfo() );
						break;
					}
				}
			}

			markFrameDirty();
		}

		return kj::READY_NOW;
	}

	::kj::Promise<void> AvServerImpl::pushPokerProximity( uint32_t clientId, PushPokerProximityContext context )
	{
		uint64_t pokerGlobalId = context.getParams().getPokerId();
		KJ_IF_MAYBE( handler, findPokerProcessor( pokerGlobalId ) )
		{
			auto req = handler->updatePanelProximityRequest();
			req.setPokerId( (uint32_t)( 0xFFFFFFFF & pokerGlobalId ) );
			req.setProximity( context.getParams().getProximity() );
			addRequestToTasks( std::move( req ) );
		}
		else
		{
			// if the poker or the app has gone away, just drop the request on the floor.
		}
		return kj::READY_NOW;
	}


	CAardvarkModelSource *AvServerImpl::findOrCreateSource( const std::string & sUri )
	{
		auto iSource = m_mapModelSources.find( sUri );
		if ( iSource != m_mapModelSources.end() )
		{
			return iSource->second;
		}

		if ( !tools::IsFileUri( sUri ) )
		{
			// TODO(Joe): actual HTTP requests aren't supported yet
			return nullptr;
		}

		auto path = tools::FileUriToPath( sUri );
		if ( path.empty() )
		{
			// URI must have been malformed in some way
			return nullptr;
		}

		auto modelBlob = tools::ReadBinaryFile( path );
		if ( modelBlob.empty() )
		{
			return nullptr;
		}

		auto modelSource = kj::heap<CAardvarkModelSource>( sUri, std::move( modelBlob ) );

		auto& modelSourceRef = *modelSource;
		AvModelSource::Client capability = kj::mv( modelSource );

		modelSourceRef.setClient( capability );

		m_mapModelSources.insert( std::make_pair( std::string( sUri ), &modelSourceRef ) );

		return &modelSourceRef;
	}

	::kj::Promise<void> AvServerImpl::getModelSource( uint32_t clientId, GetModelSourceContext context )
	{
		std::string sUri = context.getParams().getUri();
		if ( sUri.size() == 0 )
		{
			context.getResults().setSuccess( false );
			return kj::READY_NOW;
		}

		CAardvarkModelSource *pSource = findOrCreateSource( sUri );
		if ( !pSource )
		{
			context.getResults().setSuccess( false );
		}
		else
		{
			context.getResults().setSource( pSource->getClient() );
			context.getResults().setSuccess( true );
		}
		return kj::READY_NOW;
	}


	void AvServerImpl::runFrame()
	{
		if ( m_frameDirty )
		{
			sendFrameToAllListeners();
			m_frameDirty = false;
		}
	}

	kj::Maybe<CAardvarkApp&> AvServerImpl::findApp( uint32_t appId )
	{
		for ( auto app : m_vecApps )
		{
			if ( app->getId() == appId )
			{
				return app;
			}
		}
		return nullptr;
	}

	kj::Maybe < AvPokerProcessor::Client > AvServerImpl::findPokerProcessor( uint64_t pokerGlobalId )
	{
		uint32_t appId = (uint32_t)( pokerGlobalId >> 32 );
		uint32_t pokerLocalId = (uint32_t) ( 0xFFFFFFFF & pokerGlobalId );
		KJ_IF_MAYBE( app, findApp( appId ) )
		{
			return app->findPokerProcessor( pokerLocalId );
		}
		else
		{
			return nullptr;
		}
	}

	kj::Maybe < AvPanelProcessor::Client > AvServerImpl::findPanelProcessor( uint64_t panelGlobalId )
	{
		uint32_t appId = (uint32_t)( panelGlobalId >> 32 );
		uint32_t panelLocalId = (uint32_t)( 0xFFFFFFFF & panelGlobalId );
		KJ_IF_MAYBE( app, findApp( appId ) )
		{
			return app->findPanelProcessor( panelLocalId );
		}
		else
		{
		return nullptr;
		}
	}

	kj::Maybe < AvGrabberProcessor::Client > AvServerImpl::findGrabberProcessor( uint64_t grabberGlobalId )
	{
		uint32_t appId = (uint32_t)( grabberGlobalId >> 32 );
		uint32_t grabberLocalId = (uint32_t) ( 0xFFFFFFFF & grabberGlobalId );
		KJ_IF_MAYBE( app, findApp( appId ) )
		{
			return app->findGrabberProcessor( grabberLocalId );
		}
		else
		{
			return nullptr;
		}
	}

	kj::Maybe < AvGrabbableProcessor::Client > AvServerImpl::findGrabbableProcessor( uint64_t grabbableGlobalId )
	{
		uint32_t appId = (uint32_t)( grabbableGlobalId >> 32 );
		uint32_t grabbableLocalId = (uint32_t)( 0xFFFFFFFF & grabbableGlobalId );
		KJ_IF_MAYBE( app, findApp( appId ) )
		{
			return app->findGrabbableProcessor( grabbableLocalId );
		}
		else
		{
		return nullptr;
		}
	}

	void AvServerImpl::addToTasks( kj::Promise<void> && promRequest )
	{
		m_eventTasks->add( std::move( promRequest ) );
	}

	void AvServerImpl::clientDisconnected( uint32_t clientId )
	{
		for ( auto iApp = m_vecApps.begin(); iApp != m_vecApps.end(); )
		{
			if ( ( *iApp )->getClientId() == clientId )
			{
				( *iApp )->clearClients();
				iApp = m_vecApps.erase( iApp );
			}
			else
			{
				iApp++;
			}
		}

		for ( auto iFrameListener = m_frameListeners.begin(); iFrameListener != m_frameListeners.end(); )
		{
			if ( iFrameListener->clientId == clientId )
			{
				iFrameListener = m_frameListeners.erase( iFrameListener );
			}
			else
			{
				iFrameListener++;
			}
		}

		markFrameDirty();
	}

	void AvServerImpl::sendHapticEvent( uint64_t targetNodeId, float amplitude, float frequency, float duration )
	{
		for ( auto iFrameListener : m_frameListeners )
		{
			auto req = iFrameListener.client.sendHapticEventRequest();
			req.setTargetGlobalId( targetNodeId );
			req.setAmplitude( amplitude );
			req.setFrequency( frequency );
			req.setDuration( duration );
			addRequestToTasks( std::move( req ) );
		}
	}

	void AvServerImpl::startGrab( uint64_t globalGrabberId, uint64_t globalGrabbableId )
	{
		for ( auto iFrameListener : m_frameListeners )
		{
			auto req = iFrameListener.client.startGrabRequest();
			req.setGrabberGlobalId( globalGrabberId );
			req.setGrabbableGlobalId( globalGrabbableId );
			addRequestToTasks( std::move( req ) );
		}
	}

	void AvServerImpl::endGrab( uint64_t globalGrabberId, uint64_t globalGrabbableId )
	{
		for ( auto iFrameListener : m_frameListeners )
		{
			auto req = iFrameListener.client.endGrabRequest();
			req.setGrabberGlobalId( globalGrabberId );
			req.setGrabbableGlobalId( globalGrabbableId );
			addRequestToTasks( std::move( req ) );
		}
	}

	::kj::Promise<void> AvServerImpl::pushGrabIntersections( uint32_t clientId,
		AvServer::Server::PushGrabIntersectionsContext context )
	{
		uint64_t grabberGlobalId = context.getParams().getGrabberId();
		KJ_IF_MAYBE( processor, findGrabberProcessor( grabberGlobalId ) )
		{
			auto req = processor->updateGrabberIntersectionsRequest();
			req.setGrabberId( (uint32_t)( 0xFFFFFFFF & grabberGlobalId ) );

			req.setIntersections( context.getParams().getIntersections() );
			addRequestToTasks( std::move( req ) );
		}

		return kj::READY_NOW;
	}


	namespace {

		class DummyFilter : public kj::LowLevelAsyncIoProvider::NetworkFilter {
		public:
			bool shouldAllow( const struct sockaddr* addr, uint addrlen ) override {
				return true;
			}
		};

		static DummyFilter DUMMY_FILTER;

	}  // namespace

	class CAardvarkRpcContext;

	KJ_THREADLOCAL_PTR( CAardvarkRpcContext ) threadEzContext = nullptr;

	class CAardvarkRpcContext : public kj::Refcounted 
	{
	public:
		CAardvarkRpcContext() : ioContext( kj::setupAsyncIo() ) 
		{
			threadEzContext = this;
		}

		~CAardvarkRpcContext() noexcept( false ) {
			KJ_REQUIRE( threadEzContext == this,
				"CAardvarkClientContext destroyed from different thread than it was created." ) {
				return;
			}
			threadEzContext = nullptr;
		}

		kj::WaitScope& getWaitScope() {
			return ioContext.waitScope;
		}

		kj::AsyncIoProvider& getIoProvider() {
			return *ioContext.provider;
		}

		kj::LowLevelAsyncIoProvider& getLowLevelIoProvider() {
			return *ioContext.lowLevelProvider;
		}

		static kj::Own<CAardvarkRpcContext> getThreadLocal() {
			CAardvarkRpcContext* existing = threadEzContext;
			if ( existing != nullptr ) {
				return kj::addRef( *existing );
			}
			else {
				return kj::refcounted<CAardvarkRpcContext>();
			}
		}

	private:
		kj::AsyncIoContext ioContext;
	};


	struct CServerRpcImpl final: public kj::TaskSet::ErrorHandler
	{
		AvServerImpl *m_realServer = nullptr;
		kj::Own<CAardvarkRpcContext> context;

		struct ExportedCap 
		{
			kj::String name;
			Capability::Client cap = nullptr;

			ExportedCap( kj::StringPtr name, Capability::Client cap )
				: name( kj::heapString( name ) ), cap( cap ) {}

			ExportedCap() = default;
			ExportedCap( const ExportedCap& ) = delete;
			ExportedCap( ExportedCap&& ) = default;
			ExportedCap& operator=( const ExportedCap& ) = delete;
			ExportedCap& operator=( ExportedCap&& ) = default;
		  // Make std::map happy...
		};

		std::map<kj::StringPtr, ExportedCap> exportMap;

		class ServerBootstrapFactory : public BootstrapFactory<rpc::twoparty::VatId>
		{
		public:
			ServerBootstrapFactory( AvServerImpl *realServer )
			{
				m_realServer = realServer;
			}

			virtual Capability::Client createFor( rpc::twoparty::VatId::Reader clientId ) override
			{
				return kj::heap<AvServerPerConnection>( m_realServer, m_nextId++ );
			}

		private:
			AvServerImpl *m_realServer;
			uint32_t m_nextId = 1;
		};
		ServerBootstrapFactory bootstrapFactory;

		kj::ForkedPromise<uint> portPromise;

		kj::TaskSet tasks;

		class AvServerPerConnection final : public AvServer::Server
		{
			friend class CServerThread;
		public:
			AvServerPerConnection( AvServerImpl *realServer, uint32_t clientId )
			{
				m_realServer = realServer;
				m_clientId = clientId;
			}

			virtual ~AvServerPerConnection()
			{
				m_realServer->clientDisconnected( m_clientId );
			}

			virtual ::kj::Promise<void> createApp( CreateAppContext context ) override
			{
				return m_realServer->createApp( m_clientId, context );
			}

			virtual ::kj::Promise<void> listenForFrames( ListenForFramesContext context ) override
			{
				return m_realServer->listenForFrames( m_clientId, context );
			}

			virtual ::kj::Promise<void> getModelSource( GetModelSourceContext context ) override
			{
				return m_realServer->getModelSource( m_clientId, context );
			}

			virtual ::kj::Promise<void> updateDxgiTextureForApps( UpdateDxgiTextureForAppsContext context ) override
			{
				return m_realServer->updateDxgiTextureForApps( m_clientId, context );
			}

			virtual ::kj::Promise<void> pushPokerProximity( PushPokerProximityContext context ) override
			{
				return m_realServer->pushPokerProximity( m_clientId, context );
			}

		private:
			AvServerImpl *m_realServer;
			uint32_t m_clientId;
		};


		struct ServerContext 
		{
			kj::Own<kj::AsyncIoStream> stream;
			TwoPartyVatNetwork network;
			RpcSystem<rpc::twoparty::VatId> rpcSystem;

			//#pragma GCC diagnostic push
			//#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
			ServerContext( kj::Own<kj::AsyncIoStream>&& stream, ServerBootstrapFactory & bootstrapFactory,
							ReaderOptions readerOpts )
				: stream( kj::mv( stream ) ),
					network( *this->stream, rpc::twoparty::Side::SERVER, readerOpts ),
					rpcSystem( makeRpcServer( network, bootstrapFactory ) ) {}
			//#pragma GCC diagnostic pop
		};

		CServerRpcImpl( AvServerImpl *realServer, kj::StringPtr bindAddress, uint defaultPort,
		   ReaderOptions readerOpts )
		  : context( CAardvarkRpcContext::getThreadLocal() ), portPromise( nullptr ), tasks( *this ),
			bootstrapFactory( realServer )
		{
			m_realServer = realServer;

			auto paf = kj::newPromiseAndFulfiller<uint>();
			portPromise = paf.promise.fork();

			tasks.add( context->getIoProvider().getNetwork().parseAddress( bindAddress, defaultPort )
				.then( kj::mvCapture( paf.fulfiller,
					[this, readerOpts]( kj::Own<kj::PromiseFulfiller<uint>>&& portFulfiller,
										kj::Own<kj::NetworkAddress>&& addr ) 
			{
				auto listener = addr->listen();
				portFulfiller->fulfill( listener->getPort() );
				acceptLoop( kj::mv( listener ), readerOpts, m_realServer );
			} ) ) );
		}

		void acceptLoop( kj::Own<kj::ConnectionReceiver>&& listener, ReaderOptions readerOpts, AvServerImpl *realServer )
		{
			auto ptr = listener.get();
			tasks.add( ptr->accept().then( kj::mvCapture( kj::mv( listener ),
				[this, readerOpts, realServer]( kj::Own<kj::ConnectionReceiver>&& listener,
									kj::Own<kj::AsyncIoStream>&& connection ) 
			{
				acceptLoop( kj::mv( listener ), readerOpts, realServer );

				auto server = kj::heap<ServerContext>( kj::mv( connection ), bootstrapFactory, readerOpts );

				// Arrange to destroy the server context when all references are gone, or when the
				// EzRpcServer is destroyed (which will destroy the TaskSet).
				tasks.add( server->network.onDisconnect().attach( kj::mv( server ) ) );
			} ) ) );
		}

		void taskFailed( kj::Exception&& exception ) override 
		{
			kj::throwFatalException( kj::mv( exception ) );
		}
	};


	CServerThread::CServerThread()
	{
	}

	void CServerThread::Start()
	{
		m_thread = std::thread( [&]() { this->Run(); } );
	}

	void CServerThread::Join()
	{
		m_bStop = true;
		m_thread.join();
	}

	class CRecoverableExceptionHandler : public kj::ExceptionCallback
	{
	public:
		CRecoverableExceptionHandler( std::function<void( kj::Exception && )> fnHandler ) : m_fnHandler( fnHandler ) {}

		virtual void onRecoverableException( kj::Exception&& exception )
		{
			m_fnHandler( std::move( exception ) );
		}

	private:
		std::function<void( kj::Exception && )> m_fnHandler;
	};

	void CServerThread::Run()
	{
		AvServerImpl realServer;
		CServerRpcImpl server( &realServer, "*", 5923, ReaderOptions() );
		auto& waitScope = server.context->getWaitScope();

		// Run forever, accepting connections and handling requests.
		while ( !m_bStop )
		{
			CRecoverableExceptionHandler eh( []( kj::Exception && exception){
				if ( exception.getType() == kj::Exception::Type::DISCONNECTED 
					|| exception.getLine() == 380 && exception.getType() == kj::Exception::Type::FAILED )
				{
					// This is just a disconnect. Ignore it
					// The line 380 nonsense is because the async IO stuff in kj throws a spurious 
					// exception from WSARecv when the disconnect happens
				}
				else
				{
					throw exception;
				}
			} );

			waitScope.poll();
			realServer.runFrame();
		}

		realServer.clearApps();
	};

}

