#pragma once

#include <unordered_map>

#include "ivrmanager.h"

class CVRManager : public IVrManager
{
public:
	virtual void init() override;
	virtual bool getUniverseFromOrigin( const std::string & originPath, glm::mat4 *universeFromOrigin ) override;
	virtual bool isGrabPressed( EHand hand ) override;
	virtual void sentHapticEventForHand( EHand hand, float amplitude, float frequency, float duration ) override;
	virtual void updateOpenVrPoses() override;
	virtual void doInputWork() override;
	virtual glm::mat4 getHmdFromUniverse() override { return m_hmdFromUniverse; }

	vr::VRInputValueHandle_t getDeviceForHand( EHand hand );
	glm::mat4 glmMatFromVrMat( const vr::HmdMatrix34_t & mat );

	bool isGrabPressed( vr::VRInputValueHandle_t whichHand );
	void initOpenVR();

protected:
	vr::VRActionSetHandle_t m_actionSet = vr::k_ulInvalidActionSetHandle;
	vr::VRActionHandle_t m_actionGrab = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionHaptic = vr::k_ulInvalidActionHandle;
	vr::VRInputValueHandle_t m_leftHand = vr::k_ulInvalidInputValueHandle;
	vr::VRInputValueHandle_t m_rightHand = vr::k_ulInvalidInputValueHandle;
	bool m_leftPressed = false;
	bool m_rightPressed = false;

	std::unordered_map<std::string, glm::mat4> m_universeFromOriginTransforms;
	glm::mat4 m_hmdFromUniverse;
};

