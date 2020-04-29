import { g_builtinModelCylinder, g_builtinModelBox, g_builtinModelSphere } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import { AvModel } from './aardvark_model';
import { AvTransform } from './aardvark_transform';

export enum PrimitiveType
{
	Cube = "cube",
	Sphere = "sphere",
	Cylinder = "cylinder",
}

export enum PrimitiveYOrigin
{
	Top = "top",
	Bottom = "bottom",
	Center = "center",
}

export enum PrimitiveXOrigin
{
	Left = "left",
	Right = "right",
	Center = "center",
}

export enum PrimitiveZOrigin
{
	Forward = "forward",
	Back = "back",
	Center = "center",
}

interface AvPrimitiveProps
{
	/** What kind of primitive to display */
	type: PrimitiveType;

	/** The height of the primitive. 
	 * 
	 * @default 1.0 meter
	 */
	height?: number;

	/** The width of the primitive. 
	 * 
	 * @default 1.0 meter
	 */
	width?: number;

	/** The depth of the primitive. 
	 * 
	 * @default 1.0 meter
	 */
	depth?: number;

	/** If radius is set, width, height, and depth all
	 * default to this value. Otherwise, it has no effect.
	 * 
	 * @default none
	 */
	radius?: number;

	/** The color of the primitive
	 * 
	 * @default white
	 */
	color?: string;

	/** The vertical alignment of the primitive.
	 * 
	 * @default Center
	 */
	originY?: PrimitiveYOrigin;

	/** The left/right alignment of the primitive.
	 * 
	 * @default Center
	 */
	originX?: PrimitiveXOrigin;

	/** The forward/back alignment of the primitive.
	 * 
	 * @default Center
	 */
	originZ?: PrimitiveZOrigin;
}


export function AvPrimitive( props: AvPrimitiveProps )
{
	let xScale = props.width ?? ( props.radius ?? 1.0 );
	let yScale = props.height ?? ( props.radius ?? 1.0 );
	let zScale = props.depth ?? ( props.radius ?? 1.0 );

	let xOffset: number;
	switch( props.originX ?? PrimitiveXOrigin.Center )
	{
		case PrimitiveXOrigin.Center:
			xOffset = 0;
			break;

		case PrimitiveXOrigin.Left:
			xOffset = xScale / 2;
			break;

		case PrimitiveXOrigin.Right:
			xOffset = -xScale / 2;
			break;
	}

	let yOffset: number;
	switch( props.originY ?? PrimitiveYOrigin.Center )
	{
		case PrimitiveYOrigin.Center:
			yOffset = 0;
			break;

		case PrimitiveYOrigin.Bottom:
			yOffset = yScale / 2;
			break;

		case PrimitiveYOrigin.Top:
			yOffset = -yScale / 2;
			break;
	}

	let zOffset: number;
	switch( props.originZ ?? PrimitiveZOrigin.Center )
	{
		case PrimitiveZOrigin.Center:
			zOffset = 0;
			break;

		case PrimitiveZOrigin.Forward:
			zOffset = -zScale / 2;
			break;

		case PrimitiveZOrigin.Back:
			zOffset = zScale / 2;
			break;
	}

	let modelUri: string;
	switch( props.type )
	{
		case PrimitiveType.Cube:
			modelUri = g_builtinModelBox;
			break;

		case PrimitiveType.Cylinder:
			modelUri = g_builtinModelCylinder;
			break;

		case PrimitiveType.Sphere:
			modelUri = g_builtinModelSphere;
			break;
	}

	return <AvTransform scaleX={ xScale } scaleY={ yScale } scaleZ={ zScale }
		translateX={ xOffset } translateY={ yOffset } translateZ={ zOffset }>
			<AvModel uri={ modelUri} color={ props.color }/>
		</AvTransform>;
}

