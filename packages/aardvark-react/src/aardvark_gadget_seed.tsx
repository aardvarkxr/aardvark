import * as React from 'react';
import { AvBaseNodeProps } from './aardvark_base_node';
import bind from 'bind-decorator';
import { HighlightType, GrabResponse, AvGrabbable } from './aardvark_grabbable';
import { AvTransform } from './aardvark_transform';
import { AvSphereHandle } from './aardvark_handles';
import { AvModel } from './aardvark_model';
import { EndpointAddr, AvGrabEvent, AvGadgetManifest } from './aardvark_protocol';
import { AvGadget } from './aardvark_gadget';


interface AvGadgetSeedProps extends AvBaseNodeProps
{
	/** The URI of the gadget for which this node is a seed. 
	 * Gadget URIs are everything up to but not including the 
	 * "/gadget_manifest.json" part of the path.
	*/
	uri: string;
}

interface AvGadgetSeedState
{
	grabbableHighlight: HighlightType;
}

/** A grabbable control that causes the grabber to grab a new
 * instance of a gadget instead of the control itself. 
 */
export class AvGadgetSeed extends React.Component< AvGadgetSeedProps, AvGadgetSeedState >
{
	private m_manifest: AvGadgetManifest = null;

	constructor( props:any )
	{
		super( props );

		this.state = { grabbableHighlight: HighlightType.None };

		AvGadget.instance().loadManifest( this.props.uri )
		.then( ( manifest: AvGadgetManifest ) =>
		{
			this.m_manifest = manifest;
			this.forceUpdate();
		})
	}

	@bind public onGrabRequest( grabRequest: AvGrabEvent ): Promise< GrabResponse >
	{
		return new Promise<GrabResponse>( ( resolve, reject ) =>
		{
			AvGadget.instance().startGadget( this.props.uri, "", 
				( success: boolean, mainGrabbableId: EndpointAddr, mainHandleId: EndpointAddr ):void =>
				{
					if( success )
					{
						let response: GrabResponse =
						{
							allowed: true,
							proxyGrabbableGlobalId: mainGrabbableId,
							proxyHandleGlobalId: mainHandleId,
						};
						resolve( response );
					}
					else
					{
						reject( "startGadget failed");
					}
				});
		} );
	}

	@bind public onGadgetStarted( success: boolean, mainGrabbableId: string ) 
	{
		console.log( "main grabbable id was "+ mainGrabbableId );
	}
	
	@bind public onHighlightGrabbable( highlight: HighlightType )
	{
		this.setState( { grabbableHighlight: highlight } );
	}

	public render()
	{
		if( !this.m_manifest )
			return null;

		let scale:number;
		switch( this.state.grabbableHighlight )
		{
			case HighlightType.None:
				scale = 0.2;
				break;

			default:
				scale = 0.25;
				break;
		}
		return (
			<AvGrabbable updateHighlight={ this.onHighlightGrabbable }
				onGrabRequest={ this.onGrabRequest }>
				<AvSphereHandle radius={0.1} />
				
				<AvTransform uniformScale={ scale }>
					<AvModel uri= { this.m_manifest.model }/>
				</AvTransform>
			</AvGrabbable>
		);
	}


}
