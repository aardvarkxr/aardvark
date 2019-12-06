import { CAardvarkEndpoint, MessageHandler, OpenHandler } from './aardvark_endpoint';
import { MsgSetEndpointType, MessageType, EndpointType } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';


export class CGadgetEndpoint extends CAardvarkEndpoint
{
	private m_gadgetUri: string;
	private m_initialHook: string;
	private m_persistenceUuid: string;

	constructor( gadgetUri: string, initialHook: string, persistenceUuid: string,
		openHandler: OpenHandler, defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, openHandler, defaultHandler );
		this.m_gadgetUri = gadgetUri;
		this.m_initialHook = initialHook;
		this.m_persistenceUuid = persistenceUuid;
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
		if( this.m_persistenceUuid )
		{
			msgSetEndpointType.persistenceUuid = this.m_persistenceUuid;
		}

		this.sendMessage( MessageType.SetEndpointType, msgSetEndpointType );
	}


}

