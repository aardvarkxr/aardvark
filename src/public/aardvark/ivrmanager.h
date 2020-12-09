#pragma once

#include <openvr.h>
#include <string>

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>

enum class EHand
{
	Invalid = -1,
	Left,
	Right,
	Max
};


inline bool isSameHand( EHand h1, EHand h2 )
{
	return h1 != EHand::Invalid && h1 == h2;
}

class IVrManager
{
public:
	struct ActionState_t
	{
		bool grab = false;
		bool grabShowRay = false;
		bool a = false;
		bool b = false;
		bool squeeze = false;
		bool detach = false;
		glm::vec2 grabMove = {};

		glm::mat4 universeFromHand;
		glm::mat4 universeFromCamera;
	};

	virtual ~IVrManager() {}
	virtual void init() = 0;
	virtual bool getUniverseFromOrigin( const std::string & originPath, glm::mat4 *universeFromOrigin ) = 0;
	virtual ActionState_t getCurrentActionState( EHand eHand ) const = 0;
	virtual void sentHapticEventForHand( EHand hand, float amplitude, float frequency, float duration ) = 0;
	virtual void runFrame( bool* shouldQuit ) = 0;
	virtual void getVargglesLookRotation(glm::mat4& horizontalLooktransform) = 0;
	virtual void setVargglesTexture(const vr::Texture_t* pTexture) = 0;
	virtual bool getAnimationSource( const std::string& animationSource, std::vector<glm::mat4>* parentFromJoint ) = 0;
	virtual glm::mat4 getHmdFromUniverse() = 0;
	virtual bool shouldRender() = 0;
};