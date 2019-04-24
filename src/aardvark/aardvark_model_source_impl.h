#pragma once

#include "aardvark.capnp.h"

#include <string>
#include <vector>

namespace aardvark
{

	class CAardvarkModelSource final : public AvModelSource::Server
	{
	public:
		CAardvarkModelSource( const std::string & sUri, const std::vector<char> && vecBlob );

		virtual ::kj::Promise<void> uri( UriContext context ) override;
		virtual ::kj::Promise<void> data( DataContext context ) override;

		void setClient( AvModelSource::Client & client ) { m_vecClients.push_back( AvModelSource::Client( client ) ); }
		AvModelSource::Client  getClient() { return m_vecClients.front(); }
	protected:

	private:
		std::vector< AvModelSource::Client > m_vecClients;
		std::string m_sUri;
		std::vector<char> m_vecBlob;
	};

}

