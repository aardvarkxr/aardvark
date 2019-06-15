#include "aardvark/aardvark_server.h"
#include "aardvark_app_impl.h"
#include "aardvark_model_source_impl.h"
#include "framestructs.h"
#include "tools/filetools.h"
#include "tools/pathtools.h"
#include <map>
#include <capnp/ez-rpc.h>

namespace aardvark
{

	void AvServerImpl::taskFailed( kj::Exception&& exception )
	{
		// we don't really care about failed requests on our task set
	}

	::kj::Promise<void> AvServerImpl::createApp( CreateAppContext context )
	{
		auto server = kj::heap<CAardvarkApp>( context.getParams().getName(), this );
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

	::kj::Promise<void> AvServerImpl::listenForFrames( ListenForFramesContext context )
	{
		AvServer::Server::ListenForFramesParams::Reader params = context.getParams();
		m_frameListeners.push_back( context.getParams().getListener() );
		markFrameDirty();
		return kj::READY_NOW;
	}

	void AvServerImpl::sendFrameToAllListeners()
	{
		for ( auto & listener : m_frameListeners )
		{
			sendFrameToListener( listener );
		}
	}

	void AvServerImpl::sendFrameToListener( AvFrameListener::Client listener )
	{
		std::map<std::string, AvSharedTextureInfo::Reader> textureHandles;
		AvVisuals_t visuals;
		for ( auto app : m_vecApps )
		{
			app->gatherVisuals( visuals );

			if ( app->hasSharedTextureInfo() )
			{
				textureHandles.insert_or_assign( app->getName(), app->getSharedTextureInfo() );
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

			auto bldTextures = bldFrame.initAppTextures( (uint32_t)textureHandles.size() );
			uint32_t unIndex = 0;
			for ( auto handle : textureHandles )
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

	::kj::Promise<void> AvServerImpl::updateDxgiTextureForApps( UpdateDxgiTextureForAppsContext context )
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

	::kj::Promise<void> AvServerImpl::pushPokerProximity( PushPokerProximityContext context )
	{
		uint64_t pokerGlobalId = context.getParams().getPokerId();
		KJ_IF_MAYBE( handler, findPokerHandler( pokerGlobalId ) )
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

	::kj::Promise<void> AvServerImpl::getModelSource( GetModelSourceContext context )
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

	kj::Maybe < AvPokerHandler::Client > AvServerImpl::findPokerHandler( uint64_t pokerGlobalId )
	{
		uint32_t appId = (uint32_t)( pokerGlobalId >> 32 );
		uint32_t pokerLocalId = (uint32_t) ( 0xFFFFFFFF & pokerGlobalId );
		KJ_IF_MAYBE( app, findApp( appId ) )
		{
			return app->findPokerHandler( pokerLocalId );
		}
		else
		{
			return nullptr;
		}
	}

	kj::Maybe < AvPanelHandler::Client > AvServerImpl::findPanelHandler( uint64_t panelGlobalId )
	{
		uint32_t appId = (uint32_t)( panelGlobalId >> 32 );
		uint32_t panelLocalId = (uint32_t)( 0xFFFFFFFF & panelGlobalId );
		KJ_IF_MAYBE( app, findApp( appId ) )
		{
			return app->findPanelHandler( panelLocalId );
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
		kj::Own<AvServerImpl> serverObj = kj::heap<AvServerImpl>();
		AvServerImpl *pServer = serverObj;
		AvServer::Client capability = kj::mv( serverObj );
		capnp::EzRpcServer server( capability, "*", 5923 );
		auto& waitScope = server.getWaitScope();

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
			pServer->runFrame();
		}

		pServer->clearApps();
	};

}

