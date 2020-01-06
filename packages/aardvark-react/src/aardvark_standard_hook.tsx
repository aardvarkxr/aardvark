import * as React from 'react';
import { AvTransform } from './aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from './aardvark_model';
import { HookHighlight, AvHook } from './aardvark_hook';
import { AvGadget } from './aardvark_gadget';
import { EHand, EndpointAddr, g_builtinModelHook, g_builtinModelBoundingBox } from '@aardvarkxr/aardvark-shared';
import { AvLine } from './aardvark_line';


interface StandardHookProps
{
	/** The persistent name of this node when saving the user's state. 
	 * For AvHook and AvGrabbable nodes, this is required to associate persistent
	 * state with the same hook or grabbable from run to run.
	 */
	persistentName: string;

	/** The hand that this hook is parented to. This is used to determine whether or
	 * not the hook should be visible based on that hand's edit mode.
	 */
	hand?: EHand;

	/** The amount to scale up the outer volume for this hook. Hooking 
	 * begins when the grabbable enters the inner volume and ends when it
	 * exits the outer volume.
	 * 
	 * @default 1.5
	 */
	outerVolumeScale?: number;
}

interface StandardHookState
{
	highlight: HookHighlight;
	grabbableAddr: EndpointAddr;
}

/** A hook for attaching grabbables to that uses a standard plus-in-circle icon and is made visible
 * whenever its parent hand is in edit mode.
 */
export class AvStandardHook extends React.Component< StandardHookProps, StandardHookState >
{
	private m_editModeHandle = 0;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			highlight: HookHighlight.None,
			grabbableAddr: null,
		};
	}

	@bind updateHookHighlight( newHighlight: HookHighlight, grabbableAddr: EndpointAddr )
	{
		this.setState( 
			{ 
				highlight: newHighlight,
				grabbableAddr,
			} );
	}

	public renderModel()
	{
		let showHook = false;
		let hookScale = 1.0;
		switch( this.state.highlight )
		{
			default:
			case HookHighlight.None:
			case HookHighlight.Occupied:
				break;
			
			case HookHighlight.GrabInProgress:
				showHook = true;
				break;

			case HookHighlight.InRange:
				showHook = true;
		}

		if( showHook )
		{
			return <AvTransform uniformScale={ hookScale }>
					<AvModel uri={ g_builtinModelHook } />
				</AvTransform>;
		}
	}


	public render()
	{
		return <div>
				<AvHook updateHighlight={ this.updateHookHighlight } radius={ 0.08 } 
					persistentName={ this.props.persistentName } outerVolumeScale={ this.props.outerVolumeScale }/>
				{ this.renderModel() }
			</div>;
	}
}


interface StandardBoxHookProps extends StandardHookProps
{
	/** Minimum x value for hook volume. */
	xMin: number;

	/** Maximum x value for hook volume. */
	xMax: number;

	/** Minimum y value for hook volume. */
	yMin: number;

	/** Maximum y value for hook volume. */
	yMax: number;

	/** Minimum z value for hook volume. */
	zMin: number;

	/** Maximum z value for hook volume. */
	zMax: number;
}


/** A hook for attaching grabbables to that uses a standard bounding box and is made visible
 * whenever its parent hand is in edit mode.
 */
export class AvStandardBoxHook extends React.Component< StandardBoxHookProps, StandardHookState >
{
	private m_editModeHandle = 0;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			highlight: HookHighlight.None,
			grabbableAddr: null,
		};
	}

	@bind updateHookHighlight( newHighlight: HookHighlight, grabbableAddr: EndpointAddr )
	{
		this.setState( 
			{ 
				highlight: newHighlight,
				grabbableAddr,
			} );
	}

	public renderModel()
	{
		let color: string = "green";
		let showHook = false;
		switch( this.state.highlight )
		{
			default:
			case HookHighlight.None:
			case HookHighlight.Occupied:
				color="#3E38FF";
				break;
			
			case HookHighlight.GrabInProgress:
				showHook = true;
				color="#7772FF";
				break;

			case HookHighlight.InRange:
				color="#3E38FF";
				showHook = true;
		}

		if( showHook )
		{
			return <AvTransform 
					translateX = { ( this.props.xMin + this.props.xMax ) / 2 }
					translateY = { ( this.props.yMin + this.props.yMax ) / 2 }
					translateZ = { ( this.props.zMin + this.props.zMax ) / 2 }
					scaleX={ ( this.props.xMax - this.props.xMin ) / 2 }
					scaleY={ ( this.props.yMax - this.props.yMin ) / 2 }
					scaleZ={ ( this.props.zMax - this.props.zMin ) / 2 } >
						<AvModel uri={ g_builtinModelBoundingBox }
							color={ color }/>
				</AvTransform>;
		}
	}

	private renderLine()
	{
		console.log( "renderLine called", this.state.highlight, this.state.grabbableAddr );
		if( !this.state.grabbableAddr || this.state.highlight != HookHighlight.InRange )
		{
			return null;
		}
		else
		{
			return <AvLine endId={ this.state.grabbableAddr } color="lightgreen"
				startGap={ 0.02 } endGap={ 0.04 } thickness={ 0.002 }/>
		}
	}

	public render()
	{
		return <>
				<AvHook updateHighlight={ this.updateHookHighlight } 
					preserveDropTransform={ true }
					allowMultipleDrops={ true }
					xMin={ this.props.xMin } xMax={ this.props.xMax }
					yMin={ this.props.yMin } yMax={ this.props.yMax }
					zMin={ this.props.zMin } zMax={ this.props.zMax }
					persistentName={ this.props.persistentName }
					outerVolumeScale={ this.props.outerVolumeScale }/>
				{ /*this.renderModel() */}
				{ this.renderLine() }
			</>;
	}
}

