import { Av, AvNodeTransform, AvSharedTextureInfo, AvVolume, EndpointAddr, EVolumeType, g_builtinModelPanel, nodeTransformToMat4, PanelMouseEventType, PanelKeyboardEventType, AvVector } from '@aardvarkxr/aardvark-shared';
import { vec2, vec4 } from '@tlaukkan/tsm';
import bind from 'bind-decorator';
import * as React from 'react';
import { AvBaseNodeProps } from './aardvark_base_node';
import { AvGadget } from './aardvark_gadget';
import { ActiveInterface, AvInterfaceEntity } from './aardvark_interface_entity';
import { AvModel } from './aardvark_model';
import { AvPrimitive, PrimitiveType } from './aardvark_primitive';
import { AvTransform } from './aardvark_transform';


/** "Mouse" event for custom panel handlers */
export interface PanelMouseEvent
{
	type: PanelMouseEventType;
	x: number;
	y: number;
	pokerEpa: EndpointAddr;
};

export interface PanelKeyboardEvent
{
	type: PanelKeyboardEventType;
	keycode: string;
}

/** Function signature for the  {@link AvPanelProps} customMouseHandler */
export interface PanelHandler
{
	( event: PanelMouseEvent ): void;
}

/** Props for {@link AvPanel} */
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

/** @hidden */
export enum PanelRequestType
{
	Down = "down",
	Up = "up",
};

/** @hidden */
export interface PanelRequest
{
	type: PanelRequestType;
}


interface AvPanelState
{
	mousePosition: vec2;
	mouseDistance: number;
	mousePressed: boolean;
	keyboardPressed: boolean;
	keycodePressed: number;
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
	private m_activePoker: ActiveInterface = null;

	constructor( props: any )
	{
		super( props );

		this.state = { mousePosition: null, mouseDistance: 9999, mousePressed: false, keyboardPressed: false, keycodePressed: 38 };

		Av().subscribeToBrowserTexture( this.onUpdateBrowserTexture );
	}

	@bind
	private onUpdateBrowserTexture( info: AvSharedTextureInfo )
	{
		this.m_sharedTextureInfo = info;
		AvGadget.instance().markDirty();
	}

	@bind
	private onPanel( activePoker: ActiveInterface )
	{
		this.deliverMouseEvent( PanelMouseEventType.Enter, activePoker.selfIntersectionPoint, activePoker.peer );
		this.deliverKeyboardEvent( PanelKeyboardEventType.Down, 38, activePoker.peer )
		this.m_activePoker = activePoker;

		activePoker.onEvent( ( event: PanelRequest ) =>
		{
			switch( event.type )
			{
				case PanelRequestType.Down:
					this.deliverMouseEvent( PanelMouseEventType.Down, activePoker.selfIntersectionPoint, 
						activePoker.peer );
					break;

				case PanelRequestType.Up:
					this.deliverMouseEvent( PanelMouseEventType.Up, activePoker.selfIntersectionPoint, 
						activePoker.peer );
					break;
			}
		} );

		activePoker.onTransformUpdated( ( entityFromPeer: AvNodeTransform ) =>
		{
			this.deliverMouseEvent( PanelMouseEventType.Move, activePoker.selfIntersectionPoint, activePoker.peer );
		} );

		activePoker.onEnded( () =>
		{
			this.deliverMouseEvent( PanelMouseEventType.Leave, activePoker.selfIntersectionPoint, activePoker.peer );
			this.m_activePoker = null;
		} );
	}

	componentDidUpdate( prevProps: AvPanelProps, prevState: AvPanelState )
	{
		const k_clickDist = 0.01;
		const k_releaseDist = 0.02;
		let dist = this.state.mouseDistance ?? 9999;
		if( dist < k_clickDist && !this.state.mousePressed )
		{
			this.deliverMouseEvent( PanelMouseEventType.Down, null, this.m_activePoker?.peer );
			this.setState( { mousePressed: true } );
		}
		else if( dist > k_releaseDist && this.state.mousePressed)
		{
			this.deliverMouseEvent( PanelMouseEventType.Up, null, this.m_activePoker?.peer );
			this.setState( { mousePressed: false } );
		}
	}

	private deliverMouseEvent( eventType: PanelMouseEventType, panelFromPoker: AvVector, pokerEpa: EndpointAddr )
	{
		let mousePosition: vec2 = this.state.mousePosition;
		if( eventType == PanelMouseEventType.Leave )
		{
			this.setState( { mousePosition: null } );
		}
		else if( panelFromPoker )
		{

			mousePosition = new vec2( [ panelFromPoker.x, panelFromPoker.y ] );
			this.setState( { mousePosition, mouseDistance: panelFromPoker.z } );
		}

		let event: PanelMouseEvent =
		{
			type: eventType,
			pokerEpa,
			x: mousePosition.x / this.width + 0.5,
			y: 1.0 - ( mousePosition.y / this.height + 0.5 ),
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

		Av().spoofMouseEvent( event.type, event.x, event.y );
	}

	private get width(): number
	{
		return this.props.widthInMeters;
	}

	private get height(): number
	{
		return window.innerHeight * this.props.widthInMeters / window.innerWidth;
	}

	private deliverKeyboardEvent( eventType: PanelKeyboardEvent, keycode: string, pokerEpa: EndpointAddr )
	{
		Av().spoofKeyboardEvent( eventType.type, keycode, pokerEpa );
	}
	
	/* @hidden */
	render()
	{
		let volume: AvVolume =
		{
			type: EVolumeType.AABB,
			aabb:
			{
				xMin: -this.width/2, xMax: this.width/2,
				yMin: -this.height/2, yMax: this.height/2,
				zMin: 0, zMax: 0.0001,
			}
		};
		// We use two volumes here, with the thin one first, to improve the quality of the intersection point.
		// Ray intersections will almost always hit the thin volume if they would have hit the thick volume,
		// so they generate an intersection point that's very close to the surface of the panel. Sphere 
		// intersections (like the grabbers on the hands) will intersect with the thicker volume a few cm away
		// from the panel, which makes the panel easier to use. 
		// In both cases the intersection point is projected down to the surface of the panel.
		let thickVolume: AvVolume =
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
						{ this.props.children }
					</AvTransform>
					{ this.state.mousePosition && 
						<AvTransform translateX={ this.state.mousePosition.x } translateY={ this.state.mousePosition.y } >
							<AvPrimitive type={ PrimitiveType.Sphere } radius={ 0.002 } color="yellow"/>
						</AvTransform> }
					{ this.props.interactive &&
						<AvInterfaceEntity volume={ [ volume, thickVolume ] } priority={ 10 } wantsTransforms={ true }
							receives={ [ { iface: "aardvark-panel@2", processor: this.onPanel } ] }/> }
				</>
	}
}