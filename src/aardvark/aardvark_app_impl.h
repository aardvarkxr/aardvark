#pragma once

#include "aardvark/aardvark_apps.h"
#include "aardvark_handle.h"
#include "aardvark.capnp.h"

#include <string>
#include <vector>
namespace aardvark
{
	class CAardvarkGadget;
	class AvServerImpl;

	class CAardvarkApp : public AvApp::Server
	{
	public:
		CAardvarkApp( const std::string & sName, AvServerImpl *pParentServer );
		~CAardvarkApp() {}

		bool Init( const char *pchName );

		void AddGadget( std::shared_ptr<CAardvarkGadget> gadget );
		void RemoveGadget( std::shared_ptr<CAardvarkGadget> gadget );

		void AddClient( AvApp::Client & client ) { m_vecClients.push_back( AvApp::Client( client ) ); }
		void clearClients() { m_vecClients.clear(); }

		virtual ::kj::Promise<void> destroy( DestroyContext context ) override;
		virtual ::kj::Promise<void> name( NameContext context ) override;
	private:
		std::string m_sName;
		std::vector< AvApp::Client > m_vecClients;
		std::vector< std::shared_ptr<CAardvarkGadget> > m_gadgets;
		AvServerImpl *m_pParentServer = nullptr;
	};

	typedef std::shared_ptr< CAardvarkApp > AardvarkAppPtr_t;
}

