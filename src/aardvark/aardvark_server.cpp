#include "aardvark/aardvark_server.h"
#include "aardvark_app_impl.h"
#include "aardvark_model_source_impl.h"
#include "framestructs.h"
#include "tools/filetools.h"
#include "tools/pathtools.h"

#include <capnp/ez-rpc.h>

namespace aardvark
{

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

	::kj::Promise<void> AvServerImpl::getNextVisualFrame( GetNextVisualFrameContext context )
	{
		AvVisuals_t visuals;
		for ( auto iApp : m_vecApps )
		{
			iApp->gatherVisuals( visuals );
		}

		AvVisualFrame::Builder bldFrame( context.getResults().initFrame() );
		bldFrame.setId( m_unNextFrame++ );

		if ( !visuals.vecGadgets.empty() )
		{
			auto bldModels = bldFrame.initGadgets( (uint32_t)visuals.vecGadgets.size() );

			for ( uint32_t unIndex = 0; unIndex < visuals.vecGadgets.size(); unIndex++ )
			{
				AvVisualGadget_t & inGadget = visuals.vecGadgets[unIndex];
				auto outGadget = bldFrame.getGadgets()[unIndex];

				CopyTransform( outGadget.getTransform(), inGadget.transform );

				if ( !inGadget.vecModels.empty() )
				{
					outGadget.initModels( (uint32_t)inGadget.vecModels.size() );
					for ( uint32_t unIndex = 0; unIndex < inGadget.vecModels.size(); unIndex++ )
					{
						AvModel_t & inModel = inGadget.vecModels[unIndex];
						auto out = outGadget.getModels()[unIndex];

						CAardvarkModelSource *pSource = findOrCreateSource( inModel.sSourceUri );
						if ( !pSource )
							continue;

						out.setSource( pSource->getClient() );
						CopyTransform( out.getTransform(), inModel.transform );
					}
				}
			}
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
		}

		pServer->clearApps();
	};

}

