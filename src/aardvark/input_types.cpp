#include <aardvark/input_types.h>
#include <tools/stringtools.h>

static std::map<std::string, std::string> g_xrToVr =
{
	{ "squeeze/click", "grip/click" },
	{ "squeeze/value", "grip/value" },
	{ "squeeze/force", "grip/force" },
	{ "squeeze/touch", "grip/touch" },
	{ "squeeze", "grip" },

	{ "menu/click", "application_menu/click" },
	{ "menu/touch", "application_menu/touch" },
	{ "menu", "application_menu" },
};

static std::map<std::string, std::string> g_interactionProfileToControllerType =
{
	{ "/interaction_profiles/htc/vive_controller", "vive_controller" },
	{ "/interaction_profiles/htc/cosmos_controller", "vive_cosmos_controller" },
	{ "/interaction_profiles/microsoft/hpmotioncontroller", "hpmotioncontroller" },
	{ "/interaction_profiles/microsoft/motion_controller", "holographic_controller" },
	{ "/interaction_profiles/oculus/touch", "oculus_touch" },
	{ "/interaction_profiles/valve/index_controller", "knuckles" },
};

std::string interactionProfileToControllerType( const std::string& interactionProfile )
{
	auto i = g_interactionProfileToControllerType.find( interactionProfile );
	if ( i == g_interactionProfileToControllerType.end() )
		return "";
	else
		return i->second;
}

static std::map<std::string, std::string> g_controllerTypeToInteractionProfile;

std::string controllerTypeToInteractionProfile( const std::string& controllerType )
{
	if ( g_controllerTypeToInteractionProfile.empty() )
	{
		for ( auto& i : g_interactionProfileToControllerType )
		{
			g_controllerTypeToInteractionProfile[ i.second ] = i.first;
		}
	}

	auto i = g_controllerTypeToInteractionProfile.find( controllerType );
	if ( i == g_controllerTypeToInteractionProfile.end() )
		return "";
	else
		return i->second;
}


std::string translateOpenXrPath( const std::string& openVRPath )
{
	std::vector< std::string> vecPathParts = tools::tokenizeString( openVRPath, '/' );
	// /user/hand/right/input/trackpad/click of /user/hand/right/input/trackpad
	if ( ( vecPathParts.size() != 7 && vecPathParts.size() != 6 )
		|| vecPathParts[0] != "" || vecPathParts[1] != "user" 
		|| vecPathParts[2] != "hand" || ( vecPathParts[3] != "left" && vecPathParts[3] != "right" )
		|| vecPathParts[4] != "input" ) 
	{
		// no idea what to do with this path
		return openVRPath;
	}

	std::string component;
	if ( vecPathParts.size() == 6 )
	{
		component = vecPathParts[ 5 ];
	}
	else
	{
		component = vecPathParts[ 5 ] + "/" + vecPathParts[ 6 ];
	}

	auto i = g_xrToVr.find( component );
	if ( i != g_xrToVr.end() )
	{
		return "/user/hand/" + vecPathParts[3] + "/input/" + i->second;
	}
	else
	{
		return "/user/hand/" + vecPathParts[ 3 ] + "/input/" + component;
	}
}

nlohmann::json computeBooleanMode( const std::string inputPath, const std::string& actionPath )
{
	return {
		{ "path", translateOpenXrPath( inputPath ) },
		{ "mode", "button" },
		{ "inputs",
			{
				{ "click",
					{
						{ "output", actionPath }
					} 
				}
			}
		}
	};
}

nlohmann::json computeVector2Mode( const std::string inputPath, const std::string& actionPath )
{
	return {
		{ "path", translateOpenXrPath( inputPath ) },
		{ "mode", "joystick" },
		{ "inputs",
			{
				{ "position",
					{
						{ "output", actionPath }
					}
				}
			}
		}
	};
}


nlohmann::json computeFloatMode( const std::string inputPath, const std::string& actionPath )
{
	return {
		{ "path", translateOpenXrPath( inputPath ) },
		{ "mode", "trigger" },
		{ "inputs",
			{
				{ "value",
					{
						{ "output", actionPath }
					}
				}
			}
		}
	};
}


nlohmann::json toInputFiles( const CInputManifest& m )
{
	nlohmann::json out;
	nlohmann::json& jsm = out[ "action_manifest.json" ] = {};

	auto & actionSets = jsm[ "action_sets" ] = nlohmann::json::array();
	auto & actions = jsm[ "actions" ] = nlohmann::json::array();
	nlohmann::json loc;

	std::map<std::string, nlohmann::json > bindingFiles;

	for ( auto& actionSet : m.m_actionSets )
	{
		std::string actionSetPath = "/actions/" + actionSet.name;

		loc[ actionSetPath ] = actionSet.localizedName;
		actionSets.push_back( { { "name", actionSetPath }, { "usage", "single" } } );

		for ( auto& action : actionSet.actions )
		{
			std::string typeName;
			switch ( action.type )
			{
			case ActionType::Boolean:
				typeName = "boolean";
				break;
			case ActionType::Float:
				typeName = "vector1";
				break;
			case ActionType::Vector2:
				typeName = "vector2";
				break;
			}

			if ( typeName.empty() )
			{
				continue;
			}

			std::string actionPath = actionSetPath + "/in/" + action.name;
			actions.push_back(
				{
					{ "name", actionPath },
					{ "type", typeName }
				} );

			loc[ actionPath ] = action.localizedName;

			for ( auto& binding : action.bindings )
			{
				auto controllerType = interactionProfileToControllerType( binding.interactionProfile );
				if ( controllerType.empty() )
					continue;

				auto file = bindingFiles.find( controllerType );
				if ( file == bindingFiles.end() )
				{
					nlohmann::json newBinding =
					{
						{ "controller_type", controllerType },
						{ "action_manifest_version", 0 },
						{ "category", "steamvr_input" },
						{ "name", "Default bindings for Aardvark gadget" },
						{ "bindings", {} },
					};

					auto res = bindingFiles.insert_or_assign( controllerType, newBinding );
					file = res.first;
				}

				if ( file->second["bindings"][actionSetPath ].is_null() )
				{
					// need to initialize the bindings for this action set
					file->second[ "bindings" ][ actionSetPath ] =
					{
						{ "haptics", nlohmann::json::array() },
						{ "poses", nlohmann::json::array() },
						{ "sources", nlohmann::json::array() },
					};
				}

				nlohmann::json newMode;
				switch ( action.type )
				{
				case ActionType::Boolean:
					newMode = computeBooleanMode( binding.inputPath, actionPath );
					break;
				case ActionType::Float:
					newMode = computeFloatMode( binding.inputPath, actionPath );
					break;
				case ActionType::Vector2:
					newMode = computeVector2Mode( binding.inputPath, actionPath );
					break;
				}

				if ( !newMode.is_null() )
				{
					file->second[ "bindings" ][ actionSetPath ][ "sources" ].push_back( newMode );
				}
			}
		}
	}

	loc[ "language_tag" ] = "en_US";
	jsm[ "localization" ] = { loc };

	for ( auto bindingFile : bindingFiles )
	{
		std::string bindingFileName = bindingFile.first + "_bindings.json";
		out[ bindingFileName ] = bindingFile.second;
		jsm[ "default_bindings" ].push_back(
			{
				{ "binding_url", bindingFileName },
				{ "controller_type", bindingFile.first },
			} );
	}

	return out;
}


