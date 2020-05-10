import * as React from 'react';
import { AvTransform } from './aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from './aardvark_model';
import { EndpointAddr, EVolumeType } from '@aardvarkxr/aardvark-shared';
import { HighlightType, AvGrabbable, HookInteraction } from './aardvark_grabbable';
import { AvModelBoxHandle } from './aardvark_handles';
import { MoveableComponent, MoveableComponentState } from './component_moveable';
import { AvComposedEntity } from './aardvark_composed_entity';

export enum ShowGrabbableChildren
{
	/** Always show the children of the AvStandardGrabbable, no matter
	 * what the highlight state is.
	 */
	Always = 0,

	/** Only show the children of the AvStandardGrabbable when it is 
	 * being grabbed.
	 */
	OnlyWhenGrabbed = 1,

	/** Only show the children of the AvStandardGrabbable when it is 
	 * not being grabbed.
	 */
	OnlyWhenNotGrabbed = 2,
}

export enum DropStyle
{
	/** Drop this grabbable on hooks */
	DropOnHooks = 1,

	/** Drop this grabbable in the world */
	DropInTheWorld = 2,
}

interface StandardGrabbableProps
{
	/** The model to use for the grab handle of this grabbable. */
	modelUri: string;

	/** Tells the standard grabbable when to show its children. 
	 * 
	 * @default ShowGrabbableChildren.Always
	*/
	showChildren?: ShowGrabbableChildren;

	/** Uniform scale to apply to the grab handle.
	 * 
	 * @default 1.0
	*/
	modelScale?: number;

	/** Color to apply to the grab handle.
	 * 
	 * @default none
	*/
	modelColor?: string;

	/** Called when the grabbable is grabbed. 
	 * 
	 * @default none
	*/
	onGrab?: () => void;

	/** Called when the grabbable is dropped. 
	 * 
	 * @default none
	*/
	onEndGrab?: () => void;

	/** Allows the grabbable to be automatically added to a container when it is first created.
	 * 
	 * @default none
	 */
	initialParent?: EndpointAddr;
}


interface StandardGrabbableState
{
	highlight: HighlightType;
}

/** A grabbable that shows a model for its handle and highlights automatically. */
export class AvStandardGrabbable extends React.Component< StandardGrabbableProps, StandardGrabbableState >
{
	private moveableComponent: MoveableComponent;

	constructor( props: any )
	{
		super( props );

		this.moveableComponent = new MoveableComponent( this.onMoveableUpdate, this.props.initialParent );

		this.state = 
		{ 
			highlight: HighlightType.None
		};
	}

	@bind
	private async onMoveableUpdate()
	{
		let highlight: HighlightType;
		switch( this.moveableComponent.state )
		{
			default:
			case MoveableComponentState.Idle:
			case MoveableComponentState.InContainer:
				highlight = HighlightType.None;
				break;

			case MoveableComponentState.GrabberNearby:
				highlight = HighlightType.InRange;
				break;

			case MoveableComponentState.Grabbed:
				highlight = HighlightType.Grabbed;
				break;
		}

		this.setState( ( oldState: StandardGrabbableState ) =>
		{
			if( oldState.highlight == HighlightType.InRange || oldState.highlight == HighlightType.None )
			{
				if( highlight == HighlightType.Grabbed )
				{
					console.log( "standard grabbable was grabbed" );
					this.props.onGrab?.();
				}
			}
			else if( oldState.highlight == HighlightType.Grabbed )
			{
				if( highlight == HighlightType.InRange || highlight == HighlightType.None )
				{
					console.log( "standard grabbable was ungrabbed" );
					this.props.onEndGrab?.();
				}
			}
			return { ...oldState, highlight };
		} );
	}

	public get isGrabbed()
	{
		return this.state.highlight == HighlightType.Grabbed 
			|| this.state.highlight == HighlightType.InHookRange;
	}

	public render()
	{
		let showChildren: boolean;
		switch( this.props.showChildren ?? ShowGrabbableChildren.Always )
		{
			default:
			case ShowGrabbableChildren.Always:
				showChildren = true;
				break;

			case ShowGrabbableChildren.OnlyWhenGrabbed:
				showChildren = this.state.highlight == HighlightType.Grabbed 
					|| this.state.highlight == HighlightType.InHookRange;
				break;

			case ShowGrabbableChildren.OnlyWhenNotGrabbed:
				showChildren = this.state.highlight == HighlightType.None 
					|| this.state.highlight == HighlightType.InRange;
				break;
		}

		let scale = this.state.highlight == HighlightType.InRange ? 1.1 : 1.0;
		if( this.props.modelScale )
		{
			scale *= this.props.modelScale;
		}

		return (
			<AvComposedEntity components={ [ this.moveableComponent ] }
				volume={ {type: EVolumeType.ModelBox, uri: this.props.modelUri } }>
					<AvTransform uniformScale={ scale }>
						<AvModel uri={ this.props.modelUri} color={ this.props.modelColor }/>
						<AvModelBoxHandle uri={ this.props.modelUri } />
					</AvTransform>
					{ this.props.children && 
						<AvTransform visible={ showChildren }>{ this.props.children }</AvTransform> }
				</AvComposedEntity> );
	}
}


