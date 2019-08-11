import { CAardvarkEndpoint, MessageHandler, OpenHandler } from './aardvark_endpoint';
import { MsgSetEndpointType, MessageType, EndpointType } from './aardvark_protocol';
import bind from 'bind-decorator';


export class CGadgetEndpoint extends CAardvarkEndpoint
{
	private gadgetUri: string;
	private m_openHandler: OpenHandler;

	constructor( gadgetUri: string, openHandler: OpenHandler, defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, defaultHandler );
		this.m_openHandler = openHandler;
		this.gadgetUri = gadgetUri;
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Gadget,
			gadgetUri: this.gadgetUri,
		}

		this.sendMessage( [], MessageType.SetEndpointType, msgSetEndpointType );

		if( this.m_openHandler )
		{
			this.m_openHandler();
		}
	}


}

