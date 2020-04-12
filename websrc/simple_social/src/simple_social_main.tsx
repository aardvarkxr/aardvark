import { AvOrigin, AvPanel, AvStandardGrabbable, AvTransform, ShowGrabbableChildren } from '@aardvarkxr/aardvark-react';
import { g_builtinModelHead } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';


enum SimpleChamber
{
	A = "A",
	B = "B",
	C = "C",
	D = "D",
}

interface SimpleSocialState
{
	currentChamber?: SimpleChamber;
}

class SimpleSocial extends React.Component< {}, SimpleSocialState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			currentChamber: null,
		};
	}

	public onJoinChamber( chamber: SimpleChamber )
	{
		this.setState( { currentChamber: chamber } );
	}

	@bind
	public onLeaveChamber()
	{
		this.setState( { currentChamber: null } );
	}

	public renderPanelContents()
	{
		if( this.state.currentChamber )
		{
			return <div className="Button" onClick={ this.onLeaveChamber }>
				Leave { this.state.currentChamber }</div>
		}	
		else
		{
			return <>
				<div className="Button" onClick={ () => this.onJoinChamber( SimpleChamber.A )}>
					Join A</div>
				<div className="Button" onClick={ () => this.onJoinChamber( SimpleChamber.B )}>
					Join B</div>
				<div className="Button" onClick={ () => this.onJoinChamber( SimpleChamber.C )}>
					Join C</div>
				<div className="Button" onClick={ () => this.onJoinChamber( SimpleChamber.D )}>
					Join D</div>
			</>;
		}
	}

	public renderPanel()
	{
		return <AvTransform rotateX={ 45 } translateZ={ -0.01 }>
				<AvTransform scaleX={ 0.125 } scaleZ={ 0.0625 }>
					<AvTransform translateZ={ -0.5 }>
						<AvPanel interactive={ true }>
							{ this.renderPanelContents() }
						</AvPanel>
					</AvTransform>
				</AvTransform>
			</AvTransform>;
	}

	public renderChamber(): JSX.Element
	{
		if( !this.state.currentChamber )
		{
			return null;
		}
		else
		{
			// TODO: Need a social example app that uses the new room API
			return null;
			// return <AvOrigin path="/space/stage" >
			// 	<AvDefaultChamber chamberId={ this.state.currentChamber }/>
			// </AvOrigin>;
		}
	}

	public render()
	{
		return (
			<>
				<AvStandardGrabbable modelUri={ g_builtinModelHead } 
					showChildren= { ShowGrabbableChildren.OnlyWhenGrabbed } >
					{ this.renderPanel() }
				</AvStandardGrabbable>

				{ this.renderChamber() }
			</>	);
	}
}


ReactDOM.render( <SimpleSocial/>, document.getElementById( "root" ) );
