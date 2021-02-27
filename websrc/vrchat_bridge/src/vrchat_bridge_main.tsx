import { AvGadget, renderAardvarkRoot } from '@aardvarkxr/aardvark-react';
import { Av, LogMonitorEventType, LogMonitorType, MessageType, MsgLogMonitorEvent, MsgRequestLogMonitor } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';

const k_TestPanelInterface = "test_panel_counter@1";

interface VRChatBridgeState
{
}

function setCookie( name: string, value?: string, days?: number ) 
{
    var expires = "";
	if ( days ) 
	{
        var date = new Date();
        date.setTime( date.getTime() + ( days * 24 * 60 * 60 * 1000) );
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + ( value || "" )  + expires;
}

function getCookie( name: string ) 
{
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
		while ( c.charAt(0)==' ' ) 
			c = c.substring(1,c.length);
		if ( c.indexOf(nameEQ) == 0 ) 
			return c.substring( nameEQ.length,c.length );
    }
    return null;
}

function eraseCookie( name: string ) 
{   
    document.cookie = name+'=; Max-Age=-99999999;';  
}

class VRChatBridge extends React.Component< {}, VRChatBridgeState >
{
	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
		};

		if( getCookie( "VRChat_Singleton" ) == "TRUE" )
		{
			console.log( "There's already an instance of the bridge running. Closing." );
			window.close();
			return;
		}
		else
		{
			setCookie( "VRChat_Singleton", "TRUE" );
			window.addEventListener( "unload", 
				() =>
				{
					eraseCookie( "VRChat_Singleton" );
				} );
		}

		let m: MsgRequestLogMonitor =
		{
			monitorType: LogMonitorType.VRChat,
		};

		AvGadget.instance().sendMessage( MessageType.RequestLogMonitor, m );
		AvGadget.instance().registerMessageHandler( MessageType.LogMonitorEvent, this.onLogMonitorEvent );

		Av().registerSceneApplicationNotification( this.onUpdateSceneApp );
	}

	@bind
	private onLogMonitorEvent( m: MsgLogMonitorEvent )
	{
		switch( m.eventType )
		{
			case LogMonitorEventType.SetFriendlyName:
			{
				console.log( "SetFriendlyName", m.friendlyName );
			}
			break;

			case LogMonitorEventType.TransitionToRoom:
			{
				console.log( "TransitionToRoom", m.roomId );
			}
			break;

			case LogMonitorEventType.UpdateHeadPose:
			{
				console.log( "UpdateHeadPose", m.roomFromHead, m.roomFromHeadTime );
			}
			break;
		}
	}

	@bind
	private onUpdateSceneApp()
	{
		if( Av().getCurrentSceneApplication()?.id != "steam.app.438100" )
		{
			console.log( "Closing because VR Chat is no longer running" );
		}
	}

	
	public render()
	{
		return (
			<></>
		);
	}

}


renderAardvarkRoot( "root", <VRChatBridge/> );
