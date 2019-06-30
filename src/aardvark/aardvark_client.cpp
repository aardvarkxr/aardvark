#include "aardvark/aardvark_client.h"

#include "aardvark_poker_processor.h"
#include "aardvark_panel_processor.h"
#include "aardvark_grabber_processor.h"
#include "aardvark_grabbable_processor.h"

#include <capnp/rpc-twoparty.h>
#include <capnp/rpc.capnp.h>
#include <kj/async-io.h>
#include <kj/threadlocal.h>
#include <kj/debug.h>

namespace aardvark
{
	KJ_THREADLOCAL_PTR( CAardvarkClientContext ) threadEzContext = nullptr;

	class CAardvarkClientContext : public kj::Refcounted {
	public:
		CAardvarkClientContext() : ioContext( kj::setupAsyncIo() ) {
			threadEzContext = this;
		}

		~CAardvarkClientContext() noexcept( false ) {
			KJ_REQUIRE( threadEzContext == this,
				"CAardvarkClientContext destroyed from different thread than it was created." ) {
				return;
			}
			threadEzContext = nullptr;
		}

		kj::WaitScope& getWaitScope() {
			return ioContext.waitScope;
		}

		kj::AsyncIoProvider& getIoProvider() {
			return *ioContext.provider;
		}

		kj::LowLevelAsyncIoProvider& getLowLevelIoProvider() {
			return *ioContext.lowLevelProvider;
		}

		static kj::Own<CAardvarkClientContext> getThreadLocal() {
			CAardvarkClientContext* existing = threadEzContext;
			if ( existing != nullptr ) {
				return kj::addRef( *existing );
			}
			else {
				return kj::refcounted<CAardvarkClientContext>();
			}
		}

	private:
		kj::AsyncIoContext ioContext;
	};

	using namespace capnp;

	struct ClientContext {
		kj::Own<kj::AsyncIoStream> stream;
		TwoPartyVatNetwork network;
		RpcSystem<rpc::twoparty::VatId> rpcSystem;

		ClientContext( kj::Own<kj::AsyncIoStream>&& stream, ReaderOptions readerOpts )
			: stream( kj::mv( stream ) ),
			network( *this->stream, rpc::twoparty::Side::CLIENT, readerOpts ),
			rpcSystem( makeRpcClient( network ) ) {}

		Capability::Client getMain() {
			capnp::word scratch[4];
			memset( scratch, 0, sizeof( scratch ) );
			MallocMessageBuilder message( scratch );
			auto hostId = message.getRoot<rpc::twoparty::VatId>();
			hostId.setSide( rpc::twoparty::Side::SERVER );
			return rpcSystem.bootstrap( hostId );
		}

		Capability::Client restore( kj::StringPtr name ) {
			word scratch[64];
			memset( scratch, 0, sizeof( scratch ) );
			MallocMessageBuilder message( scratch );

			auto hostIdOrphan = message.getOrphanage().newOrphan<rpc::twoparty::VatId>();
			auto hostId = hostIdOrphan.get();
			hostId.setSide( rpc::twoparty::Side::SERVER );

			auto objectId = message.getRoot<AnyPointer>();
			objectId.setAs<Text>( name );
//#pragma GCC diagnostic push
//#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
			return rpcSystem.restore( hostId, objectId );
//#pragma GCC diagnostic pop
		}
	};


	CAardvarkClient::CAardvarkClient() 
	{
	}

	CAardvarkClient::~CAardvarkClient()
	{
		Stop();
	}

	kj::Promise<kj::Own<kj::AsyncIoStream>> connectAttach( kj::Own<kj::NetworkAddress>&& addr ) {
		return addr->connect().attach( kj::mv( addr ) );
	}

	AvServer::Client CAardvarkClient::getMain()
	{
		return getMainInternal().castAs<AvServer>();
	}

	Capability::Client CAardvarkClient::getMainInternal()
	{
		KJ_IF_MAYBE( client, m_clientContext ) 
		{
			return client->get()->getMain();
		}
		else 
		{
			KJ_IF_MAYBE( setupPromise, m_setupPromise )
			{
				return setupPromise->addBranch().then( [this]()
				{
					return KJ_ASSERT_NONNULL( m_clientContext )->getMain();
				} );
			}
			else
			{
				return nullptr;
			}
		}
	}


	void CAardvarkClient::Start()
	{
		m_context = std::move( CAardvarkClientContext::getThreadLocal() );
			
		m_setupPromise = m_context->getIoProvider().getNetwork().parseAddress( "localhost:5923" )
			.then( []( kj::Own<kj::NetworkAddress>&& addr ) 
			{
				return connectAttach( kj::mv( addr ) );
			} )
			.then( [this ]( kj::Own<kj::AsyncIoStream>&& stream ) {
				m_clientContext = kj::heap<ClientContext>( kj::mv( stream ), ReaderOptions());
			} ).fork(); 

		m_pMainInterface = kj::heap< AvServer::Client >( getMain() );

		m_tasks = kj::heap<kj::TaskSet>( *this );
	}

	void CAardvarkClient::Stop()
	{
		m_panelProcessor = nullptr;
		m_panelProcessorImpl = nullptr;
		m_pokerProcessor = nullptr;
		m_pokerProcessorImpl = nullptr;
		m_setupPromise = nullptr;
		m_pMainInterface = nullptr;
		m_clientContext = nullptr;
		m_tasks = nullptr;
		m_context = nullptr;
	}

	void CAardvarkClient::addToTasks( kj::Promise<void> && promRequest )
	{
		m_tasks->add( std::move( promRequest ) );
	}

	void CAardvarkClient::taskFailed( kj::Exception&& exception )
	{
		// we don't really care about failed requests on our task set
	}

	kj::WaitScope & CAardvarkClient::WaitScope() 
	{ 
		return m_context->getWaitScope(); 
	}

	AvPokerProcessor::Client CAardvarkClient::getPokerProcessor()
	{
		if ( m_pokerProcessor == nullptr )
		{
			auto server = kj::heap<AvPokerProcessorImpl>();
			AvPokerProcessorImpl & serverRef = *server;
			m_pokerProcessorImpl = &serverRef;
			AvPokerProcessor::Client client = kj::mv( server );
			m_pokerProcessor = client;
		}

		return *::kj::_::readMaybe( m_pokerProcessor );
	}

	AvPanelProcessor::Client CAardvarkClient::getPanelProcessor()
	{
		if ( m_panelProcessor == nullptr )
		{
			auto server = kj::heap<AvPanelProcessorImpl>();
			AvPanelProcessorImpl & serverRef = *server;
			m_panelProcessorImpl = &serverRef;
			AvPanelProcessor::Client client = kj::mv( server );
			m_panelProcessor = client;
		}

		return *::kj::_::readMaybe( m_panelProcessor );
	}

	AvGrabberProcessor::Client CAardvarkClient::getGrabberProcessor()
	{
		if ( m_grabberProcessor == nullptr )
		{
			auto server = kj::heap<AvGrabberProcessorImpl>();
			AvGrabberProcessorImpl & serverRef = *server;
			m_grabberProcessorImpl = &serverRef;
			AvGrabberProcessor::Client client = kj::mv( server );
			m_grabberProcessor = client;
		}

		return *::kj::_::readMaybe( m_grabberProcessor );
	}

	AvGrabbableProcessor::Client CAardvarkClient::getGrabbableProcessor()
	{
		if ( m_grabbableProcessor == nullptr )
		{
			auto server = kj::heap<AvGrabbableProcessorImpl>();
			AvGrabbableProcessorImpl & serverRef = *server;
			m_grabbableProcessorImpl = &serverRef;
			AvGrabbableProcessor::Client client = kj::mv( server );
			m_grabbableProcessor = client;
		}

		return *::kj::_::readMaybe( m_grabbableProcessor );
	}

}

