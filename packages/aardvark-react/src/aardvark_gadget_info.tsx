import * as React from 'react';
import { AvGadget } from './aardvark_gadget';
import { AvInterfaceEntity, ActiveInterface } from './aardvark_interface_entity';
import { AvVolume, AardvarkManifest } from '@aardvarkxr/aardvark-shared';

export const k_GadgetInfoInterface = "aardvark_gadget_info@1";

interface AvGadgetInfoProps
{
	volume: AvVolume;
}

export interface GadgetInfoEvent
{
	type: "gadget_info",
	gadgetUrl: string,
	gadgetManifest: AardvarkManifest,
}

export function AvGadgetInfo( props: AvGadgetInfoProps )
{
	let onGadgetInfo = ( activeInterface: ActiveInterface )=>
	{
		let event: GadgetInfoEvent =
		{
			type: "gadget_info",
			gadgetUrl: AvGadget.instance().url,
			gadgetManifest: AvGadget.instance().m_manifest,
		};

		activeInterface.sendEvent( event );
	}

	return <AvInterfaceEntity volume={ props.volume }
		transmits={ 
			[
				{ 
					iface: k_GadgetInfoInterface,
					processor: onGadgetInfo,
				}
			]
		}/>
}

