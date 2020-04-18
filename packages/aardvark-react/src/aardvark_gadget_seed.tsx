import * as React from 'react';
import { AvBaseNodeProps } from './aardvark_base_node';
import bind from 'bind-decorator';
import { HighlightType, GrabResponse, AvGrabbable } from './aardvark_grabbable';
import { AvTransform } from './aardvark_transform';
import { AvSphereHandle } from './aardvark_handles';
import { AvModel } from './aardvark_model';
import { EndpointAddr, AvGrabEvent, AardvarkManifest, endpointAddrIsEmpty, AvVector, g_builtinModelError } from '@aardvarkxr/aardvark-shared';
import { AvGadget } from './aardvark_gadget';
import isUrl from 'is-url';


interface AvGadgetSeedProps extends AvBaseNodeProps
{
	/** The URI of the gadget for which this node is a seed. 
	 * Gadget URIs are everything up to but not including the 
	 * "/manifest.webmanifest" part of the path.
	*/
	uri: string;

	/** Size in meters of the gadget seed. This will control both
	 * the active area and the scale of the gadget's model, at least
	 * for gadget models that are centered around the origin.
	 * 
	 * @default 0.1
	 */
	radius?: number;
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
	private m_manifest: AardvarkManifest = null;

	constructor( props:any )
	{
		super( props );

		this.state = { grabbableHighlight: HighlightType.None };

		AvGadget.instance().loadManifest( this.props.uri )
		.then( ( manifest: AardvarkManifest ) =>
		{
			this.m_manifest = manifest;
			this.forceUpdate();
		})
	}

	@bind 
	public async onGrabRequest( grabRequest: AvGrabEvent ): Promise< GrabResponse >
	{
		let res = await AvGadget.instance().startGadget( this.props.uri, "" );

		if( !res.success )
		{
			throw new Error( "startGadget failed" );
		}

		if( endpointAddrIsEmpty( res.mainGrabbableGlobalId ) )
		{
			// If the gadget started, but there's no main grabbable,
			// we want to reject the grab so that the seed itself doesn't end
			// up being grabbed. The gadget has started, so the user got what 
			// they wanted.
			let response: GrabResponse =
			{
				allowed: false,
			};
			return response;
		}
		else
		{
			// Otherwise, start the grab with the newly created grabbable in the 
			// newly started gadget
			let response: GrabResponse =
			{
				allowed: true,
				proxyGrabbableGlobalId: res.mainGrabbableGlobalId,
				proxyHandleGlobalId: res.mainHandleId,
			};
			return response;
		}
	}

	@bind public onGadgetStarted( success: boolean, mainGrabbableId: string ) 
	{
		console.log( "main grabbable id was "+ mainGrabbableId );
	}
	
	@bind public onHighlightGrabbable( highlight: HighlightType )
	{
		this.setState( { grabbableHighlight: highlight } );
	}

	private findIconOfType( mimeType: string )
	{
		if( !this.m_manifest.icons )
			return null;

		for( let icon of this.m_manifest.icons )
		{
			if( icon.type.toLowerCase() == mimeType.toLowerCase() )
			{
				return icon;
			}
		}

		return null;
	}


	private renderGadgetIcon( radius: number )
	{
		let model = this.findIconOfType( "model/gltf-binary" );
		if( model )
		{
			let modelUrl = isUrl( model.src ) ? model.src : this.props.uri + "/" + model.src;

			return <AvModel uri= { model.src } scaleToFit={ { x: radius, y: radius, z: radius } }/>;
		}

		return <AvModel uri= { g_builtinModelError } scaleToFit={ { x: radius, y: radius, z: radius } }/>;
	}

	public render()
	{
		if( !this.m_manifest )
			return null;

		let radius = this.props.radius ? this.props.radius : 0.1;

		let scale:number;
		switch( this.state.grabbableHighlight )
		{
			case HighlightType.None:
				scale = 1.0;
				break;

			default:
				scale = 1.25;
				break;
		}
		return (
			<AvGrabbable updateHighlight={ this.onHighlightGrabbable }
				onGrabRequest={ this.onGrabRequest }>
				<AvSphereHandle radius={ radius } />
				
				<AvTransform uniformScale={ scale }>
					{ this.renderGadgetIcon( radius ) }
				</AvTransform>
			</AvGrabbable>
		);
	}


}
