#pragma once

#include <openvr.h>
#include <string>

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>

enum class EHand
{
	Invalid,
	Left,
	Right,
};


inline bool isSameHand( EHand h1, EHand h2 )
{
	return h1 != EHand::Invalid && h1 == h2;
}

class IVrManager
{
public:
	virtual void init() = 0;
	virtual bool getUniverseFromOrigin( const std::string & originPath, glm::mat4 *universeFromOrigin ) = 0;
	virtual bool isGrabPressed( EHand hand ) = 0;
	virtual void sentHapticEventForHand( EHand hand, float amplitude, float frequency, float duration ) = 0;
	virtual void updateOpenVrPoses() = 0;
	virtual void doInputWork() = 0;
	virtual glm::mat4 getHmdFromUniverse() = 0;
};