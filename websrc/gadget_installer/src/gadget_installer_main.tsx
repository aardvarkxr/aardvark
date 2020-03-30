import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CUtilityEndpoint } from '@aardvarkxr/aardvark-react';
import bind from 'bind-decorator';
import { MessageType, MsgInstallGadget, Envelope } from '@aardvarkxr/aardvark-shared';


class GadgetInstaller extends React.Component< {}, {} >
{
	private m_connection: CUtilityEndpoint;
	private m_inputRef = React.createRef<HTMLInputElement>();

	constructor( props: any )
	{
		super( props );

		this.m_connection = new CUtilityEndpoint( this.onUnhandledMessage );
	}
	
	@bind async onUnhandledMessage( message: any, env: Envelope )
	{
		console.log( "received unhandled message", env.type, message, env.sender );
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
