#include "vrmanager.h"


#include <iostream>
#include <tools/pathtools.h>
void CVRManager::init()
{
	initOpenVR();

	auto actionManifestPath = tools::GetDataPath() / "input/aardvark_actions.json";
	vr::VRInput()->SetActionManifestPath( actionManifestPath.string().c_str() );
	vr::VRInput()->GetActionSetHandle( "/actions/aardvark", &m_actionSet );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/out/haptic", &m_actionHaptic );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/grab", &m_actionGrab );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/edit", &m_actionEdit );
	vr::VRInput()->GetInputSourceHandle( "/user/hand/left", &m_leftHand );
	vr::VRInput()->GetInputSourceHandle( "/user/hand/right", &m_rightHand );

	createAndPositionVargglesOverlay();
}

CVRManager::~CVRManager()
{
	destroyVargglesOverlay();
}


bool CVRManager::getUniverseFromOrigin( const std::string & originPath, glm::mat4 *universeFromOrigin )
{
	auto i = m_universeFromOriginTransforms.find( originPath );
	if ( i == m_universeFromOriginTransforms.end() )
	{
		*universeFromOrigin = glm::mat4( 1.f );
		return false;
	}
	else
	{
		*universeFromOrigin = i->second;
		return true;
	}
}


bool CVRManager::isGrabPressed( EHand hand )
{
	return isGrabPressed( getDeviceForHand( hand ) );
}

bool CVRManager::isEditPressed( EHand hand )
{
	return isEditPressed( getDeviceForHand( hand ) );
}

glm::mat4 CVRManager::glmMatFromVrMat( const vr::HmdMatrix34_t & mat )
{
	//glm::mat4 r;
	glm::mat4 matrixObj(
		mat.m[0][0], mat.m[1][0], mat.m[2][0], 0.0,
		mat.m[0][1], mat.m[1][1], mat.m[2][1], 0.0,
		mat.m[0][2], mat.m[1][2], mat.m[2][2], 0.0,
		mat.m[0][3], mat.m[1][3], mat.m[2][3], 1.0f
	);
	//for ( uint32_t y = 0; y < 4; y++ )
	//{
	//	for ( uint32_t x = 0; x < 3; x++ )
	//	{
	//		r[x][y] = mat.m[x][y];
	//	}
	//	r[3][y] = y < 3 ? 0.f : 1.f;
	//}
	return matrixObj;
}

void CVRManager::updateOpenVrPoses()
{
	vr::TrackedDevicePose_t rRenderPoses[vr::k_unMaxTrackedDeviceCount];
	//vr::TrackedDevicePose_t rGamePoses[vr::k_unMaxTrackedDeviceCount];
	//vr::VRCompositor()->WaitGetPoses( rRenderPoses, vr::k_unMaxTrackedDeviceCount, rGamePoses, vr::k_unMaxTrackedDeviceCount );
/*
	vr::TrackedDeviceIndex_t unLeftHand = vr::VRSystem()->GetTrackedDeviceIndexForControllerRole( vr::TrackedControllerRole_LeftHand );
	if ( unLeftHand != vr::k_unTrackedDeviceIndexInvalid )
	{
		m_universeFromOriginTransforms["/user/hand/left"] = glmMatFromVrMat( rRenderPoses[unLeftHand].mDeviceToAbsoluteTracking );
	}
	vr::TrackedDeviceIndex_t unRightHand = vr::VRSystem()->GetTrackedDeviceIndexForControllerRole( vr::TrackedControllerRole_RightHand );
	if ( unRightHand != vr::k_unTrackedDeviceIndexInvalid )
	{
		m_universeFromOriginTransforms["/user/hand/right"] = glmMatFromVrMat( rRenderPoses[unRightHand].mDeviceToAbsoluteTracking );
	}
	glm::mat4 universeFromHmd = glmMatFromVrMat( rRenderPoses[vr::k_unTrackedDeviceIndex_Hmd].mDeviceToAbsoluteTracking );
	m_hmdFromUniverse = glm::inverse( universeFromHmd );
	m_universeFromOriginTransforms["/user/head"] = universeFromHmd;
	m_universeFromOriginTransforms["/space/stage"] = glm::mat4( 1.f );
*/

	if (vr::VRCompositor()->CanRenderScene() == false)
		return;

	uint64_t newFrameIndex = 0;
	float lastVSync = 0;

	// TODO PLUTO: make a stopwatch class
	//updatePoseTimer->Restart();

	while (newFrameIndex == m_lastFrameIndex)
	{
		//auto hasTimedOut = updatePoseTimer->Elapsed() >= m_updatePosesTimeoutMillis;
		auto hasTimedOut = false;
		auto vsyncTimesAvailable = vr::VRSystem()->GetTimeSinceLastVsync(&lastVSync, &newFrameIndex);
		if (vsyncTimesAvailable == false || hasTimedOut)
			return;
	}

	if (m_lastFrameIndex + 1 < newFrameIndex)
		m_framesSkipped++;

	m_lastFrameIndex = newFrameIndex;


	float secondsSinceLastVsync = 0;
	uint64_t newLastFrame = 0;
	vr::VRSystem()->GetTimeSinceLastVsync(&secondsSinceLastVsync, &newLastFrame);

	vr::ETrackedPropertyError error = vr::ETrackedPropertyError::TrackedProp_NotYetAvailable;
	float displayFrequency = vr::VRSystem()->GetFloatTrackedDeviceProperty(vr::k_unTrackedDeviceIndex_Hmd, vr::ETrackedDeviceProperty::Prop_DisplayFrequency_Float, &error);
	float frameDuration = 1.0f / displayFrequency;
	float vsyncToPhotons = vr::VRSystem()->GetFloatTrackedDeviceProperty(vr::k_unTrackedDeviceIndex_Hmd, vr::ETrackedDeviceProperty::Prop_SecondsFromVsyncToPhotons_Float, &error);

	float predictedSecondsFromNow = frameDuration - secondsSinceLastVsync + vsyncToPhotons;

	vr::VRSystem()->GetDeviceToAbsoluteTrackingPose(c_eTrackingOrigin, predictedSecondsFromNow, &rRenderPoses[0], vr::k_unMaxTrackedDeviceCount);
	for (vr::TrackedDeviceIndex_t unDevice = 0; unDevice < vr::k_unMaxTrackedDeviceCount; unDevice++)
	{
		vr::ETrackedDeviceClass trackedDeviceClass = vr::VRSystem()->GetTrackedDeviceClass(unDevice);
		if (trackedDeviceClass == vr::ETrackedDeviceClass::TrackedDeviceClass_HMD)
		{
			glm::mat4 universeFromHmd = glmMatFromVrMat(rRenderPoses[vr::k_unTrackedDeviceIndex_Hmd].mDeviceToAbsoluteTracking);
			m_hmdFromUniverse = glm::inverse(universeFromHmd);
			m_universeFromOriginTransforms["/user/head"] = universeFromHmd;
		}
		if (trackedDeviceClass == vr::ETrackedDeviceClass::TrackedDeviceClass_Controller)
		{
			vr::TrackedDeviceIndex_t unLeftHand = vr::VRSystem()->GetTrackedDeviceIndexForControllerRole(vr::TrackedControllerRole_LeftHand);
			if (unLeftHand != vr::k_unTrackedDeviceIndexInvalid)
			{
				m_universeFromOriginTransforms["/user/hand/left"] = glmMatFromVrMat(rRenderPoses[unLeftHand].mDeviceToAbsoluteTracking );
			}
			vr::TrackedDeviceIndex_t unRightHand = vr::VRSystem()->GetTrackedDeviceIndexForControllerRole(vr::TrackedControllerRole_RightHand);
			if (unRightHand != vr::k_unTrackedDeviceIndexInvalid)
			{
				m_universeFromOriginTransforms["/user/hand/right"] = glmMatFromVrMat(rRenderPoses[unRightHand].mDeviceToAbsoluteTracking);
			}
		}
	}
	m_universeFromOriginTransforms["/space/stage"] = glm::mat4(1.f);

	// TODO PlutoVR: throw out inversion after testing
	calculateInverseHorizontalLook();
}

static void printMat(glm::mat4& e)
{
	std::cout << "===================" << std::endl;
	for (int i = 0; i < 4; i++) {
		std::cout << "( ";
		for (int j = 0; j < 4; j++) {
			std::cout << e[i][j] << " ";
		}
		std::cout << ")" << std::endl;
	}
	std::cout << "===================" << std::endl;
}


void CVRManager::calculateInverseHorizontalLook() 
{
	m_vargglesHorizontallyInvertedLook = m_universeFromOriginTransforms["/user/head"];
	m_vargglesHack = glm::mat4(1.0f);

	auto t = glm::translate(glm::mat4(1.0f), glm::vec3(1, 0, 0));

	printMat(t);
	
	glm::mat4 e(
		{ 1.f, 2.f, 3.f, 4.f },
		{ 5.f, 6.f, 7.f, 8.f },
		{ 9.f, 10.f, 11.f, 12.f },
		{ 13.f, 14.f, 15.f, 16.f }
	);

	glm::mat4 b(
		{ 11.f, 12.f, 13.f, 14.f },
		{ 15.f, 16.f, 17.f, 18.f },
		{ 19.f, 20.f, 21.f, 22.f },
		{ 23.f, 24.f, 25.f, 26.f }
	);

	glm::mat4 m = e * b;

	//printMat(m);
}

void CVRManager::getVargglesLookRotation(glm::mat4& horizontalLooktransform, glm::mat4& hack)
{
	horizontalLooktransform = m_vargglesHorizontallyInvertedLook;
	hack = m_vargglesHack;
}

bool GetAction( vr::VRActionHandle_t action, vr::VRInputValueHandle_t whichHand )
{
	vr::InputDigitalActionData_t actionData;
	vr::EVRInputError err = vr::VRInput()->GetDigitalActionData( action, &actionData,
		sizeof( actionData ), whichHand );
	if ( vr::VRInputError_None != err )
		return false;

	return actionData.bActive && actionData.bState;
}


void CVRManager::doInputWork()
{
	vr::VRActiveActionSet_t actionSet[2] = {};
	actionSet[0].ulActionSet = m_actionSet;
	actionSet[0].ulRestrictedToDevice = m_leftHand;
	actionSet[1].ulActionSet = m_actionSet;
	actionSet[1].ulRestrictedToDevice = m_rightHand;

	vr::EVRInputError err = vr::VRInput()->UpdateActionState( actionSet, sizeof( vr::VRActiveActionSet_t ), 2 );

	m_leftPressed	= GetAction( m_actionGrab, m_leftHand );
	m_rightPressed	= GetAction( m_actionGrab, m_rightHand );
	m_leftEdit		= GetAction( m_actionEdit, m_leftHand );
	m_rightEdit		= GetAction( m_actionEdit, m_rightHand );
}

bool CVRManager::isGrabPressed( vr::VRInputValueHandle_t whichHand )
{
	if ( whichHand == m_leftHand )
	{
		return m_leftPressed;
	}
	else if ( whichHand == m_rightHand )
	{
		return m_rightPressed;
	}
	else
	{
		return false;
	}
}

bool CVRManager::isEditPressed( vr::VRInputValueHandle_t whichHand )
{
	if ( whichHand == m_leftHand )
	{
		return m_leftEdit;
	}
	else if ( whichHand == m_rightHand )
	{
		return m_rightEdit;
	}
	else
	{
		return false;
	}
}

vr::VRInputValueHandle_t CVRManager::getDeviceForHand( EHand hand )
{
	switch ( hand )
	{
	case EHand::Left:
		return m_leftHand;
	case EHand::Right:
		return m_rightHand;
	default:
		return vr::k_ulInvalidInputValueHandle;
	}
}



void CVRManager::sentHapticEventForHand( EHand hand, float amplitude, float frequency, float duration )
{
	vr::VRInputValueHandle_t device = getDeviceForHand( hand );
	if ( device != vr::k_ulInvalidInputValueHandle )
	{
		vr::VRInput()->TriggerHapticVibrationAction(
			m_actionHaptic,
			0, duration, frequency, amplitude,
			device );
	}
}

void CVRManager::initOpenVR()
{
	vr::EVRInitError vrErr;
	vr::VR_Init(&vrErr, vr::VRApplication_Overlay);
	if (vrErr != vr::VRInitError_None)
	{
		std::cout << "FATAL: VR_Init failed" << std::endl;
		return;
	}

	vr::VRCompositor()->SetTrackingSpace(c_eTrackingOrigin);
}

void CVRManager::createAndPositionVargglesOverlay()
{
	// create, early out if error
	if (vr::VROverlay()->CreateOverlay(k_pchVargglesOverlayKey, k_pchVargglesOverlayName, &m_vargglesOverlay) != vr::VROverlayError_None)
	{
		std::cout << "ERROR: CreateOverlay failed" << std::endl;
		m_vargglesOverlay = vr::k_ulOverlayHandleInvalid;
		return;
	}

	if (vr::VROverlay()->SetOverlayFlag(m_vargglesOverlay, vr::VROverlayFlags_Panorama, false) != vr::VROverlayError_None)
	{
		std::cout << "ERROR: StereoPanorama failed" << std::endl;
		return;
	}
	
	if (vr::VROverlay()->SetOverlayFlag(m_vargglesOverlay, vr::VROverlayFlags_StereoPanorama, true) != vr::VROverlayError_None)
	{
		std::cout << "ERROR: StereoPanorama failed" << std::endl;
		return;
	}

	if (vr::VROverlay()->SetOverlayWidthInMeters(m_vargglesOverlay, k_fOverlayWidthInMeters) != vr::VROverlayError_None)
	{
		std::cout << "ERROR: SetOverlayWidth failed" << std::endl;
		return;
	}

	if (vr::VROverlay()->SetOverlayTransformTrackedDeviceRelative(m_vargglesOverlay, vr::k_unTrackedDeviceIndex_Hmd, &m_vargglesOverlayTransform) != vr::VROverlayError_None)
	{
		std::cout << "ERROR: SetOverlayTransform failed" << std::endl;
		return;
	}
}

void CVRManager::destroyVargglesOverlay()
{
	vr::VROverlay()->DestroyOverlay(m_vargglesOverlay);
	m_vargglesOverlay = vr::k_ulOverlayHandleInvalid;
}

void CVRManager::setVargglesTexture(const vr::Texture_t *pTexture)
{
	if (m_vargglesOverlay == vr::k_ulOverlayHandleInvalid)
	{
		std::cout << "ERROR: SetTexture on invalid overlay" << std::endl;
		return;
	}

	if (vr::VROverlay()->SetOverlayTexture(m_vargglesOverlay, pTexture) != vr::VROverlayError_None)
	{
		std::cout << "ERROR: SetTexture Failed on Varggles Overlay" << std::endl;
		return;
	}

	if (vr::VROverlay()->ShowOverlay(m_vargglesOverlay) != vr::VROverlayError_None)
		std::cout << "ERROR: ShowOverlay failed" << std::endl;
}