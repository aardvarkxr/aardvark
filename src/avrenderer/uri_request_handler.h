#pragma once
#include <kj/async.h>

#include <vector>
#include <memory>
#include <mutex>

class CUriRequestHandler
{
	friend class CUriRequestImpl;
	friend class CUriRequest;
public:
	struct Result_t
	{
		std::vector< uint8_t > data;
		bool success = false;
	};

	CUriRequestHandler();
	~CUriRequestHandler();

	// called from threads that make requests
	void processResults();
	kj::Promise<Result_t> requestUri( const std::string & uri );

	// called from a CEF thread that services requests
	void doCefRequestWork();


protected:
	void addCompletedRequest( CUriRequest *request );
	void removeCompletedRequest( CUriRequest *request );

	std::mutex m_mutex;

	std::vector< CUriRequest *> m_completedRequests;

	static std::unique_ptr< CUriRequestImpl > sm_impl;
	static std::mutex sm_implMutex;
};

