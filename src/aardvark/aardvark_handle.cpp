#include "aardvark_handle.h"

namespace aardvark
{
	static CAardvarkHandleManager *g_pHandleManager = nullptr;

	CAardvarkHandleManager *CAardvarkHandleManager::Instance()
	{
		if ( !g_pHandleManager )
		{
			g_pHandleManager = new CAardvarkHandleManager;
		}
		return g_pHandleManager;
	}


	bool CAardvarkHandleManager::DestroyHandle( AardvarkHandleSharedPtr_t obj )
	{
		auto i = m_handles.find( obj->GetRawHandle() );
		if ( i != m_handles.end() )
		{
			m_handles.erase( i );
			return true;
		}

		return false;
	}

	AardvarkHandleSharedPtr_t CAardvarkHandleManager::Find( uint32_t unRawHandle )
	{
		auto i = m_handles.find( unRawHandle );
		if ( i != m_handles.end() )
		{
			return i->second;
		}
		else
		{
			return nullptr;
		}
	}

	uint32_t CAardvarkHandleManager::GetNextRawHandle()
	{
		return m_nextRawHandle++;
	}

}
