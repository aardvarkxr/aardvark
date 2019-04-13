#include "aardvark/aardvark.h"
#include "aardvark_handle.h"
#include "aardvark_app_impl.h"
#include "aardvark_gadget_impl.h"

namespace aardvark
{
	EAardvarkError avCreateGadget( AppHandle_t hApp, const char *gadgetName, GadgetHandle_t *phGadget )
	{
		if ( !gadgetName || !phGadget )
			return AardvarkError_InvalidParam;

		std::shared_ptr<CAardvarkApp> app = CAardvarkHandleManager::Instance()->Find<CAardvarkApp, AppHandle_t>( hApp );
		if ( !app )
		{
			return AardvarkError_InternalError;
		}

		auto gadget = CAardvarkHandleManager::Instance()->CreateHandle<CAardvarkGadget>();
		if ( !gadget->Init( gadgetName, hApp ) )
		{
			CAardvarkHandleManager::Instance()->DestroyHandle( gadget );
			return AardvarkError_InternalError;
		}

		app->AddGadget( gadget );
		*phGadget = gadget->GetPublicHandle();
		return AardvarkError_None;
	}

	EAardvarkError avDestroyGadget( GadgetHandle_t hGadget )
	{
		if ( !hGadget )
			return AardvarkError_InvalidParam;

		auto gadget = CAardvarkHandleManager::Instance()->Find<CAardvarkGadget>( hGadget );
		if ( !gadget )
		{
			return AardvarkError_InvalidParam;
		}

		auto app = CAardvarkHandleManager::Instance()->Find<CAardvarkApp>( gadget->GetAppHandle() );
		if ( !app )
		{
			return AardvarkError_InternalError;
		}

		app->RemoveGadget( gadget );

		if ( CAardvarkHandleManager::Instance()->DestroyHandle( gadget ) )
		{
			return AardvarkError_None;
		}
		else
		{
			return AardvarkError_InternalError;
		}
	}
}
