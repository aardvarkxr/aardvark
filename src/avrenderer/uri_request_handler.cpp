#include "uri_request_handler.h"
#include <include/cef_urlrequest.h>
#include <tools/pathtools.h>
#include <fstream>
#include <streambuf>
#include <iterator>

class CUriRequestImpl
{
public:
	void addPendingRequest( std::unique_ptr< CUriRequest > && request );

	void startPendingRequests();
	std::unique_ptr< CUriRequest> removeRunningRequest( CUriRequest *  request );
private:
	std::mutex m_requestMutex;
	std::vector< std::unique_ptr< CUriRequest > > m_pendingRequests;
	std::vector< std::unique_ptr< CUriRequest > > m_runningRequests;
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
	CUriRequest( CUriRequestHandler *handler, const std::string & uri, 
		std::function<void( CUriRequestHandler::Result_t & result ) > callback );

	~CUriRequest();

	void start();


	void onRequestComplete( bool success ) ;
	void onDownloadData( const void* data, size_t data_length ) ;
	bool isReadyToComplete() const { return m_state == EState::ReadyToComplete; }
	void markCompleted() { onRequestComplete( this->m_result.success );  }
	void fulfill() { m_callback( m_result ); }
private:
	CUriRequestHandler *m_handler;
	CefRefPtr< CCefUriRequest > m_cefRequestClient;
	CefRefPtr<CefURLRequest> m_cefRequest;

	enum class EState
	{
		Pending,
		Running,
		ReadyToComplete,
		Complete,
	};
	EState m_state = EState::Pending;

	CUriRequestHandler::Result_t m_result;
	std::string m_uri;
	std::function<void( CUriRequestHandler::Result_t & result ) > m_callback;
};


void CUriRequestImpl::addPendingRequest( std::unique_ptr< CUriRequest > && request )
{
	std::scoped_lock<std::mutex> autolock( m_requestMutex );
	m_pendingRequests.push_back( std::move( request ) );
}

void CUriRequestImpl::startPendingRequests()
{
	std::vector< std::unique_ptr< CUriRequest > > pendingRequests;

	{
		std::scoped_lock<std::mutex> autolock( m_requestMutex );

		pendingRequests = std::move( m_pendingRequests );
	}

	std::vector< CUriRequest * > completedRequests;
	for ( auto & request : pendingRequests )
	{
		request->start();
		if ( request->isReadyToComplete() )
		{
			completedRequests.push_back( request.get() );
		}
	}

	{
		std::scoped_lock<std::mutex> autolock( m_requestMutex );

		for ( auto & req : pendingRequests )
		{
			m_runningRequests.push_back( std::move( req ) );
		}
	}

	for ( auto completedRequest : completedRequests )
	{
		completedRequest->markCompleted();
	}
}

std::unique_ptr< CUriRequest> CUriRequestImpl::removeRunningRequest( CUriRequest *  request )
{
	std::unique_ptr<CUriRequest> res;

	{
		std::scoped_lock<std::mutex> autolock( m_requestMutex );
		for ( auto i = m_runningRequests.begin(); i != m_runningRequests.end(); i++ )
		{
			if ( i->get() == request )
			{
				res = std::move( *i );
				m_runningRequests.erase( i );
				break;
			}
		}
	}

	return res;
}


CUriRequest::CUriRequest( CUriRequestHandler *handler, const std::string & uri, 
	std::function<void( CUriRequestHandler::Result_t & result )> fn )
	: m_handler( handler ), m_callback( fn )
{
	m_uri = tools::filterUriForInstall( uri );
}

CUriRequest::~CUriRequest()
{
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
	if ( tools::IsFileUri( m_uri ) )
	{
		try
		{
			std::filesystem::path filePath = tools::FileUriToPath( m_uri );

			std::ifstream f( filePath, std::ios::binary );
			f.unsetf( std::ios::skipws );

			f.seekg( 0, std::ios::end );
			m_result.data.reserve( f.tellg() );
			f.seekg( 0, std::ios::beg );

			m_result.data.assign( ( std::istream_iterator<uint8_t>( f ) ),
				std::istream_iterator<uint8_t>() );
			m_result.success = true;
		}
		catch ( ... )
		{
			m_result.success = false;
		}
		m_state = EState::ReadyToComplete;
	}
	else
	{
		m_cefRequestClient = new CCefUriRequest( this );

		CefRefPtr<CefRequest> request = CefRequest::Create();
		request->SetURL( tools::filterUriForInstall( m_uri ) );
		request->SetMethod( "GET" );

		m_cefRequest = CefURLRequest::Create( request, m_cefRequestClient, nullptr );

		m_state = EState::Running;
	}
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
	std::vector< std::unique_ptr<CUriRequest> > completedRequests;

	{
		std::scoped_lock<std::mutex> autolock( m_mutex );
		completedRequests = std::move( m_completedRequests );
	}

	for ( auto & req : completedRequests )
	{
		req->fulfill();
	}
}

void CUriRequestHandler::requestUri( const std::string & uri, std::function<void( Result_t & result ) > fn )
{
	CUriRequestHandler::sm_impl->addPendingRequest( std::make_unique<CUriRequest> ( this, uri, fn ) );
}


// called from a CEF thread that services requests
void CUriRequestHandler::doCefRequestWork()
{
	sm_impl->startPendingRequests();
}


void CUriRequestHandler::addCompletedRequest( CUriRequest *  request )
{
	std::unique_ptr<CUriRequest> req = sm_impl->removeRunningRequest( request );
	std::scoped_lock<std::mutex> autolock( m_mutex );
	m_completedRequests.push_back( std::move( req ) );
}

