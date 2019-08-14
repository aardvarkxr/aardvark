import { CAardvarkEndpoint, MessageHandler, OpenHandler } from './aardvark_endpoint';
import { MsgSetEndpointType, MessageType, EndpointType } from './aardvark_protocol';
import bind from 'bind-decorator';


export class CRendererEndpoint extends CAardvarkEndpoint
{
	private m_openHandler: OpenHandler;

	constructor( openHandler: OpenHandler, defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, defaultHandler );
		this.m_openHandler = openHandler;
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Renderer,
		}

		this.sendMessage( [], MessageType.SetEndpointType, msgSetEndpointType );

		if( this.m_openHandler )
		{
			this.m_openHandler();
		}
	}
}

