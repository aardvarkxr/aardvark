#pragma once

#include <unordered_map>
#define GLM_FORCE_RADIANS
#include <glm/gtc/matrix_transform.hpp>
#include <aardvark/ivrmanager.h>

class CVRManager : public IVrManager
{
public:
	virtual void init() override;
	virtual bool getUniverseFromOrigin( const std::string & originPath, glm::mat4 *universeFromOrigin ) override;
	virtual ActionState_t getCurrentActionState( EHand eHand ) const override;
	virtual void sentHapticEventForHand( EHand hand, float amplitude, float frequency, float duration ) override;
	virtual void runFrame( bool* shouldQuit ) override;
	virtual void setVargglesTexture(const vr::Texture_t *pTexture) override;
	virtual glm::mat4 getHmdFromUniverse() override { return m_hmdFromUniverse; }
	virtual void getVargglesLookRotation(glm::mat4 &horizontalLooktransform) override;

	vr::VRInputValueHandle_t getDeviceForHand( EHand hand );
	glm::mat4 glmMatFromVrMat( const vr::HmdMatrix34_t & mat );
	void createAndPositionVargglesOverlay();
	void destroyVargglesOverlay();

	void initOpenVR();
	virtual ~CVRManager();

protected:
	void updateOpenVrPoses();
	void updateCameraActionPose();
	void doInputWork();

	vr::VRActionSetHandle_t m_actionSet = vr::k_ulInvalidActionSetHandle;
	vr::VRActionHandle_t m_actionGrab = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionGrabShowRay = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionGrabMove = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionA = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionB = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionSqueeze = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionDetach = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionHaptic = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionHand = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionCamera = vr::k_ulInvalidActionHandle;
	vr::VRInputValueHandle_t m_leftHand = vr::k_ulInvalidInputValueHandle;
	vr::VRInputValueHandle_t m_rightHand = vr::k_ulInvalidInputValueHandle;
	vr::VRInputValueHandle_t m_head= vr::k_ulInvalidActionHandle;

	ActionState_t m_handActionState[(size_t)EHand::Max];
	ActionState_t m_cameraActionState;
	ActionState_t getActionStateForHand( EHand eHand );

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

