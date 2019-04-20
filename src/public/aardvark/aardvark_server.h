#pragma once

#include "aardvark.capnp.h"

#include <vector>
#include <memory>
#include <thread>

namespace aardvark
{
	class CAardvarkApp;

	class AvServerImpl final : public AvServer::Server 
	{
		friend class CServerThread;
	public:
		virtual ::kj::Promise<void> createApp( CreateAppContext context ) override;

		void removeApp( CAardvarkApp *pApp );
	protected:
		void clearApps();

	private:
		std::vector< CAardvarkApp * > m_vecApps;
	};


	class CServerThread
	{
	public:
		CServerThread();

		void Start();
		void Join();

	private:
		void Run();

		std::thread m_thread;
		bool m_bStop = false;
	};
};
