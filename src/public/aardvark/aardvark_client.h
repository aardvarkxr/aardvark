#pragma once

#include <capnp/ez-rpc.h>
#include "aardvark.capnp.h"

namespace aardvark
{

	class CAardvarkClient
	{
	public:
		CAardvarkClient() {}
		~CAardvarkClient();

		void Start();
		void Stop();

		AvServer::Client & Server() { return *m_pMainInterface; }
		kj::WaitScope & WaitScope() { return m_pClient->getWaitScope(); }
	private:
		capnp::EzRpcClient *m_pClient = nullptr;
		kj::Own< AvServer::Client > m_pMainInterface;
	};
}