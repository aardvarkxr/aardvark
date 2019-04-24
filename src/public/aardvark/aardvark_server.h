#pragma once

#include "aardvark.capnp.h"

#include <vector>
#include <memory>
#include <thread>

namespace aardvark
{
	class CAardvarkApp;
	class CAardvarkModelSource;

	class AvServerImpl final : public AvServer::Server 
	{
		friend class CServerThread;
	public:
		virtual ::kj::Promise<void> createApp( CreateAppContext context ) override;
		virtual ::kj::Promise<void> getNextVisualFrame( GetNextVisualFrameContext context ) override;
		virtual ::kj::Promise<void> getModelSource( GetModelSourceContext context ) override;

		void removeApp( CAardvarkApp *pApp );
	protected:
		void clearApps();

	private:
		std::unordered_map< std::string, CAardvarkModelSource *> m_mapModelSources;
		std::vector< CAardvarkApp * > m_vecApps;
		uint64_t m_unNextFrame = 1;
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
