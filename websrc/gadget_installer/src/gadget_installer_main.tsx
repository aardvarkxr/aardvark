import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CUtilityEndpoint } from '@aardvarkxr/aardvark-react';
import bind from 'bind-decorator';
import { MessageType, EndpointAddr, MsgInstallGadget } from '@aardvarkxr/aardvark-shared';


class GadgetInstaller extends React.Component< {}, {} >
{
	private m_connection: CUtilityEndpoint;
	private m_inputRef = React.createRef<HTMLInputElement>();

	constructor( props: any )
	{
		super( props );

		this.m_connection = new CUtilityEndpoint( this.onUnhandledMessage );
	}
	
	@bind onUnhandledMessage( type: MessageType, message: any, sender: EndpointAddr )
	{
		console.log( "received unhandled message", type, message, sender );
	}

	@bind private onInstall()
	{
		let gadgetUri = this.m_inputRef.current.value;

		let m: MsgInstallGadget =
		{
			gadgetUri
		}

		this.m_connection.sendMessage( MessageType.InstallGadget, m );
	}

	public render()
	{
		return <div className="GadgetInstaller">
			<input type="text" className="InstallerUrl" ref={ this.m_inputRef }/>
			<div className="InstallButton" onClick={ this.onInstall }>Install</div>
		</div>;
	}
}

ReactDOM.render( <GadgetInstaller/>, document.getElementById( "root" ) );
