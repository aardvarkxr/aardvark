#include "aardvark/aardvark_client.h"

#include "aardvark_poker_handler.h"
#include "aardvark_panel_handler.h"

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


	AvPokerHandler::Client CAardvarkClient::getPokerHandler()
	{
		if ( m_pokerHandler == nullptr )
		{
			auto server = kj::heap<AvPokerHandlerImpl>();
			AvPokerHandlerImpl & serverRef = *server;
			m_pokerHandlerImpl = &serverRef;
			AvPokerHandler::Client client = kj::mv( server );
			m_pokerHandler = client;
		}

		return *::kj::_::readMaybe( m_pokerHandler );
	}

	AvPanelHandler::Client CAardvarkClient::getPanelHandler()
	{
		if ( m_panelHandler == nullptr )
		{
			auto server = kj::heap<AvPanelHandlerImpl>();
			AvPanelHandlerImpl & serverRef = *server;
			m_panelHandlerImpl = &serverRef;
			AvPanelHandler::Client client = kj::mv( server );
			m_panelHandler = client;
		}

		return *::kj::_::readMaybe( m_panelHandler );
	}

}

