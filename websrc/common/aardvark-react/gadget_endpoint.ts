import { CAardvarkEndpoint, MessageHandler, OpenHandler } from './aardvark_endpoint';
import { MsgSetEndpointType, MessageType, EndpointType } from './aardvark_protocol';
import bind from 'bind-decorator';


export class CGadgetEndpoint extends CAardvarkEndpoint
{
	private m_gadgetUri: string;
	private m_initialHook: string;
	private m_openHandler: OpenHandler;

	constructor( gadgetUri: string, initialHook: string, openHandler: OpenHandler, defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, defaultHandler );
		this.m_openHandler = openHandler;
		this.m_gadgetUri = gadgetUri;
		this.m_initialHook = initialHook;
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Gadget,
			gadgetUri: this.m_gadgetUri,
			initialHook: this.m_initialHook,
		}

		this.sendMessage( MessageType.SetEndpointType, msgSetEndpointType );

		if( this.m_openHandler )
		{
			this.m_openHandler();
		}
	}


}

