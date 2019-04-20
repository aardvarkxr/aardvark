#include "aardvark/aardvark_server.h"
#include "aardvark_app_impl.h"
#include "framestructs.h"

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

		if ( !visuals.vecModels.empty() )
		{
			auto bldModels = bldFrame.initModels( (uint32_t)visuals.vecModels.size() );

			for ( uint32_t unIndex = 0; unIndex < visuals.vecModels.size(); unIndex++ )
			{
				AvModel_t & in = visuals.vecModels[unIndex];
				auto out = bldFrame.getModels()[unIndex];
				out.setSource( kj::heap< AvModelSource::Server >() );
				CopyTransform( out.getTransform(), in.transform );
			}
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

