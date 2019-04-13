#include "aardvark/aardvark_apps.h"
#include "aardvark_handle.h"
#include "aardvark_app_impl.h"

namespace aardvark
{
	EAardvarkError avCreateApp( const char *appName, AppHandle_t *pHandle )
	{
		if ( !appName || *pHandle )
		{
			return AardvarkError_InvalidParam;
		}

		auto app = CAardvarkHandleManager::Instance()->CreateHandle< CAardvarkApp >();
		if ( !app )
			return AardvarkError_InternalError;

		if ( !app->Init( appName ) )
		{
			CAardvarkHandleManager::Instance()->DestroyHandle( app );
			return AardvarkError_InternalError;
		}
		*pHandle = app->GetPublicHandle();

		return aardvark::AardvarkError_None;
	}

	EAardvarkError avDestroyApp( AppHandle_t hApp )
	{
		if ( !hApp )
			return AardvarkError_InvalidParam;

		auto app = CAardvarkHandleManager::Instance()->Find<CAardvarkApp>( hApp );
		if ( app )
		{
			if ( CAardvarkHandleManager::Instance()->DestroyHandle( app ) )
			{
				return AardvarkError_None;
			}
			else
			{
				return AardvarkError_InvalidParam;
			}
		}
		else
		{
			return AardvarkError_InvalidParam;
		}
	}

}
