import { AvNodeTransform } from '@aardvarkxr/aardvark-shared';

export interface gestureVolumes
{
	leftHandTop: AvNodeTransform,
	leftHandBottom: AvNodeTransform,
	rightHandTop: AvNodeTransform,
	rightHandBottom: AvNodeTransform
}

let volumeDictionary = new Map<string, gestureVolumes>();
volumeDictionary.set("/interaction_profiles/valve/index_controller", {
	leftHandTop: {position: {x: 0, y:-0.13, z:0.13}},
	leftHandBottom: {position: {x: 0, y:-0.24, z:0.23}},
	rightHandTop: {position: {x: 0, y:-0.13, z:0.13}},
	rightHandBottom: {position: {x: 0, y:0, z:0.13}},

});

volumeDictionary.set("default", {
	leftHandTop: {position: {x: 0, y:-0.13, z:0.13}},
	leftHandBottom: {position: {x: 0, y:-0.24, z:0.23}},
	rightHandTop: {position: {x: 0, y:-0.13, z:0.13}},
	rightHandBottom: {position: {x: 0, y:0, z:0.13}},

});

volumeDictionary.set("/interaction_profiles/oculus/touch", {
	leftHandTop: {position: {x: 0, y: -0.04, z: 0.09}},
	leftHandBottom: {position: {x: 0, y: -0.09, z: 0.2}},
	rightHandTop: {position: {x: 0, y: -0.07, z: 0.1}},
	rightHandBottom: {position: {x: 0, y: 0.04, z: 0.1}},
});

volumeDictionary.set("/interaction_profiles/microsoft/hpmotioncontroller", {
	leftHandTop: {position: 	{ 	x: -0.02, 	y:  0.01, 	z: 0.08	}},
	leftHandBottom: {position: 	{	x: 0.02, 	y: -0.12,	z: 0.08	}},
	rightHandTop: {position: 	{	x: 0, 		y: -0.13, 	z: 0.08	}},
	rightHandBottom: {position: {	x: 0, 		y: 0, 		z: 0.08	}},
});

/*
	each dictionary stores a set of coords for volumes on the users hands, if you want to add you're own for another controller it would probably be a good idea
	to create a gadget to test volumes in so you can iterate faster
*/

export {volumeDictionary};




