#pragma once

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
	void requestUri( const std::string & uri, std::function<void (Result_t & result ) > fn );

	// called from a CEF thread that services requests
	void doCefRequestWork();


protected:
	void addCompletedRequest( CUriRequest * request );

	std::mutex m_mutex;

	std::vector< std::unique_ptr< CUriRequest > > m_completedRequests;

	static std::unique_ptr< CUriRequestImpl > sm_impl;
	static std::mutex sm_implMutex;
};

