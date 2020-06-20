import bind from 'bind-decorator';
import * as React from 'react';
import { AvInterfaceEntity, ActiveInterface } from './aardvark_interface_entity';
import { AvVolume, AardvarkManifest, endpointAddrToString, infiniteVolume } from '@aardvarkxr/aardvark-shared';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor, EndpointAddr } from '@aardvarkxr/aardvark-shared';
import { AvGadget } from './aardvark_gadget';
import { AvTransform } from './aardvark_transform';
import { AvHeadFacingTransform } from './aardvark_head_facing_transform';
import { AvModel } from './aardvark_model';

interface AvHighlightTransmittersProps
{
	/** This callback will be called to render the highlight nodes. */
	highlightContentCallback: () => JSX.Element;

	/** The interface to scan for. */
	interfaceName: string;
}


/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvHighlightTransmitters extends React.Component< AvHighlightTransmittersProps, {} >
{
	private activeTransmitters = new Map< string, ActiveInterface>();

	@bind
	private onTransmitter( xmit: ActiveInterface )
	{
		this.activeTransmitters.set( endpointAddrToString( xmit.peer ), xmit );
		this.forceUpdate();

		xmit.onEnded( () =>
		{
			this.activeTransmitters.delete( endpointAddrToString( xmit.peer ) );
			this.forceUpdate();
		} );
	}

	render()
	{
		let highlights: JSX.Element[] = [];
		for( let xmit of this.activeTransmitters.values() )
		{
			highlights.push( <AvTransform parent={ xmit.peer } 
				key={ endpointAddrToString( xmit.peer ) } >
					{ this.props.highlightContentCallback() }
			</AvTransform> );
		}

		return <>
			<AvInterfaceEntity volume={ infiniteVolume() } receives={ 
				[ { iface: this.props.interfaceName, processor: this.onTransmitter } ] } />
			{ highlights }
		</>;
	}
}

