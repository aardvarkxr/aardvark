import * as React from 'react';
import { AvApiInterface } from './api_interface';
import { AvGadgetSettings } from '@aardvarkxr/aardvark-shared';


export const k_GadgetListInterface = "api-gadgetlist@1";

export enum GadgetListEventType
{
	AddFavorite = "add_favorite",
	RemoveFavorite = "remove_favorite",
	SetAutoLaunch = "set_autolaunch",
	RemoveAutoLaunch = "remove_autolaunch",
	GetSettingsForGadget = "get_gadget_settings",
	StartGadget = "start_gadget",
}

export enum GadgetListResult
{
	Success = 0,
	AlreadyAdded = 1,
	UserDeniedRequest = 2,
	NotConnected = 3,
	GadgetStartFailed = 4,
	NoSuchFavorite = 5,
	NoSuchAutoLaunch = 6,
	AlreadyStarted = 7,
	NotImplemented = 8
}

/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvGadgetList extends React.Component
{
	private apiInterface = React.createRef<AvApiInterface>();

	public addFavorite( gadgetUrl: string )
	{
		if( !this.apiInterface.current || !this.apiInterface.current.connected )
			return GadgetListResult.NotConnected;

		return this.apiInterface.current.sendRequestAndWaitForResponse<GadgetListResult>( 
			GadgetListEventType.AddFavorite, true, gadgetUrl );
	}

	public removeFavorite( gadgetUrl: string )
	{
		if( !this.apiInterface.current || !this.apiInterface.current.connected )
			return GadgetListResult.NotConnected;

		return this.apiInterface.current.sendRequestAndWaitForResponse<GadgetListResult>( 
			GadgetListEventType.RemoveFavorite, true, gadgetUrl );
	}

	public setAutoLaunch( gadgetUrl: string )
	{
		if( !this.apiInterface.current || !this.apiInterface.current.connected )
			return GadgetListResult.NotConnected;

		return this.apiInterface.current.sendRequestAndWaitForResponse<GadgetListResult>( 
			GadgetListEventType.SetAutoLaunch, true, gadgetUrl );
	}

	public removeAutoLaunch( gadgetUrl: string )
	{
		if( !this.apiInterface.current || !this.apiInterface.current.connected )
			return GadgetListResult.NotConnected;

		return this.apiInterface.current.sendRequestAndWaitForResponse<GadgetListResult>( 
			GadgetListEventType.RemoveAutoLaunch, true, gadgetUrl );
	}

	public getSettingsForGadget( gadgetUrl: string )
	{
		if( !this.apiInterface.current || !this.apiInterface.current.connected )
			return null;

		return this.apiInterface.current.sendRequestAndWaitForResponse<AvGadgetSettings>( 
			GadgetListEventType.GetSettingsForGadget, true, gadgetUrl );
	}

	public startGadget( gadgetUrl: string )
	{
		if( !this.apiInterface.current || !this.apiInterface.current.connected )
			return GadgetListResult.NotConnected;

		return this.apiInterface.current.sendRequestAndWaitForResponse<GadgetListResult>( 
			GadgetListEventType.StartGadget, true, gadgetUrl );
	}

	public render()
	{
		return <AvApiInterface ref={ this.apiInterface } apiName={ k_GadgetListInterface }/>
	}
}

