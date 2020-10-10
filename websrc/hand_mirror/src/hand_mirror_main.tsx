import { AvOrigin, AvStandardGrabbable, AvTransform, RemoteUniverseComponent, NetworkUniverseComponent, AvComposedEntity, DefaultLanding, GrabbableStyle, AvGrabButton } from '@aardvarkxr/aardvark-react';
import { g_builtinModelHandMirror, infiniteVolume, emptyVolume, Av, g_builtinModelPlus } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';


interface HandMirrorState
{
	grabbed: boolean;
	turnedOn: boolean;
}

class HandMirror extends React.Component< {}, HandMirrorState >
{
	private networkUniverse = new NetworkUniverseComponent( this.onNetworkEvent );
	private remoteUniverse: RemoteUniverseComponent = null;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			grabbed: false,
			turnedOn: false,
		};
	}

	@bind
	private onNetworkEvent( event: object, reliable: boolean )
	{
		this.remoteUniverse?.networkEvent( event );
	}

	@bind
	private onRemoteEvent( event: object, reliable: boolean )
	{
		this.networkUniverse.remoteEvent( event );
	}

	@bind
	private onToggleMirror()
	{
		this.setState( ( oldState: HandMirrorState ) => { return { turnedOn: !oldState.turnedOn } } );
	}

	private renderUniverses()
	{
		if( !this.state.grabbed && !this.state.turnedOn )
		{
			this.remoteUniverse = null;
			return null;
		}

		if( !this.remoteUniverse )
		{
			this.remoteUniverse = new RemoteUniverseComponent( this.networkUniverse.initInfo, 
				this.onRemoteEvent );
		}

		return <AvOrigin path="/space/stage">
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
				onEndGrab={ () => { this.setState( { grabbed: false } );} } 
				style={ GrabbableStyle.Gadget }>
					<AvTransform translateX={0.05}>
						<AvGrabButton onClick={ this.onToggleMirror } modelUri={ g_builtinModelPlus }/>
					</AvTransform>
				{ this.renderUniverses() }
				<AvOrigin path="/space/stage">
					<AvComposedEntity components={ [ this.networkUniverse ] }
						volume={ infiniteVolume() }/> 
				</AvOrigin>
			</AvStandardGrabbable>
	}
}


let main = Av() ? <HandMirror/> : <DefaultLanding/>;
ReactDOM.render( main, document.getElementById( "root" ) );
