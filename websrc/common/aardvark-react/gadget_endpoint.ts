import { CAardvarkEndpoint, MessageHandler, OpenHandler } from './aardvark_endpoint';
import { MsgSetEndpointType, MessageType, EndpointType } from './aardvark_protocol';
import bind from 'bind-decorator';


export class CGadgetEndpoint extends CAardvarkEndpoint
{
	private m_gadgetUri: string;
	private m_initialHook: string;

	constructor( gadgetUri: string, initialHook: string, openHandler: OpenHandler, defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, openHandler, defaultHandler );
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
	}


}

