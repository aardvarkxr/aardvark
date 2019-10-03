#pragma once

#include <unordered_map>
#include <cmath>
#define GLM_FORCE_RADIANS
#include <glm/gtc/matrix_transform.hpp> 
#include <aardvark/ivrmanager.h>

class CVRManager : public IVrManager
{
public:
	virtual void init() override;
	virtual bool getUniverseFromOrigin( const std::string & originPath, glm::mat4 *universeFromOrigin ) override;
	virtual bool isGrabPressed( EHand hand ) override;
	virtual bool isEditPressed( EHand hand ) override;
	virtual void sentHapticEventForHand( EHand hand, float amplitude, float frequency, float duration ) override;
	virtual void updateOpenVrPoses() override;
	virtual void doInputWork() override;
	virtual void setVargglesTexture(const vr::Texture_t *pTexture) override;
	virtual glm::mat4 getHmdFromUniverse() override { return m_hmdFromUniverse; }
	virtual void getVargglesLookRotation(glm::mat4 &horizontalLooktransform) override;

	vr::VRInputValueHandle_t getDeviceForHand( EHand hand );
	glm::mat4 glmMatFromVrMat( const vr::HmdMatrix34_t & mat );
	void createAndPositionVargglesOverlay();
	void calculateInverseHorizontalLook();
	void destroyVargglesOverlay();

	bool isGrabPressed( vr::VRInputValueHandle_t whichHand );
	bool isEditPressed( vr::VRInputValueHandle_t whichHand );
	void initOpenVR();
	~CVRManager();

protected:
	vr::VRActionSetHandle_t m_actionSet = vr::k_ulInvalidActionSetHandle;
	vr::VRActionHandle_t m_actionGrab = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionEdit = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionHaptic = vr::k_ulInvalidActionHandle;
	vr::VRInputValueHandle_t m_leftHand = vr::k_ulInvalidInputValueHandle;
	vr::VRInputValueHandle_t m_rightHand = vr::k_ulInvalidInputValueHandle;
	bool m_leftPressed = false;
	bool m_rightPressed = false;
	bool m_leftEdit = false;
	bool m_rightEdit = false;

	std::unordered_map<std::string, glm::mat4> m_universeFromOriginTransforms;
	glm::mat4 m_hmdFromUniverse;

	const char* k_pchVargglesOverlayKey = "aardvark.varggles";
	const char* k_pchVargglesOverlayName = "varggles";
	const float k_fOverlayWidthInMeters = 3.f;
	const vr::ETrackingUniverseOrigin c_eTrackingOrigin = vr::TrackingUniverseStanding;
	const vr::HmdMatrix34_t m_vargglesOverlayTransform{
		{
			{1, 0, 0, 0},
			{0, 1, 0, 0},
			{0, 0, 1, -1}
		}
	};
	vr::VROverlayHandle_t m_vargglesOverlay = vr::k_ulOverlayHandleInvalid;
	glm::mat4 m_vargglesLookRotation;

	uint64_t m_lastFrameIndex = 0;
	int m_framesSkipped = 0;
	int64_t m_updatePosesTimeoutMillis = 10;
};

