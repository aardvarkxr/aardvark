#include "uri_request_handler.h"
#include <include/cef_urlrequest.h>
#include <tools/pathtools.h>

class CUriRequestImpl
{
public:
	void addPendingRequest( CUriRequest *request );
	void removePendingRequest( CUriRequest *request );

	void startPendingRequests();
private:
	std::mutex m_requestMutex;
	std::vector< CUriRequest *> m_pendingRequests;
	std::vector< CUriRequest * > m_runningRequests;
};


class CCefUriRequest : public CefURLRequestClient
{
public:
	CCefUriRequest( CUriRequest *uriRequest ) { m_uriRequest = uriRequest; }

	void OnRequestComplete( CefRefPtr<CefURLRequest> request ) override;
	void OnUploadProgress( CefRefPtr<CefURLRequest> request,
		int64 current,
		int64 total ) override;
	void OnDownloadProgress( CefRefPtr<CefURLRequest> request,
		int64 current,
		int64 total ) override;
	void OnDownloadData( CefRefPtr<CefURLRequest> request,
		const void* data,
		size_t data_length ) override;
	bool GetAuthCredentials( bool isProxy,
		const CefString& host,
		int port,
		const CefString& realm,
		const CefString& scheme,
		CefRefPtr<CefAuthCallback> callback ) override;

private:
	CUriRequest *m_uriRequest = nullptr;
	IMPLEMENT_REFCOUNTING( CCefUriRequest );
};

std::unique_ptr< CUriRequestImpl > CUriRequestHandler::sm_impl;
std::mutex CUriRequestHandler::sm_implMutex;

class CUriRequest
{
public:
	CUriRequest( kj::PromiseFulfiller<CUriRequestHandler::Result_t> & fulfiller,
		CUriRequestHandler *handler, const std::string & uri );

	~CUriRequest();

	void start();

	void fulfill()
	{
		m_fulfiller.fulfill( std::move( m_result ) );
	}

	void onRequestComplete( bool success ) ;
	void onDownloadData( const void* data, size_t data_length ) ;

private:
	kj::PromiseFulfiller<CUriRequestHandler::Result_t> & m_fulfiller;
	CUriRequestHandler *m_handler;
	CefRefPtr< CCefUriRequest > m_cefRequestClient;
	CefRefPtr<CefURLRequest> m_cefRequest;

	enum class EState
	{
		Pending,
		Running,
		Complete,
	};
	EState m_state = EState::Pending;

	CUriRequestHandler::Result_t m_result;
	std::string m_uri;
};


void CUriRequestImpl::addPendingRequest( CUriRequest *request )
{
	std::scoped_lock<std::mutex> autolock( m_requestMutex );
	m_pendingRequests.push_back( request );
}

void CUriRequestImpl::removePendingRequest( CUriRequest *request )
{
	std::scoped_lock<std::mutex> autolock( m_requestMutex );
	auto i = std::find( m_pendingRequests.begin(), m_pendingRequests.end(), request );
	if ( i != m_pendingRequests.end() )
	{
		m_pendingRequests.erase( i );
	}
}

void CUriRequestImpl::startPendingRequests()
{
	std::vector< CUriRequest * > pendingRequests;

	{
		std::scoped_lock<std::mutex> autolock( m_requestMutex );

		pendingRequests = std::move( m_pendingRequests );
	}

	for ( auto request : pendingRequests )
	{
		request->start();
	}
}


CUriRequest::CUriRequest( kj::PromiseFulfiller< CUriRequestHandler::Result_t > & fulfiller, CUriRequestHandler *handler, const std::string & uri )
	: m_fulfiller( fulfiller ), m_handler( handler ), m_uri( uri ) 
{
	CUriRequestHandler::sm_impl->addPendingRequest( this );
}

CUriRequest::~CUriRequest()
{
	switch ( m_state )
	{
	case EState::Complete:
		if ( m_handler )
		{
			m_handler->removeCompletedRequest( this );
		}
		break;

	case EState::Pending:
		if ( CUriRequestHandler::sm_impl )
		{
			CUriRequestHandler::sm_impl->removePendingRequest( this );
		}
		break;
	}
}

void CUriRequest::onRequestComplete( bool success )
{
	m_result.success = success;
	m_state = EState::Complete;
	m_handler->addCompletedRequest( this );
}


void CUriRequest::onDownloadData( const void* data, size_t data_length )
{
	m_result.data.insert( m_result.data.end(), (const uint8_t *)data, (const uint8_t *)data + data_length );
}

void CUriRequest::start()
{
	m_cefRequestClient = new CCefUriRequest( this );

	CefRefPtr<CefRequest> request = CefRequest::Create();
	request->SetURL( tools::filterUriForInstall( m_uri ) );
	request->SetMethod( "GET" );

	m_cefRequest = CefURLRequest::Create( request, m_cefRequestClient, nullptr );
	m_state = EState::Running;
}


void CCefUriRequest::OnRequestComplete( CefRefPtr<CefURLRequest> request )
{
	m_uriRequest->onRequestComplete( request->GetRequestError() == ERR_NONE );
}

void CCefUriRequest::OnUploadProgress( CefRefPtr<CefURLRequest> request,
	int64 current,
	int64 total )
{

}


void CCefUriRequest::OnDownloadProgress( CefRefPtr<CefURLRequest> request,
	int64 current,
	int64 total )
{

}


void CCefUriRequest::OnDownloadData( CefRefPtr<CefURLRequest> request,
	const void* data,
	size_t data_length )
{
	m_uriRequest->onDownloadData( data, data_length );
}


bool CCefUriRequest::GetAuthCredentials( bool isProxy,
	const CefString& host,
	int port,
	const CefString& realm,
	const CefString& scheme,
	CefRefPtr<CefAuthCallback> callback )
{
	return false;
}




// called from threads that make requests
CUriRequestHandler::CUriRequestHandler()
{
	std::scoped_lock<std::mutex> autolock( sm_implMutex );
	if ( !sm_impl )
	{
		sm_impl = std::make_unique<CUriRequestImpl>();
	}
}

CUriRequestHandler::~CUriRequestHandler()
{
}

void CUriRequestHandler::processResults()
{
	std::vector< CUriRequest *> completedRequests;

	{
		std::scoped_lock<std::mutex> autolock( m_mutex );
		completedRequests = std::move( m_completedRequests );
	}

	for ( auto req : completedRequests )
	{
		req->fulfill();
	}
}

kj::Promise<CUriRequestHandler::Result_t> CUriRequestHandler::requestUri( const std::string & uri )
{
	return kj::newAdaptedPromise< CUriRequestHandler::Result_t, CUriRequest >( this, uri );
}


// called from a CEF thread that services requests
void CUriRequestHandler::doCefRequestWork()
{
	sm_impl->startPendingRequests();
}


void CUriRequestHandler::addCompletedRequest( CUriRequest *request )
{
	std::scoped_lock<std::mutex> autolock( m_mutex );
	m_completedRequests.push_back( request );
}

void CUriRequestHandler::removeCompletedRequest( CUriRequest *request )
{
	std::scoped_lock<std::mutex> autolock( m_mutex );
	auto i = std::find( m_completedRequests.begin(), m_completedRequests.end(), request );
	if ( i != m_completedRequests.end() )
	{
		m_completedRequests.erase( i );
	}
}

