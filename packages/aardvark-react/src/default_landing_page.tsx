import { AardvarkManifest, MessageType, MsgInstallGadget } from '@aardvarkxr/aardvark-shared';
import axios from 'axios';
import * as React from 'react';
import './Landing.css';
import { CUtilityEndpoint } from './aardvark_endpoint';
import { GetGadgetUrlFromWindow } from './aardvark_gadget';
import { findGltfIconFullUrl } from './aardvark_gadget_seed';
import bind from 'bind-decorator';
import { AvGadgetList, GadgetListResult } from './api_gadgetlist';

export interface DefaultLandingProps
{

}

interface DefaultLandingState
{
	manifest?: AardvarkManifest;
	error?: string;
	addResult?: string;
	connected: boolean;
}

export class DefaultLanding extends React.Component<DefaultLandingProps, DefaultLandingState >
{
	private endpoint: CUtilityEndpoint;
	private gadgetUrl: string;
	private gadgetList = React.createRef<AvGadgetList>();

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
	private async onAddFavorite()
	{
		try
		{
			let promResult = this.gadgetList.current.addFavorite( this.gadgetUrl );
			let result = await promResult;
			let text: string;

			switch( result )
			{
				case GadgetListResult.Success:
					text = "Added";
					break;

				case GadgetListResult.NotConnected:
					text = "Not connected";
					break;
				

				case GadgetListResult.AlreadyAdded:
					text = "Gadget was already a favorite";
					break;

				case GadgetListResult.UserDeniedRequest:
					text = "User denied request";
					break;

				default:
					text = "Unknown result " + result;
					break;
			}

			this.setState( { addResult: text } );
		}
		catch( e )
		{
			this.setState( { addResult: String( e ) } );
		}

	}

	private renderFavorite()
	{
		if( !this.state.connected )
		{
			return <div className="LandingButton"
				onClick={ this.onStartAardvark }>Start Aardvark</div>;
		}

		return <>
			<div className="LandingButton" onClick={ this.onAddFavorite }>Add to Favorites</div>
			{ this.state.addResult &&
				<div style={ { fontSize: "medium" }}>{ this.state.addResult }</div> }
			</>;
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
	
			return <>
				<AvGadgetList ref={ this.gadgetList }/>
				<div style={ { display: "flex", flexDirection: "column" }}>
					<div style={ { fontSize: "large", fontStyle: "bold" }}>{ this.state.manifest.name }</div>
					{ this.state.manifest.description && 
						<div >{ this.state.manifest.description }</div> }
					{ this.renderFavorite() }
					{ icon }
				</div>
			</>
		}	
	}
}

