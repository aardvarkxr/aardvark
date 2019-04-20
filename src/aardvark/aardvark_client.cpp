#include "aardvark/aardvark_client.h"


namespace aardvark
{
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
			delete m_pClient;
			m_pClient = nullptr;
			m_pMainInterface = nullptr;
		}
	}

}

