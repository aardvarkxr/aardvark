#include "aardvark/aardvark_client.h"


namespace aardvark
{
	CAardvarkClient::CAardvarkClient() 
	{
		m_tasks = kj::heap<kj::TaskSet>( *this );
	}

	CAardvarkClient::~CAardvarkClient()
	{
		Stop();
	}

	void CAardvarkClient::Start()
	{
		if ( !m_pClient )
		{
			m_pClient = new capnp::EzRpcClient( "localhost:5923" );
			m_pMainInterface = kj::heap< AvServer::Client>( m_pClient->getMain<AvServer>() );
		}
	}

	void CAardvarkClient::Stop()
	{
		if ( m_pClient )
		{
			m_pMainInterface = nullptr;
			delete m_pClient;
			m_pClient = nullptr;
		}
	}

	void CAardvarkClient::addToTasks( kj::Promise<void> && promRequest )
	{
		m_tasks->add( std::move( promRequest ) );
	}

	void CAardvarkClient::taskFailed( kj::Exception&& exception )
	{
		// we don't really care about failed requests on our task set
	}

}

