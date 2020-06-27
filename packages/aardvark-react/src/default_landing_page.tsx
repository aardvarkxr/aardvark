import { AardvarkManifest, MessageType, MsgInstallGadget } from '@aardvarkxr/aardvark-shared';
import axios from 'axios';
import * as React from 'react';
import './Landing.css';
import { CUtilityEndpoint } from './aardvark_endpoint';
import { GetGadgetUrlFromWindow } from './aardvark_gadget';
import { findGltfIconFullUrl } from './aardvark_gadget_seed';

export interface DefaultLandingProps
{

}

export function DefaultLanding( props: DefaultLandingProps )
{
	const [ manifest, setManifest ] = React.useState<AardvarkManifest>( null );
	const [ error, setError ] = React.useState<string>( null );
	const [ endpoint, setEndpoint ] = React.useState<CUtilityEndpoint>( null );
	const [ connected, setConnected ] = React.useState( false );

	let gadgetUrl = GetGadgetUrlFromWindow();

	let onConnectToServer = () => 
	{
		setConnected( true );
	}

	let onStartAardvark = () =>
	{
		window.open( "aardvark://start" );
	}

	let onAddFavorite = () =>
	{
		let m: MsgInstallGadget =
		{
			gadgetUri: gadgetUrl,
		}
		endpoint.sendMessage( MessageType.InstallGadget, m );
	}

	if( !error && !manifest )
	{
		axios.get( gadgetUrl + "/manifest.webmanifest" )
		.then( ( response ) =>
		{
			setManifest( response.data as AardvarkManifest );
			setEndpoint( new CUtilityEndpoint( null, onConnectToServer ) );
		} )
		.catch( ( reason: any ) =>
		{
			setError( "Failed to load manifest" );
		} );	
	}

	let renderFavorite = () =>
	{
		if( !connected )
		{
			return <div className="LandingButton"
				onClick={ onStartAardvark }>Start Aardvark</div>;
		}

		return <div className="LandingButton" onClick={ onAddFavorite }>Add to Favorites</div>;
	}

	if( error )
	{
		return <div>Error: { error }</div>
	}
	else if( !manifest )
	{
		return <div>Loading...</div>
	}
	else
	{
		let icon: JSX.Element = null;
		let iconUrl = findGltfIconFullUrl( gadgetUrl, manifest );

		if( iconUrl )
		{
			icon = <iframe src={ "https://aardvarkxr.github.io/icon_model_viewer/index.html#" + iconUrl }
				frameBorder={ 0 } style={ { "border": "none", margin: 0, overflow: "hidden" } }></iframe>
		}

		return <div style={ { display: "flex", flexDirection: "column" }}>
			<div style={ { fontSize: "large", fontStyle: "bold" }}>{ manifest.name }</div>
			{ manifest.description && 
				<div >{ manifest.description }</div> }
			{ renderFavorite() }
			{ icon }
		</div>
	}
}

