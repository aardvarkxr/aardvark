#include "aardvark/aardvark_server.h"
#include "aardvark_app_impl.h"

#include <capnp/ez-rpc.h>

namespace aardvark
{

	::kj::Promise<void> AvServerImpl::createApp( CreateAppContext context )
	{
		auto server = kj::heap<CAardvarkApp>( context.getParams().getName() );
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
			waitScope.poll();

		}

		pServer->clearApps();
	};

}

