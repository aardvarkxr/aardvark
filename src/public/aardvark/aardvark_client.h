#pragma once

#include <capnp/ez-rpc.h>
#include "aardvark.capnp.h"

namespace aardvark
{
	class AvPokerProcessorImpl;
	class AvPanelProcessorImpl;
	class AvGrabberProcessorImpl;
	class AvGrabbableProcessorImpl;

	class CAardvarkClientContext;
	struct ClientContext;

	class CAardvarkClient: public kj::TaskSet::ErrorHandler
	{
	public:
		CAardvarkClient();
		~CAardvarkClient();

		void Start();
		void Stop();
		bool isRunning() const;

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

		AvPokerProcessor::Client getPokerProcessor();
		AvPanelProcessor::Client getPanelProcessor();
		AvGrabberProcessor::Client getGrabberProcessor();
		AvGrabbableProcessor::Client getGrabbableProcessor();

		kj::Maybe< AvPokerProcessorImpl *> getPokerProcessorServer() { return m_pokerProcessorImpl; }
		kj::Maybe< AvPanelProcessorImpl *> getPanelProcessorServer() { return m_panelProcessorImpl; }
		kj::Maybe< AvGrabberProcessorImpl *> getGrabberProcessorServer() { return m_grabberProcessorImpl; }
		kj::Maybe< AvGrabbableProcessorImpl *> getGrabbableProcessorServer() { return m_grabbableProcessorImpl; }
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
		kj::Maybe< AvPokerProcessor::Client > m_pokerProcessor = nullptr;
		kj::Maybe< AvPokerProcessorImpl * > m_pokerProcessorImpl = nullptr;
		kj::Maybe< AvGrabbableProcessor::Client > m_grabbableProcessor = nullptr;
		kj::Maybe< AvGrabbableProcessorImpl * > m_grabbableProcessorImpl = nullptr;
		kj::Maybe< AvGrabberProcessor::Client > m_grabberProcessor = nullptr;
		kj::Maybe< AvGrabberProcessorImpl * > m_grabberProcessorImpl = nullptr;
	};
}