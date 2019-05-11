#pragma once

#include <string>
#include <vector>
#include "aardvark.capnp.h"

namespace aardvark
{

struct AvVector_t
{
	float x = 0;
	float y = 0;
	float z = 0;
};

struct AvQuaternion_t
{
	float x = 0;
	float y = 0;
	float z = 0;
	float w = 1.f;
};

struct AvColor_t
{
	float r = 1.f;
	float g = 1.f;
	float b = 1.f;
	float a = 1.f;
};

struct AvTransform_t
{
	AvVector_t position = { 0, 0, 0 };
	AvVector_t scale = { 1.f, 1.f, 1.f };
	AvQuaternion_t rotation = { 0, 0, 0, 1.f };
};

struct AvModel_t
{
	AvTransform_t transform;
	std::string sSourceUri;
};

struct AvLight_t
{
	AvTransform_t transform;
	AvColor_t diffuse;
};

struct AvSceneGraphRoot_t
{
	AvNodeRoot::Reader root;
	uint32_t appId;
};

struct AvVisuals_t
{
	std::vector<AvSceneGraphRoot_t> vecSceneGraphs;
};

AvVector_t VectorFromProto( const AvVector::Reader & from );
AvQuaternion_t QuaternionFromProto( const AvQuaternion::Reader & from );
AvTransform_t TransformFromProto( const AvTransform::Reader & from );

void ProtoFromVector( AvVector::Builder & to, const AvVector_t & from );
void ProtoFromQuaternion( AvQuaternion::Builder & to, const AvQuaternion_t & from );
void ProtoFromTransform( AvTransform::Builder & to, const AvTransform_t & from );

AvTransform_t MultiplyTransforms( const AvTransform_t & l, const AvTransform_t & r );
};