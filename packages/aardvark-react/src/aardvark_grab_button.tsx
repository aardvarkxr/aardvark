import { AvVolume, EVolumeType, AvColor } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { AvGadget } from './aardvark_gadget';
import { ActiveInterface, AvInterfaceEntity } from './aardvark_interface_entity';
import { AvModel } from './aardvark_model';
import { PanelRequest, PanelRequestType } from './aardvark_panel';
import { AvTransform } from './aardvark_transform';


/** Props for {@link AvGrabButton} */
export interface GrabButtonProps
{
	/** The onTrigger callback is called when the grab button is grabbed. */
	onClick?: () => void;

	/** The onTrigger callback is called when the grab button is grabbed. */
	onRelease?: () => void;

	/** The URI of the GLTF model to use for this grab button. Exactly one
	 * of modelUri and radius must be specified. If modelUri is specified,
	 * the bounding box of the model will also be used as the grabbable
	 * region for the button.
	 */
	modelUri?: string;

	/** The color to apply to the model.
	 * 
	 * @default none
	 */
	color?: string | AvColor;

	/** The radius of the sphere that defines the grabbable handle for this 
	 * grab button. Exactly one of modelUri and radius must be specified.
	 */
	radius?: number;
}

interface GrabButtonState
{
	outerCount: number;
	innerCount: number;
}

/** A component that signals when it is grabbed. */
export class AvGrabButton extends React.Component< GrabButtonProps, GrabButtonState >
{
	constructor( props: any )
	{
		super( props );

		this.state = 
		{
			innerCount: 0, 
			outerCount: 0,
		};
	}

	@bind
	private onOuter( activePoker: ActiveInterface )
	{
		this.setState( ( prevState ) => { return { outerCount: prevState.outerCount + 1 }; } );
		activePoker.onEnded( () =>
		{
			this.setState( ( prevState ) => { return { outerCount: prevState.outerCount - 1 }; } );
		} );
	}
	
	@bind
	private onInner( activePoker: ActiveInterface )
	{
		this.setState( ( prevState ) => 
		{
			if( prevState.innerCount == 0 ) 
			{
				AvGadget.instance().sendHapticEvent( activePoker.peer, 0.7, 1, 0 );
		
				this.props.onClick?.();
			}

			return { innerCount: prevState.innerCount + 1 }; 
		} );

		activePoker.onEnded( () =>
		{
			this.setState( ( prevState ) => 
			{
				if( prevState.innerCount == 1 ) 
				{
					AvGadget.instance().sendHapticEvent( activePoker.peer, 0.3, 1, 0 );
					this.props.onRelease?.();
				}
	
				return { innerCount: prevState.innerCount - 1 }; 
			} );
		} );
	}
	
	public render()
	{
		let scale = ( this.state.outerCount > 0 ) ? 1.1 : 1.0;
		let outerVolume: AvVolume;
		if( this.props.radius )
		{
			outerVolume = 
			{
				type: EVolumeType.Sphere,
				radius: this.props.radius,
			};
		}
		else if( this.props.modelUri )
		{
			outerVolume = 
			{
				type: EVolumeType.ModelBox,
				uri: this.props.modelUri,
			};
		}

		let innerVolume = outerVolume ? { ...outerVolume, scale: 0.8 } : null;

		return <>
			<AvTransform uniformScale={ scale }>
				{ this.props.modelUri && <AvModel uri={ this.props.modelUri } 
					color={ this.props.color }/> }
				{ this.props.children }
			</AvTransform>
			<AvInterfaceEntity volume={ outerVolume } priority={ 20 }
				receives={ [ { iface: "aardvark-panel@2", processor: this.onOuter } ] }/>
			<AvInterfaceEntity volume={ innerVolume } priority={ 21 }
				receives={ [ { iface: "aardvark-panel@2", processor: this.onInner } ] }/>
		</>;
	}
}

