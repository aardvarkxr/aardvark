import { AvVolume, EVolumeType, AvColor } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { ActiveInterface, AvInterfaceEntity } from './aardvark_interface_entity';
import { AvModel } from './aardvark_model';
import { PanelRequest, PanelRequestType } from './aardvark_panel';
import { AvTransform } from './aardvark_transform';


/** Props for {@link AvMenuItem} */
export interface MenuItemProps
{
	/** The onSelect callback is called when the menu button is released while on the menu item. */
	onSelect?: () => void;

	/** The onHighlight callback is called when the menu item is touched by the grabber (and will 
	 * be selected if the user releases the menu button.) */
	onHighlight?: () => void;

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

interface MenuItemState
{
	menuCount: number;
}

export const k_MenuInterface = "aardvark-menu@1";

export enum MenuEventType
{
	Activate = "activate",
}

export interface MenuEvent
{
	type: MenuEventType;
}


/** A component that signals when it is grabbed. */
export class AvMenuItem extends React.Component< MenuItemProps, MenuItemState >
{
	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			menuCount: 0,
		};
	}

	@bind
	private onMenu( activeMenu: ActiveInterface )
	{
		if( this.state.menuCount == 0 )
		{
			this.props.onHighlight?.();
		}

		this.setState( ( prevState ) => { return { menuCount: prevState.menuCount + 1 }; } );

		activeMenu.onEvent( ( event: MenuEvent ) =>
		{
			switch( event.type )
			{
				case MenuEventType.Activate:
					this.props.onSelect?.();
					break;
			}
		} );

		activeMenu.onEnded( () =>
		{
			this.setState( ( prevState ) => { return { menuCount: prevState.menuCount - 1 }; } );
		})
	}
	
	public render()
	{
		let scale = ( this.state.menuCount > 0 ) ? 1.1 : 1.0;
		let volume: AvVolume;
		if( this.props.radius )
		{
			volume = 
			{
				type: EVolumeType.Sphere,
				radius: this.props.radius,
			};
		}
		else if( this.props.modelUri )
		{
			volume = 
			{
				type: EVolumeType.ModelBox,
				uri: this.props.modelUri,
			};
		}

		return <>
			<AvTransform uniformScale={ scale }>
				{ this.props.modelUri && <AvModel uri={ this.props.modelUri } 
					color={ this.props.color }/> }
				{ this.props.children }
			</AvTransform>
			<AvInterfaceEntity volume={ volume } priority={ 20 }
				receives={ [ { iface: k_MenuInterface, processor: this.onMenu } ] }/>
		</>;
	}
}

