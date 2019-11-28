import { AvQuaternion } from '@aardvarkxr/aardvark-shared';
import { quat, vec3 } from '@tlaukkan/tsm';

export function assert( expr: boolean, msg?: string )
{
	if( !expr )
	{
		if( msg )
		{
			throw msg;
		}
		else
		{
			throw "assertion failed";
		}
	}
}

export interface EulerAngles
{
	yaw: number;
	pitch: number;
	roll: number;
}

// This code came from: https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles#Quaternion_to_Euler_Angles_Conversion
export function QuaternionToEulerAngles( q: AvQuaternion): EulerAngles
{
	if( !q )
	{
		return ( { yaw: 0, pitch: 0, roll: 0 } );
	}
	
	let r: EulerAngles = { yaw: 0, pitch: 0, roll: 0 };

    // pitch (x-axis rotation)
    let sinr_cosp = +2.0 * (q.w * q.x + q.y * q.z);
    let cosr_cosp = +1.0 - 2.0 * (q.x * q.x + q.y * q.y);
    r.pitch = Math.atan2(sinr_cosp, cosr_cosp);

    // yaw (y-axis rotation)
    let sinp = +2.0 * (q.w * q.y - q.z * q.x);
    if ( Math.abs( sinp ) >= 1 )
        r.yaw = Math.sign( sinp) * Math.PI / 2; // use 90 degrees if out of range
    else
        r.yaw = Math.asin(sinp);

    // roll (z-axis rotation)
    let siny_cosp = +2.0 * (q.w * q.z + q.x * q.y);
    let cosy_cosp = +1.0 - 2.0 * (q.y * q.y + q.z * q.z);  
    r.roll = Math.atan2(siny_cosp, cosy_cosp);

	return r;
}

export function quatFromAxisAngleRadians( axis: vec3, rad?: number ): quat
{
	if( !rad )
		return new quat( quat.identity.xyzw );

	return quat.fromAxisAngle( axis, rad );
}


export function EulerAnglesToQuaternion( angles: EulerAngles ): AvQuaternion
{
	let qx = quatFromAxisAngleRadians( vec3.right, angles.pitch );
	let qy = quatFromAxisAngleRadians( vec3.up, angles.yaw );
	let qz = quatFromAxisAngleRadians( vec3.forward, angles.roll );

	let q = quat.product( quat.product( qx, qy ), qz );
	return (
	{
		w: q.w,
		x: q.x,
		y: q.y,
		z: q.z,
	} );
}

export function RadiansToDegrees( rad: number ): number
{
	return rad * 180 / Math.PI;
}

export function DegreesToRadians( deg: number ): number
{
	return deg * Math.PI / 180;
}
