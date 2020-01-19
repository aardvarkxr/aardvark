import * as React from 'react';
import { AvTransform } from './aardvark_transform';
import { AvModel } from './aardvark_model';
import { EndpointAddr, computeEndpointFieldUri } from '@aardvarkxr/aardvark-shared';
import { AvParentTransform } from './aardvark_parent_transform';
import { AvHeadFacingTransform } from './aardvark_head_facing_transform';


interface DropIndicatorProps
{
	/** The endpoint address of the grabbable being dropped. */
	grabbable: EndpointAddr;

	/** The endpoint address of the hook where it would be dropped, or returned to,
	 *  if any. */
	hook?: EndpointAddr;

	/** Specifies whether the grabbable is already tethered to the provided hook. */
	attached: boolean;

	/** Specified whether the grabbable will allow itself to be dropped onto
	 * the stage.
	 */
	allowStageDrop: boolean;
}


/** A hook for attaching grabbables to that uses a standard plus-in-circle icon and is made visible
 * whenever its parent hand is in edit mode.
 */
export class AvDropIndicator extends React.Component< DropIndicatorProps >
{
	constructor( props: any )
	{
		super( props );
	}

	public render()
	{
		return (
			<AvParentTransform parentId={ this.props.grabbable }>
			<AvHeadFacingTransform>
				<AvTransform rotateX={ 90 } translateY={ -0.1 }>
					<AvModel
						uri={ computeEndpointFieldUri( this.props.hook, "propModelUri" ) }
						scaleToFit={ { x: 0.05, y: 0.05, z: 0.05 } }/>
				</AvTransform>
			</AvHeadFacingTransform>
		</AvParentTransform> );
	}
}

