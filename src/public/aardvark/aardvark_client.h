#pragma once

#include <capnp/ez-rpc.h>
#include "aardvark.capnp.h"

namespace aardvark
{
	class AvPokerProcesserImpl;
	class AvPanelProcessorImpl;

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

		AvPokerProcesser::Client getPokerProcessor();
		AvPanelProcessor::Client getPanelProcessor();

		kj::Maybe< AvPokerProcesserImpl *> getPokerProcessorServer() { return m_pokerProcessorImpl; }
		kj::Maybe< AvPanelProcessorImpl *> getPanelProcessorServer() { return m_panelProcessorImpl; }
	private:
		virtual void taskFailed( kj::Exception&& exception ) override;

		AvServer::Client getMain();
		capnp::Capability::Client getMainInternal();

		kj::Own<CAardvarkClientContext> m_context;
		kj::Maybe< kj::ForkedPromise<void> > m_setupPromise;
		kj::Maybe<kj::Own<ClientContext>> m_clientContext;

		kj::Own< AvServer::Client > m_pMainInterface;
		kj::Own< kj::TaskSet > m_tasks;

		kj::Maybe< AvPanelProcessor::Client > m_panelProcessor = nullptr;
		kj::Maybe< AvPanelProcessorImpl * > m_panelProcessorImpl = nullptr;
		kj::Maybe< AvPokerProcesser::Client > m_pokerProcessor = nullptr;
		kj::Maybe< AvPokerProcesserImpl * > m_pokerProcessorImpl = nullptr;
	};
}