#include "vrmanager.h"

#include <iostream>
#include <tools/pathtools.h>

#include <glm/gtc/matrix_transform.hpp>

void CVRManager::init()
{
	initOpenVR();

	auto actionManifestPath = tools::GetDataPath() / "input/aardvark_actions.json";
	vr::VRInput()->SetActionManifestPath( actionManifestPath.string().c_str() );
	vr::VRInput()->GetActionSetHandle( "/actions/aardvark", &m_actionSet );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/out/haptic", &m_actionHaptic );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/grab", &m_actionGrab );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/grab_show_ray", &m_actionGrabShowRay );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/move_grabbed", &m_actionGrabMove );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/a", &m_actionA );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/b", &m_actionB );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/squeeze", &m_actionSqueeze);
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/detach", &m_actionDetach );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/hand", &m_actionHand );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/camera", &m_actionCamera );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/left_anim", &m_actionLeftSkeleton );
	vr::VRInput()->GetActionHandle( "/actions/aardvark/in/right_anim", &m_actionRightSkeleton );
	vr::VRInput()->GetInputSourceHandle( "/user/hand/left", &m_leftHand );
	vr::VRInput()->GetInputSourceHandle( "/user/hand/right", &m_rightHand );
	vr::VRInput()->GetInputSourceHandle("/user/head", &m_head);

	createAndPositionVargglesOverlay();
}

CVRManager::~CVRManager()
{
	destroyVargglesOverlay();
	if ( vr::VRSystem() )
	{
		vr::VR_Shutdown();
	}
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

void CVRManager::runFrame( bool *shouldQuit )
{
	updateOpenVrPoses();
	doInputWork();
	updateCameraActionPose();

	vr::VREvent_t e;
	while ( vr::VRSystem()->PollNextEvent( &e, sizeof( e ) ) )
	{
		switch ( e.eventType )
		{
		case vr::VREvent_Quit:
			*shouldQuit = true;
			break;
		}
	}

	if ( !shouldRender() )
	{
		vr::VROverlay()->HideOverlay( m_vargglesOverlay );
	}
}

void CVRManager::updateOpenVrPoses()
{
	vr::TrackedDevicePose_t rRenderPoses[vr::k_unMaxTrackedDeviceCount];
	if (vr::VRCompositor()->CanRenderScene() == false)
		return;

	uint64_t newFrameIndex = 0;
	float lastVSync = 0;

	while (newFrameIndex == m_lastFrameIndex)
	{
		auto vsyncTimesAvailable = vr::VRSystem()->GetTimeSinceLastVsync(
			&lastVSync, &newFrameIndex);

		if (vsyncTimesAvailable == false)
			return;
	}

	if (m_lastFrameIndex + 1 < newFrameIndex)
		m_framesSkipped++;

	m_lastFrameIndex = newFrameIndex;
	float secondsSinceLastVsync = 0;
	uint64_t newLastFrame = 0;
	vr::VRSystem()->GetTimeSinceLastVsync(&secondsSinceLastVsync, &newLastFrame);

	vr::ETrackedPropertyError error;
	float displayFrequency = vr::VRSystem()->GetFloatTrackedDeviceProperty(
		vr::k_unTrackedDeviceIndex_Hmd,
		vr::ETrackedDeviceProperty::Prop_DisplayFrequency_Float,
		&error);

	float frameDuration = 1.0f / displayFrequency;
	float vsyncToPhotons = vr::VRSystem()->GetFloatTrackedDeviceProperty(
		vr::k_unTrackedDeviceIndex_Hmd, 
		vr::ETrackedDeviceProperty::Prop_SecondsFromVsyncToPhotons_Float, 
		&error);

	float predictedSecondsFromNow = frameDuration - secondsSinceLastVsync + vsyncToPhotons;
	vr::VRSystem()->GetDeviceToAbsoluteTrackingPose(
		c_eTrackingOrigin, 
		predictedSecondsFromNow, 
		&rRenderPoses[0], 
		vr::k_unMaxTrackedDeviceCount);

	glm::mat4 universeFromHmd = glmMatFromVrMat(
		rRenderPoses[vr::k_unTrackedDeviceIndex_Hmd].mDeviceToAbsoluteTracking);

	m_universeFromOriginTransforms["/user/head"] = universeFromHmd;
	m_universeFromOriginTransforms["/space/stage"] = glm::mat4(1.f);

	m_hmdFromUniverse = glm::inverse(universeFromHmd);
	m_vargglesLookRotation = glm::scale(m_hmdFromUniverse, glm::vec3(1, 1, -1));
}

void CVRManager::getVargglesLookRotation(glm::mat4& horizontalLooktransform)
{
	horizontalLooktransform = m_vargglesLookRotation;
}


bool CVRManager::shouldRender()
{
	return !vr::VROverlay()->IsDashboardVisible();
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

glm::vec2 GetActionVector2( vr::VRActionHandle_t action, vr::VRInputValueHandle_t whichHand )
{
	vr::InputAnalogActionData_t actionData;
	vr::EVRInputError err = vr::VRInput()->GetAnalogActionData( action, &actionData,
		sizeof( actionData ), whichHand );
	if ( vr::VRInputError_None != err || !actionData.bActive )
		return glm::vec2();

	glm::vec2 res;
	res.x = actionData.x;
	res.y = actionData.y;
	return res;
}

std::vector<JointTransform_t> GetSkeletonAction( vr::VRActionHandle_t action )
{
	vr::InputSkeletalActionData_t actionData;
	vr::EVRInputError err = vr::VRInput()->GetSkeletalActionData( action, &actionData, sizeof( actionData ) );
	if ( err != vr::VRInputError_None || !actionData.bActive )
		return {};

	vr::VRBoneTransform_t transforms[ 31 ];
	err = vr::VRInput()->GetSkeletalBoneData( action, vr::VRSkeletalTransformSpace_Parent, vr::VRSkeletalMotionRange_WithoutController,
		transforms, 31 );
	if ( err != vr::VRInputError_None )
		return {};

	std::vector<JointTransform_t> output;
	output.reserve( 31 );
	for( auto & t : transforms )
	{ 
		JointTransform_t tOut;
		tOut.rotation = glm::quat( t.orientation.w, t.orientation.x, t.orientation.y, t.orientation.z );
		tOut.translation = glm::vec3( t.position.v[ 0 ], t.position.v[ 1 ], t.position.v[ 2 ] );
		output.push_back( tOut );
	}

	return output;
}

glm::mat4 JointToMat4( const JointTransform_t& joint )
{
	return glm::translate( glm::mat4( 1.0f ), joint.translation ) 
		* glm::mat4( const_cast<glm::quat&>( joint.rotation ) );
}

void CVRManager::doInputWork()
{
	vr::VRActiveActionSet_t actionSet[2] = {};
	actionSet[0].ulActionSet = m_actionSet;
	actionSet[0].ulRestrictedToDevice = m_leftHand;
	actionSet[1].ulActionSet = m_actionSet;
	actionSet[1].ulRestrictedToDevice = m_rightHand;

	vr::EVRInputError err = vr::VRInput()->UpdateActionState( actionSet, sizeof( vr::VRActiveActionSet_t ), 2 );

	this->m_handActionState[(int)EHand::Left] = getActionStateForHand( EHand::Left );
	this->m_handActionState[(int)EHand::Right] = getActionStateForHand( EHand::Right );

	m_universeFromOriginTransforms["/user/hand/left"] = m_handActionState[(int)EHand::Left].universeFromHand;
	m_universeFromOriginTransforms["/user/hand/right"] = m_handActionState[(int)EHand::Right].universeFromHand;

	m_animationSource[ "/user/hand/left" ] = GetSkeletonAction( m_actionLeftSkeleton );
	m_animationSource[ "/user/hand/right" ] = GetSkeletonAction( m_actionRightSkeleton );

	vr::InputPoseActionData_t poseData;
	if ( vr::VRInputError_None == vr::VRInput()->GetPoseActionDataForNextFrame( m_actionLeftSkeleton, vr::TrackingUniverseStanding,
		&poseData, sizeof( poseData ), vr::k_ulInvalidInputValueHandle ) && poseData.bActive && poseData.pose.bPoseIsValid )
	{
		m_universeFromOriginTransforms[ "/user/hand/left/raw" ] = glmMatFromVrMat( poseData.pose.mDeviceToAbsoluteTracking );
	}
	if ( vr::VRInputError_None == vr::VRInput()->GetPoseActionDataForNextFrame( m_actionRightSkeleton, vr::TrackingUniverseStanding,
		&poseData, sizeof( poseData ), vr::k_ulInvalidInputValueHandle ) && poseData.bActive && poseData.pose.bPoseIsValid )
	{
		m_universeFromOriginTransforms[ "/user/hand/right/raw" ] = glmMatFromVrMat( poseData.pose.mDeviceToAbsoluteTracking );
	}

	m_universeFromOriginTransforms[ "/user/hand/left/root_bone" ] = 
		m_universeFromOriginTransforms[ "/user/hand/left/raw" ] * JointToMat4( m_animationSource[ "/user/hand/left" ][1] );
	m_universeFromOriginTransforms[ "/user/hand/right/root_bone" ] = 
		m_universeFromOriginTransforms[ "/user/hand/right/raw" ] * JointToMat4( m_animationSource[ "/user/hand/right" ][1] );
}

void CVRManager::updateCameraActionPose()
{
	vr::VRActiveActionSet_t activeActionSet;
	activeActionSet.ulActionSet = m_actionSet;
	activeActionSet.ulRestrictedToDevice = vr::k_ulInvalidInputValueHandle;

	vr::EVRInputError err = vr::VRInput()->UpdateActionState(&activeActionSet, sizeof(vr::VRActiveActionSet_t), 1);

	vr::InputPoseActionData_t poseData;
	if (vr::VRInputError_None == vr::VRInput()->GetPoseActionDataForNextFrame(m_actionCamera, vr::TrackingUniverseStanding,
		&poseData, sizeof(poseData), activeActionSet.ulRestrictedToDevice) && poseData.bActive && poseData.pose.bPoseIsValid )
	{
		m_cameraActionState.universeFromCamera = glmMatFromVrMat(poseData.pose.mDeviceToAbsoluteTracking);
	}
	else
	{
		m_cameraActionState.universeFromCamera = m_universeFromOriginTransforms["/user/head"];
	}

	this->m_cameraActionState = getActionStateForHand(EHand::Left);
	m_universeFromOriginTransforms["/user/camera"] = m_cameraActionState.universeFromCamera;
}

CVRManager::ActionState_t CVRManager::getActionStateForHand( EHand eHand )
{
	vr::VRInputValueHandle_t pathDevice = getDeviceForHand( eHand );
	ActionState_t state;
	state.a = GetAction( m_actionA, pathDevice );
	state.b = GetAction( m_actionB, pathDevice );
	state.grab = GetAction( m_actionGrab, pathDevice );
	state.grabShowRay = GetAction( m_actionGrabShowRay, pathDevice );
	state.grabMove = GetActionVector2( m_actionGrabMove, pathDevice );
	state.squeeze = GetAction( m_actionSqueeze, pathDevice );
	state.detach = GetAction( m_actionDetach, pathDevice );

	vr::InputPoseActionData_t poseData;
	if (vr::VRInputError_None == vr::VRInput()->GetPoseActionDataForNextFrame(m_actionHand, vr::TrackingUniverseStanding,
		&poseData, sizeof(poseData), pathDevice) && poseData.bActive && poseData.pose.bPoseIsValid )
	{
		state.universeFromHand = glmMatFromVrMat(poseData.pose.mDeviceToAbsoluteTracking);
	}
	else
	{
		state.universeFromHand = glm::mat4(1.f);
	}

	return state;
}


CVRManager::ActionState_t CVRManager::getCurrentActionState( EHand eHand ) const
{
	int nHand = (int)eHand;
	if ( nHand < 0 && nHand >= (int)EHand::Max )
		return ActionState_t();
	return this->m_handActionState[nHand];
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
	if (vr::VROverlay()->CreateOverlay(
			k_pchVargglesOverlayKey, 
			k_pchVargglesOverlayName, 
			&m_vargglesOverlay) 
		!= vr::VROverlayError_None)
	{
		std::cout << "ERROR: CreateOverlay failed" << std::endl;
		m_vargglesOverlay = vr::k_ulOverlayHandleInvalid;
		return;
	}

	if (vr::VROverlay()->SetOverlayFlag(
			m_vargglesOverlay, 
			vr::VROverlayFlags_Panorama, 
			false) 
		!= vr::VROverlayError_None)
	{
		std::cout << "ERROR: StereoPanorama failed" << std::endl;
		return;
	}
	
	if (vr::VROverlay()->SetOverlayFlag(
			m_vargglesOverlay, 
			vr::VROverlayFlags_StereoPanorama, 
			true) 
		!= vr::VROverlayError_None)
	{
		std::cout << "ERROR: StereoPanorama failed" << std::endl;
		return;
	}

	if (vr::VROverlay()->SetOverlayWidthInMeters(m_vargglesOverlay, k_fOverlayWidthInMeters) 
		!= vr::VROverlayError_None)
	{
		std::cout << "ERROR: SetOverlayWidth failed" << std::endl;
		return;
	}

	if (vr::VROverlay()->SetOverlayTransformTrackedDeviceRelative(
			m_vargglesOverlay, 
			vr::k_unTrackedDeviceIndex_Hmd, 
			&m_vargglesOverlayTransform) 
		!= vr::VROverlayError_None)
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

bool CVRManager::getAnimationSource( const std::string& animationSource, std::vector<JointTransform_t>* parentFromJoint )
{
	auto i = m_animationSource.find( animationSource );
	if ( i == m_animationSource.end() )
		return false;

	*parentFromJoint = i->second;
	return true;
}

bool CVRManager::getSkeletonInfo( const std::string& skeletonPath, std::vector<JointInfo_t>* jointInfo )
{
	vr::VRActionHandle_t action = vr::k_ulInvalidActionHandle;
	if ( skeletonPath == "/user/hand/left" )
	{
		action = m_actionLeftSkeleton;
	}
	else if( skeletonPath == "/user/hand/right" )
	{
		action = m_actionRightSkeleton;
	}
	else
	{
		return false;
	}

	uint32_t boneCount;
	if ( vr::VRInputError_None != vr::VRInput()->GetBoneCount( action, &boneCount ) )
		return false;

	jointInfo->resize( boneCount );

	std::vector<vr::BoneIndex_t> parents;
	parents.resize( boneCount );
	if ( vr::VRInputError_None != vr::VRInput()->GetBoneHierarchy( action, &parents[ 0 ], boneCount ) )
	{
		return false;
	}

	for ( uint32_t i = 0; i < boneCount; i++ )
	{
		(*jointInfo)[ i ].parentIndex = parents[ i ];
	}

	// joint radius defaults to 1cm. Fix some up?

	return true;
}

