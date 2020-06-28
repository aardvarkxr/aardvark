import { AardvarkManifest, MessageType, MsgInstallGadget } from '@aardvarkxr/aardvark-shared';
import axios from 'axios';
import * as React from 'react';
import './Landing.css';
import { CUtilityEndpoint } from './aardvark_endpoint';
import { GetGadgetUrlFromWindow } from './aardvark_gadget';
import { findGltfIconFullUrl } from './aardvark_gadget_seed';
import bind from 'bind-decorator';

export interface DefaultLandingProps
{

}

interface DefaultLandingState
{
	manifest?: AardvarkManifest;
	error?: string;
	connected: boolean;
}

export class DefaultLanding extends React.Component<DefaultLandingProps, DefaultLandingState >
{
	private endpoint: CUtilityEndpoint;
	private gadgetUrl: string;

	constructor( props: any )
	{
		super( props );

		this.state = { connected: false };

		this.endpoint = new CUtilityEndpoint( null, this.onConnectToServer );
		this.gadgetUrl = GetGadgetUrlFromWindow();

		axios.get( this.gadgetUrl + "/manifest.webmanifest" )
		.then( ( response ) =>
		{
			this.setState( { manifest: response.data as AardvarkManifest } );
		} )
		.catch( ( reason: any ) =>
		{
			this.setState( { error: "Failed to load manifest" } );
		} );	

	}

	@bind
	private onConnectToServer() 
	{
		this.setState( { connected: true } );
	}

	@bind
	private onStartAardvark()
	{
		window.open( "aardvark://start" );
	}

	@bind
	private onAddFavorite()
	{
		let m: MsgInstallGadget =
		{
			gadgetUri: this.gadgetUrl,
		}
		this.endpoint.sendMessage( MessageType.InstallGadget, m );
	}

	private renderFavorite()
	{
		if( !this.state.connected )
		{
			return <div className="LandingButton"
				onClick={ this.onStartAardvark }>Start Aardvark</div>;
		}

		return <div className="LandingButton" onClick={ this.onAddFavorite }>Add to Favorites</div>;
	}


	render()
	{
		if( this.state.error )
		{
			return <div>Error: { this.state.error }</div>
		}
		else if( !this.state.manifest )
		{
			return <div>Loading...</div>
		}
		else
		{
			let icon: JSX.Element = null;
			let iconUrl = findGltfIconFullUrl( this.gadgetUrl, this.state.manifest );
	
			if( iconUrl )
			{
				icon = <iframe src={ "https://aardvarkxr.github.io/icon_model_viewer/index.html#" + iconUrl }
					frameBorder={ 0 } style={ { "border": "none", margin: 0, overflow: "hidden" } }></iframe>
			}
	
			return <div style={ { display: "flex", flexDirection: "column" }}>
				<div style={ { fontSize: "large", fontStyle: "bold" }}>{ this.state.manifest.name }</div>
				{ this.state.manifest.description && 
					<div >{ this.state.manifest.description }</div> }
				{ this.renderFavorite() }
				{ icon }
			</div>
		}	
	}
}

