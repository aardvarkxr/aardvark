#pragma once

#include "aardvark/aardvark_apps.h"
#include "aardvark_handle.h"

#include <string>
#include <vector>
namespace aardvark
{
	class CAardvarkGadget;

	class CAardvarkApp : public CAardvarkHandleBaseTyped < AppHandle_t >
	{
	public:
		CAardvarkApp( uint32_t unRawHandle ) : CAardvarkHandleBaseTyped < AppHandle_t >( unRawHandle ) {}

		bool Init( const char *pchName );

		void AddGadget( std::shared_ptr<CAardvarkGadget> gadget );
		void RemoveGadget( std::shared_ptr<CAardvarkGadget> gadget );

	private:
		std::string m_sName;
		std::vector< std::shared_ptr<CAardvarkGadget> > m_gadgets;
	};

}

