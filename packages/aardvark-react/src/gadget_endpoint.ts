import { CAardvarkEndpoint, MessageHandler, OpenHandler, AsyncMessageHandler } from './aardvark_endpoint';
import { MsgSetEndpointType, MessageType, EndpointType } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';


export class CGadgetEndpoint extends CAardvarkEndpoint
{
	private m_gadgetUri: string;
	private m_initialHook: string;
	private m_persistenceUuid: string;
	private m_ownerUuid: string;
	private m_remoteUniversePath: string;

	constructor( gadgetUri: string, openHandler: OpenHandler, defaultHandler: AsyncMessageHandler = null )
	{
		super( () => { this.onOpen() }, openHandler, defaultHandler );
		this.allowReconnect();
		this.m_gadgetUri = gadgetUri;
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Gadget,
			gadgetUri: this.m_gadgetUri,
		}

		this.sendMessage( MessageType.SetEndpointType, msgSetEndpointType );
	}


}

