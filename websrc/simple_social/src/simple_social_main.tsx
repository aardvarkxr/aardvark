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

			// here's the member placement code that used to live in AvDefaultCHamber:
			// if( !members.length )
			// {
			// 	// don't bother setting positions for no members
			// 	return;
			// }
	
			// let stateMembers: AvDefaultChamberMember[] = [];
			// let localUserIndex = members.indexOf( AvGadget.instance().localUserInfo.userUuid );
			// for( let n = 0; n < members.length; n++ )
			// {
			// 	// don't send a position for the actual local user
			// 	if( n == localUserIndex )
			// 		continue;
	
			// 	let rotationIndex = ( n - localUserIndex + members.length ) % members.length;
			// 	let yRotRadians = rotationIndex * 360 / members.length;
	
			// 	const userSeparation = 1;  //meters
			// 	let circleRadius = members.length == 1 ? 0 : userSeparation / (2 * Math.sin(Math.PI / members.length));
	
			// 	stateMembers.push(
			// 		{
			// 			uuid: members[ n ],
			// 			x: circleRadius * Math.sin( yRotRadians ),
			// 			z: circleRadius * ( 1 - Math.cos( yRotRadians ) ),
			// 			rotY: yRotRadians,
			// 		}
			// 	);
			// }
	
			// this.setState( { members: stateMembers } );
	
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
