import { CAardvarkEndpoint, MessageHandler, OpenHandler } from './aardvark_endpoint';
import { MsgSetEndpointType, MessageType, EndpointType } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';


export class CRendererEndpoint extends CAardvarkEndpoint
{
	constructor( openHandler: OpenHandler, defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, openHandler, defaultHandler );
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Renderer,
		}

		this.sendMessage( MessageType.SetEndpointType, msgSetEndpointType );
	}
}

