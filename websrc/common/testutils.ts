import { vec3, mat4, vec4 } from '@tlaukkan/tsm';

export {}

declare global {
	namespace jest {
	  interface Matchers<R> {
		toHavePosition( expected: vec3 ): R;
		toBeVec3( expected: vec3 ): R;
	}
	}
  }

function toHavePosition( received: mat4, expected: vec3 )
{
	let pos = received.multiplyVec4( new vec4( [0, 0, 0, 1] ) );
	if( expected.equals( new vec3( pos.xyz ), 0.001 ) )
	{
		return (
			{
				message: () =>
					`expected ${ pos.xyz } to be `
						+`${ expected.xyz }`,
				pass: true,
			} );
	}
	else
	{
		return (
			{
				message: () =>
					`expected ${ pos.xyz } to not be `
						+`${ expected.xyz }`,
				pass: false,
			} );
	}
}

function toBeVec3( received: vec3, expected: vec3 )
{
	if( expected.equals( received, 0.001 ) )
	{
		return (
			{
				message: () =>
					`expected ${ received.xyz } to not be `
						+`${ expected.xyz }`,
				pass: true,
			} );
	}
	else
	{
		return (
			{
				message: () =>
					`received ${ received.xyz }, but expected `
						+`${ expected.xyz }`,
				pass: false,
			} );
	}
}

expect.extend({
	toHavePosition,
	toBeVec3,
});
