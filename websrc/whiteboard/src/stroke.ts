import { AvVector } from '@aardvarkxr/aardvark-shared';
import { vec2, vec3 } from '@tlaukkan/tsm';
import Color from 'color';
import { exportGLB, GLTFAsset, Material, Mesh as GltfMesh, Node, Scene, Vertex } from "gltf-js-utils";
import { CatmullRomCurve3, ExtrudeGeometry, ExtrudeGeometryOptions, Geometry, Matrix4, Shape, SphereGeometry, Vector3 } from 'three';

export interface Stroke
{
	id: number;
	thickness: number;
	points?: vec2[];
	networkPoints?: AvVector[];
	color: string;
}

export function optimizeStroke( stroke: Stroke )
{
	if( !stroke || stroke.points.length < 3 )
	{
		return 0;
	}

	let pointsRemoved = 0;
	while( true )
	{
		let bestIndex: number;
		let bestError = 99999;

		// Look for points we can slice out of the stroke because 
		// their error is too small to matter
		for( let n = 0; n < stroke.points.length - 2; n++ )
		{
			let distN1 = vec2.distance( stroke.points[n], stroke.points[n + 1] );
			let distN2 = vec2.distance( stroke.points[n], stroke.points[n + 2] );

			let fakeN1 = vec2.mix(stroke.points[n], stroke.points[n+2], distN1/distN2, new vec2() );
			let error = vec2.distance(stroke.points[n+1], fakeN1);
			if( error < bestError )
			{
				bestIndex = n + 1;
				bestError = error;
			}
		}

		if( !bestIndex || bestError > 0.001 )
		{
			break;
		}
		else
		{
			stroke.points.splice( bestIndex, 1 );
			pointsRemoved++;
		}
	}

	return pointsRemoved;
}

function makeVert( pos: vec3, uv?: vec2 )
{
	let v1 = new Vertex();
	v1.x = pos.x;
	v1.y = pos.y;
	v1.z = pos.z;
	v1.u = uv?.x ?? 0;
	v1.v = uv?.y ?? 0;
	return v1;
}

function makeCubeMesh( center: vec3, dims: vec3 )
{
	const mesh = new GltfMesh();

	let v1 = makeVert( new vec3( [ center.x - dims.x/2, center.y - dims.y/2, center.z - dims.z/2 ] ) );
	let v2 = makeVert( new vec3( [ center.x - dims.x/2, center.y - dims.y/2, center.z + dims.z/2 ] ) );
	let v3 = makeVert( new vec3( [ center.x - dims.x/2, center.y + dims.y/2, center.z - dims.z/2 ] ) );
	let v4 = makeVert( new vec3( [ center.x - dims.x/2, center.y + dims.y/2, center.z + dims.z/2 ] ) );
	let v5 = makeVert( new vec3( [ center.x + dims.x/2, center.y - dims.y/2, center.z - dims.z/2 ] ) );
	let v6 = makeVert( new vec3( [ center.x + dims.x/2, center.y - dims.y/2, center.z + dims.z/2 ] ) );
	let v7 = makeVert( new vec3( [ center.x + dims.x/2, center.y + dims.y/2, center.z - dims.z/2 ] ) );
	let v8 = makeVert( new vec3( [ center.x + dims.x/2, center.y + dims.y/2, center.z + dims.z/2 ] ) );

	// front
	mesh.addFace( v4, v2, v8, null, 0 );
	mesh.addFace( v2, v6, v8, null, 0 );

	// top
	mesh.addFace( v8, v3, v4, null, 0 );
	mesh.addFace( v3, v8, v7, null, 0 );

	// right
	mesh.addFace( v6, v7, v8, null, 0 );
	mesh.addFace( v7, v6, v5, null, 0 );

	// back
	mesh.addFace( v5, v1, v7, null, 0 );
	mesh.addFace( v7, v1, v3, null, 0 );

	// bottom
	mesh.addFace( v2, v1, v6, null, 0 );
	mesh.addFace( v6, v1, v5, null, 0 );

	// left
	mesh.addFace( v3, v2, v4, null, 0 );
	mesh.addFace( v2, v3, v1, null, 0 );

	return mesh;
}

export function strokeToGlb( stroke: Stroke )
{
	//Create an array of three.js points for the path
	let threePoints:Vector3[];
	if( stroke.points )
	{
		threePoints = stroke.points.map( ( p ) => new Vector3( p.x, p.y, 0 ) );
	}
	else
	{
		threePoints = stroke.networkPoints.map( ( p ) => new Vector3( p.x, p.y, 0 ) );
	}

	let geometry: Geometry = null;
	if( threePoints.length == 1 )
	{
		geometry = new SphereGeometry( stroke.thickness/2, 10, 10 );
		let translateMat = new Matrix4();
		translateMat.makeTranslation( threePoints[0].x, threePoints[0].y, threePoints[0].z );
		geometry.applyMatrix4( translateMat );
	}
	else
	{
		var curve = new CatmullRomCurve3( threePoints, false, "chordal", 0.1 );

		// make a nice circle shape
		const k_circleSegments = 16;
		var circle = new Shape();
		circle.moveTo( 0, stroke.thickness/2 );
		for( let theta = Math.PI/ k_circleSegments; theta <= Math.PI * 2; theta += Math.PI/ k_circleSegments )
		{
			circle.lineTo(
				Math.sin( theta ) * stroke.thickness / 2,
				Math.cos( theta ) * stroke.thickness / 2,
			);
		}

		let extrudeSettings:ExtrudeGeometryOptions = 
		{
			steps: threePoints.length * 2,
			extrudePath: curve,
		};

		geometry = new ExtrudeGeometry( circle, extrudeSettings );
	}

	let asset = new GLTFAsset();
	let mesh = new GltfMesh();

	let tmpColor = Color( stroke.color );
	let mat = new Material();
	mat.pbrMetallicRoughness.baseColorFactor =
	[
		tmpColor.red() / 255,
		tmpColor.green() / 255,
		tmpColor.blue() / 255,
		tmpColor.alpha(),
	];

	mesh.material = [ mat ];

	let verts: Vertex[] = [];
	for( let v of geometry.vertices )
	{
		verts.push( makeVert( new vec3( [ v.x, v.y, v.z ] ) ) );
	}

	for( let f of geometry.faces )
	{
		mesh.addFace( verts[ f.a ], verts[ f.b], verts[ f.c ], null, 0 );
	}

	let scene = new Scene();
	let node = new Node();
	node.mesh = mesh;

	scene.addNode( node );
	asset.addScene(scene );
	return exportGLB( asset );
}
