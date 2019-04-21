#include "framestructs.h"

#define GB_MATH_IMPLEMENTATION
#include <gb_math/gb_math.h>

namespace aardvark
{


AvVector_t VectorFromProto( const AvVector::Reader & from )
{
	AvVector_t to;
	to.x = from.getX();
	to.y = from.getY();
	to.z = from.getZ();
	return to;
}

AvQuaternion_t QuaternionFromProto( const AvQuaternion::Reader & from )
{
	AvQuaternion_t to;
	to.x = from.getX();
	to.y = from.getY();
	to.z = from.getZ();
	to.w = from.getW();
	return to;
}


AvTransform_t TransformFromProto( const AvTransform::Reader & from )
{
	AvTransform_t to;
	if ( from.hasPosition() )
	{
		to.position = VectorFromProto( from.getPosition() );
	}
	else
	{
		to.position = { 0, 0, 0 };
	}

	if ( from.hasRotation() )
	{
		to.rotation = QuaternionFromProto( from.getRotation() );
	}
	else
	{
		to.rotation = { 0, 0, 0, 1.f };
	}

	if ( from.hasScale() )
	{
		to.scale = VectorFromProto( from.getScale() );
	}
	else
	{
		to.scale = { 1.f, 1.f, 1.f };
	}

	return to;
}


void ProtoFromVector( AvVector::Builder & to, const AvVector_t & from )
{
	to.setX( from.x );
	to.setY( from.y );
	to.setZ( from.z );
}

void ProtoFromQuaternion( AvQuaternion::Builder & to, const AvQuaternion_t & from )
{
	to.setX( from.x );
	to.setY( from.y );
	to.setZ( from.z );
	to.setW( from.w );
}

void ProtoFromTransform( AvTransform::Builder & to, const AvTransform_t & from )
{
	ProtoFromVector( to.initPosition(), from.position );
	ProtoFromQuaternion( to.initRotation(), from.rotation);
	ProtoFromVector( to.initScale(), from.scale );
}


void gbMatFromTransform( gbMat4 *out, const AvTransform_t & in )
{
	gbMat4 matScale;
	gb_mat4_scale( &matScale, gb_vec3( in.scale.x, in.scale.y, in.scale.z ) );
	gbMat4 matRotation;
	gb_mat4_from_quat( &matScale, gb_quat( in.rotation.x, in.rotation.y, in.rotation.z, in.rotation.w ) );

	gb_mat4_mul( out, &matRotation, &matScale );
	out->x.w = in.position.x;
	out->y.w = in.position.y;
	out->z.w = in.position.z;
}


AvTransform_t MultiplyTransforms( const AvTransform_t & l, const AvTransform_t & r )
{
	// TODO(Joe): There's almost certainly a way to do this with less math. Let's leave that for another time.

	gbMat4 matRight, matLeft;
	gbMatFromTransform( &matRight, r );
	gbMatFromTransform( &matLeft, l );

	gbMat4 matResult;
	gb_mat4_mul( &matResult, &matLeft, &matRight );

	AvTransform_t out;
	out.position = { matResult.x.w, matResult.y.w, matResult.z.w };

	gbVec4 v4Scale;
	gb_mat4_mul_vec4( &v4Scale, &matResult, gb_vec4( 1.f, 1.f, 1.f, 1.f ) );

	out.scale = { v4Scale.x, v4Scale.y, v4Scale.z };

	gbQuat qRotRaw, qRot;
	gb_quat_from_mat4( &qRotRaw, &matResult );
	gb_quat_norm( &qRot, qRotRaw );

	out.rotation = { qRot.x, qRot.y, qRot.z, qRot.w };

	return out;
}

}
