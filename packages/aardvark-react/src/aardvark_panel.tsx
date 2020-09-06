import { Av, AvNodeTransform, AvSharedTextureInfo, AvVolume, EndpointAddr, EVolumeType, g_builtinModelPanel, nodeTransformToMat4, PanelMouseEventType, AvVector } from '@aardvarkxr/aardvark-shared';
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
		} );
	}

	private deliverMouseEvent( eventType: PanelMouseEventType, panelFromPoker: AvVector, pokerEpa: EndpointAddr )
	{
		if( eventType == PanelMouseEventType.Leave )
		{
			this.setState( { mousePosition: null } );
		}
		else
		{
			this.setState( { mousePosition: new vec2( [ panelFromPoker.x, panelFromPoker.y ] ) } );
		}

		let event: PanelMouseEvent =
		{
			type: eventType,
			pokerEpa,
			x: panelFromPoker.x / this.width + 0.5,
			y: 1.0 - ( panelFromPoker.y / this.height + 0.5 ),
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
				zMin: 0, zMax: 0.0003,
			}
		};
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
							receives={ [ { iface: "aardvark-panel@1", processor: this.onPanel } ] }/> }
				</>
	}
}