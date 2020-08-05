import * as React from 'react';
import { AvApiInterface } from './api_interface';


export const k_GadgetListInterface = "api-gadgetlist@1";

export enum GadgetListEventType
{
	AddFavorite = "add_favorite",
	StartGadget = "start_gadget",
}

export enum GadgetListResult
{
	Success = 0,
	AlreadyAdded = 1,
	UserDeniedRequest = 2,
	NotConnected = 3,
	GadgetStartFailed = 4,
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

