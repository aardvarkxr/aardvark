import { AvOrigin, AvStandardGrabbable, AvTransform, RemoteUniverseComponent, NetworkUniverseComponent, AvComposedEntity, DefaultLanding } from '@aardvarkxr/aardvark-react';
import { g_builtinModelHandMirror, infiniteVolume, emptyVolume, Av } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';


interface HandMirrorState
{
	grabbed: boolean;
}

class HandMirror extends React.Component< {}, HandMirrorState >
{
	private networkUniverse = new NetworkUniverseComponent( this.onNetworkEvent );
	private remoteUniverse = new RemoteUniverseComponent( this.networkUniverse.initInfo, this.onRemoteEvent );

	constructor( props: any )
	{
		super( props );

		this.state = { grabbed: false };
	}

	@bind
	private onNetworkEvent( event: object, reliable: boolean )
	{
		this.remoteUniverse.networkEvent( event );
	}

	@bind
	private onRemoteEvent( event: object, reliable: boolean )
	{
		this.networkUniverse.remoteEvent( event );
	}

	private renderUniverses()
	{
		if( !this.state.grabbed )
			return null;

		return <AvOrigin path="/space/stage">
			<AvComposedEntity components={ [ this.networkUniverse ] }
				volume={ infiniteVolume() }/> }
			<AvTransform translateX={ 0.5 }>
				<AvComposedEntity components={ [ this.remoteUniverse ] }
					volume={ emptyVolume() } />
			</AvTransform>
		</AvOrigin>;
	}

	public render()
	{
		return <AvStandardGrabbable modelUri={ g_builtinModelHandMirror } 
				onGrab={ () => { this.setState( { grabbed: true} );} } 
				onEndGrab={ () => { this.setState( { grabbed: false } );} } >
				{ this.renderUniverses() }
			</AvStandardGrabbable>
	}
}


let main = Av() ? <HandMirror/> : <DefaultLanding/>;
ReactDOM.render( main, document.getElementById( "root" ) );
