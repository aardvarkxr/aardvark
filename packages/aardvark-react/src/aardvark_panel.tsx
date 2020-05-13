import * as React from 'react';
import { Av, AvNodeTransform, AvNodeType, AvPanelHandler, AvPanelMouseEvent, AvPanelMouseEventType, AvSharedTextureInfo, EndpointAddr, EVolumeType, AvVolume, g_builtinModelPanel } from '@aardvarkxr/aardvark-shared';
import { vec2, vec4 } from '@tlaukkan/tsm';
import bind from 'bind-decorator';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvGadget } from './aardvark_gadget';
import { ActiveInterface, AvInterfaceEntity } from './aardvark_interface_entity';
import { nodeTransformToMat4 } from './math_utils';
import { AvTransform } from './aardvark_transform';
import { AvModel } from './aardvark_model';
import { AvPrimitive, PrimitiveType } from './aardvark_primitive';


export enum PanelMouseEventType
{
	Unknown = 0,
	Down = 1,
	Up = 2,
	Enter = 3,
	Leave = 4,
	Move = 5,
};

export interface PanelMouseEvent
{
	type: PanelMouseEventType;
	x: number;
	y: number;
	pokerEpa: EndpointAddr;
};

export interface PanelHandler
{
	( event: PanelMouseEvent ): void;
}

export interface AvPanelProps extends AvBaseNodeProps
{
	/** Set this to true to cause the panel to be interacted with by pokers. 
	 * @default false */
	interactive?: boolean;

	/** By default poker events will turn into mouse events to the browser that can be processed
	 * by the normal HTML/Javacript mouse processing. Set a custom mouse handler if you need
	 * to process incoming mouse events in some other way.
	*/
	customMouseHandler?: PanelHandler;

	/** The width of the panel in meters. The panel's height will be scaled by this number and the
	 * aspect ratio of the window.
	 */
	widthInMeters: number;
}

export enum PanelRequestType
{
	Down = "down",
	Up = "up",
};

export interface PanelRequest
{
	type: PanelRequestType;
}

interface AvPanelState
{
	mousePosition: vec2;
}

/**
 * AvPanel outputs a 1m x 1m quad with the contents of the containing browser as its texture.
 * To change the size of the resulting quad, use [AvTransform](#aardvarktransform).
 * 
 * @see See [AvPoker](#aardvarkpoker)
 */
export class AvPanel extends React.Component< AvPanelProps, AvPanelState >
{
	private m_sharedTextureInfo: AvSharedTextureInfo = null;

	constructor( props: any )
	{
		super( props );

		this.state = { mousePosition: null };

		Av().subscribeToBrowserTexture( this.onUpdateBrowserTexture );
	}

	@bind onUpdateBrowserTexture( info: AvSharedTextureInfo )
	{
		this.m_sharedTextureInfo = info;
		AvGadget.instance().markDirty();
	}

	@bind
	private onPanel( activePoker: ActiveInterface )
	{
		this.deliverMouseEvent( PanelMouseEventType.Enter, activePoker.selfFromPeer, activePoker.peer );

		activePoker.onEvent( ( event: PanelRequest ) =>
		{
			switch( event.type )
			{
				case PanelRequestType.Down:
					this.deliverMouseEvent( PanelMouseEventType.Down, activePoker.selfFromPeer, activePoker.peer );
					break;

				case PanelRequestType.Up:
					this.deliverMouseEvent( PanelMouseEventType.Up, activePoker.selfFromPeer, activePoker.peer );
					break;
			}
		} );

		activePoker.onTransformUpdated( ( entityFromPeer: AvNodeTransform ) =>
		{
			this.deliverMouseEvent( PanelMouseEventType.Move, entityFromPeer, activePoker.peer );
		} );

		activePoker.onEnded( () =>
		{
			this.deliverMouseEvent( PanelMouseEventType.Leave, activePoker.selfFromPeer, activePoker.peer );
		} );
	}

	private deliverMouseEvent( eventType: PanelMouseEventType, panelFromPoker: AvNodeTransform, pokerEpa: EndpointAddr )
	{
		let panelFromPokerMat = nodeTransformToMat4( panelFromPoker );
		let eventLocWorld = panelFromPokerMat.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );

		if( eventType == PanelMouseEventType.Leave )
		{
			this.setState( { mousePosition: null } );
		}
		else
		{
			this.setState( { mousePosition: new vec2( eventLocWorld.xy ) } );
		}

		let event: PanelMouseEvent =
		{
			type: eventType,
			pokerEpa,
			x: eventLocWorld.x / this.width + 0.5,
			y: 1.0 - ( eventLocWorld.y / this.height + 0.5 ),
		};

		if( eventType != PanelMouseEventType.Move )
		{
			console.log( `panel mouse event ${ PanelMouseEventType[ eventType ] } ${ event.x }, ${ event.y }` );
		}
		
		if( this.props.customMouseHandler )
		{
			this.props.customMouseHandler( event );
		}
		else
		{
			this.onDefaultMouseEvent( event );
		}
	}

	private onDefaultMouseEvent( event: PanelMouseEvent )
	{
		let hapticAmplitude = 0;
		switch( event.type )
		{
			case PanelMouseEventType.Enter:
			case PanelMouseEventType.Leave:
				hapticAmplitude = 0.05;
				break;

			case PanelMouseEventType.Down:
				hapticAmplitude = 1;
				break;
		}

		if( hapticAmplitude > 0 )
		{
			AvGadget.instance().sendHapticEvent( event.pokerEpa, hapticAmplitude, 1, 0 );
		}

		Av().spoofMouseEvent( event.type as unknown as AvPanelMouseEventType, event.x, event.y );
	}

	private get width(): number
	{
		return this.props.widthInMeters;
	}

	private get height(): number
	{
		return window.innerHeight * this.props.widthInMeters / window.innerWidth;
	}
	
	render()
	{
		let volume: AvVolume =
		{
			type: EVolumeType.AABB,
			aabb:
			{
				xMin: -this.width/2, xMax: this.width/2,
				yMin: -this.height/2, yMax: this.height/2,
				zMin: 0, zMax: 0.03,
			}
		};

		return <>
					<AvTransform scaleX={ this.width } scaleY={ this.height }>
						<AvTransform rotateX={ 90 } >
							<AvModel uri={ g_builtinModelPanel } useBrowserTexture={ true }/>
						</AvTransform>
					</AvTransform>
					{ this.state.mousePosition && 
						<AvTransform translateX={ this.state.mousePosition.x } translateY={ this.state.mousePosition.y } >
							<AvPrimitive type={ PrimitiveType.Sphere } radius={ 0.002 } color="yellow"/>
						</AvTransform> }
					<AvInterfaceEntity volume={ volume } priority={ 10 } wantsTransforms={ true }
						receives={ [ { iface: "aardvark-panel@1", processor: this.onPanel } ] }/>
				</>
	}
}