#pragma once

#include <capnp/ez-rpc.h>
#include "aardvark.capnp.h"

namespace aardvark
{

	class CAardvarkClient: public kj::TaskSet::ErrorHandler
	{
	public:
		CAardvarkClient();
		~CAardvarkClient();

		void Start();
		void Stop();

		AvServer::Client & Server() { return *m_pMainInterface; }
		kj::WaitScope & WaitScope() { return m_pClient->getWaitScope(); }
		void addToTasks( kj::Promise<void> && promRequest );
	private:
		virtual void taskFailed( kj::Exception&& exception ) override;

		capnp::EzRpcClient *m_pClient = nullptr;
		kj::Own< AvServer::Client > m_pMainInterface;
		kj::Own< kj::TaskSet > m_tasks;
	};
}