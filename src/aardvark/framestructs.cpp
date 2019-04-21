#include "framestructs.h"

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


}
