#include "aardvark/aardvark_client.h"

#include "aardvark_poker_handler.h"
#include "aardvark_panel_handler.h"

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
		m_panelHandler = nullptr;
		m_panelHandlerImpl = nullptr;
		m_pokerHandler = nullptr;
		m_pokerHandlerImpl = nullptr;
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

	AvPokerHandler::Client CAardvarkClient::getPokerHandler()
	{
		if ( m_pokerHandler == nullptr )
		{
			auto server = kj::heap<AvPokerHandlerImpl>();
			AvPokerHandlerImpl & serverRef = *server;
			m_pokerHandlerImpl = &serverRef;
			AvPokerHandler::Client client = kj::mv( server );
			m_pokerHandler = client;
		}

		return *::kj::_::readMaybe( m_pokerHandler );
	}

	AvPanelHandler::Client CAardvarkClient::getPanelHandler()
	{
		if ( m_panelHandler == nullptr )
		{
			auto server = kj::heap<AvPanelHandlerImpl>();
			AvPanelHandlerImpl & serverRef = *server;
			m_panelHandlerImpl = &serverRef;
			AvPanelHandler::Client client = kj::mv( server );
			m_panelHandler = client;
		}

		return *::kj::_::readMaybe( m_panelHandler );
	}

}

