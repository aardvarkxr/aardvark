import * as React from 'react';
import { AvBaseNodeProps } from './aardvark_base_node';
import { AvGrabEvent, Av, AvGadgetManifest } from 'common/aardvark';
import bind from 'bind-decorator';
import { HighlightType, GrabResponse, AvGrabbable } from './aardvark_grabbable';
import { AvTransform } from './aardvark_transform';
import { AvSphereHandle } from './aardvark_handles';
import { AvModel } from './aardvark_model';


interface AvGadgetSeedProps extends AvBaseNodeProps
{
	uri: string;
}

interface AvGadgetSeedState
{
	grabbableHighlight: HighlightType;
}

export class AvGadgetSeed extends React.Component< AvGadgetSeedProps, AvGadgetSeedState >
{
	private m_manifest: AvGadgetManifest = null;

	constructor( props:any )
	{
		super( props );

		this.state = { grabbableHighlight: HighlightType.None };

		Av().getGadgetManifest( this.props.uri, this.onManifestLoaded );
	}

	@bind public onManifestLoaded( manifest: AvGadgetManifest )
	{
		if( manifest == null )
		{
			console.log( "failed to load gadget manifest " + this.props.uri );
		}
		else
		{
			this.m_manifest = manifest;
			this.forceUpdate();
		}
	}

	@bind public onGrabRequest( grabRequest: AvGrabEvent ): Promise< GrabResponse >
	{
		return new Promise<GrabResponse>( ( resolve, reject ) =>
		{
			Av().startGadget( this.props.uri, "",
			( success: boolean, mainGrabbableId: string ) =>
			{
				if( success )
				{
					let response: GrabResponse =
					{
						allowed: true,
						proxyGrabbableGlobalId: mainGrabbableId,
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
					<AvModel uri= { this.m_manifest.modelUri }/>
				</AvTransform>
			</AvGrabbable>
		);
	}


}
