import { AvOrigin, AvStandardGrabbable, AvTransform, NetworkUniverse, RemoteUniverse } from '@aardvarkxr/aardvark-react';
import { g_builtinModelHandMirror } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';


interface HandMirrorState
{
	grabbed: boolean;
	networkUniverse?: NetworkUniverse;
}

class HandMirror extends React.Component< {}, HandMirrorState >
{
	private remoteUniverse = React.createRef<RemoteUniverse>();

	constructor( props: any )
	{
		super( props );

		this.state = { grabbed: false };
	}

	@bind
	private onNetworkEvent( event: object, reliable: boolean )
	{
		this.remoteUniverse.current?.networkEvent( event );
	}

	@bind
	private onRemoteEvent( event: object, reliable: boolean )
	{
		this.state.networkUniverse?.remoteEvent( event );
	}

	@bind
	private onNetworkUniverseRef( networkUniverse: NetworkUniverse )
	{
		this.setState( { networkUniverse } );
	}

	public render()
	{
		return <AvStandardGrabbable modelUri={ g_builtinModelHandMirror } 
				onGrab={ () => { this.setState( { grabbed: true} );} } 
				onEndGrab={ () => { this.setState( { grabbed: false } );} } >
				<AvOrigin path="/space/stage">
					{ this.state.grabbed && 
						<NetworkUniverse ref={ this.onNetworkUniverseRef }
						onNetworkEvent={this.onNetworkEvent } /> }
					<AvTransform translateX={ 0.1 }>
						{ this.state.networkUniverse &&
							<RemoteUniverse ref={ this.remoteUniverse }
								onRemoteEvent={ this.onRemoteEvent } 
								initInfo={ this.state.networkUniverse.initInfo } /> }
					</AvTransform>
				</AvOrigin>
			</AvStandardGrabbable>
	}
}


ReactDOM.render( <HandMirror/>, document.getElementById( "root" ) );
