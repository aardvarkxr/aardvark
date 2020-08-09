import * as React from 'react';
import { AvGadget } from './aardvark_gadget';
import { AvInterfaceEntity, ActiveInterface } from './aardvark_interface_entity';
import { AvVolume, AardvarkManifest, EVolumeType, EVolumeContext } from '@aardvarkxr/aardvark-shared';

/** The interface name for {@link AvGadgetInfo} */
export const k_GadgetInfoInterface = "aardvark_gadget_info@1";


/** Props for {@link AvGadgetInfo} */
export interface AvGadgetInfoProps
{
	volume: AvVolume;
}

/** The event format for the {@link k_GadgetInfoInterface} interface. */
export interface GadgetInfoEvent
{
	type: "gadget_info",
	gadgetUrl: string,
	gadgetManifest: AardvarkManifest,
}

/** This component creates an {@link AvInterfaceEntity} that represents the gadget 
 * to other UI elements in Aardvark. This entity is what allows users to start, start,
 * stop, and favorite the gadget, among other things.
 */
export function AvGadgetInfo( props: AvGadgetInfoProps )
{
	let onGadgetInfo = ( activeInterface: ActiveInterface )=>
	{
		let event: GadgetInfoEvent =
		{
			type: "gadget_info",
			gadgetUrl: AvGadget.instance().url,
			gadgetManifest: AvGadget.instance().manifest,
		};

		activeInterface.sendEvent( event );
	}

	let volumes = 
	[ 
		{ ...props.volume, scale: 1.5, context: EVolumeContext.Always },
		{ ...props.volume, scale: 4.0, context: EVolumeContext.ContinueOnly },
	];

	return <AvInterfaceEntity volume={ volumes }
		transmits={ 
			[
				{ 
					iface: k_GadgetInfoInterface,
					processor: onGadgetInfo,
				}
			]
		}/>
}

