#pragma once

#include <capnp/ez-rpc.h>
#include "aardvark.capnp.h"

namespace aardvark
{
	class AvPokerHandlerImpl;
	class AvPanelHandlerImpl;

	class CAardvarkClientContext;
	struct ClientContext;

	class CAardvarkClient: public kj::TaskSet::ErrorHandler
	{
	public:
		CAardvarkClient();
		~CAardvarkClient();

		void Start();
		void Stop();

		AvServer::Client & Server() { return *m_pMainInterface; }
		kj::WaitScope & WaitScope();
		void addToTasks( kj::Promise<void> && promRequest );

		template <typename TRequest, typename TResult>
		void addRequestToTasks( capnp::Request<TRequest, TResult> && req )
		{
			auto prom = req.send().then(
				[]( TResult::Reader && results )
			{
			}
			);
			addToTasks( std::move( prom ) );
		}

		AvPokerHandler::Client getPokerHandler();
		AvPanelHandler::Client getPanelHandler();

		kj::Maybe< AvPokerHandlerImpl *> getPokerHandlerServer() { return m_pokerHandlerImpl; }
		kj::Maybe< AvPanelHandlerImpl *> getPanelHandlerServer() { return m_panelHandlerImpl; }
	private:
		virtual void taskFailed( kj::Exception&& exception ) override;

		AvServer::Client getMain();
		capnp::Capability::Client getMainInternal();

		kj::Own<CAardvarkClientContext> m_context;
		kj::Maybe< kj::ForkedPromise<void> > m_setupPromise;
		kj::Maybe<kj::Own<ClientContext>> m_clientContext;

		kj::Own< AvServer::Client > m_pMainInterface;
		kj::Own< kj::TaskSet > m_tasks;

		kj::Maybe< AvPanelHandler::Client > m_panelHandler = nullptr;
		kj::Maybe< AvPanelHandlerImpl * > m_panelHandlerImpl = nullptr;
		kj::Maybe< AvPokerHandler::Client > m_pokerHandler = nullptr;
		kj::Maybe< AvPokerHandlerImpl * > m_pokerHandlerImpl = nullptr;
	};
}