/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./default_poker/src/default_poker_main.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./common/aardvark.ts":
/*!****************************!*\
  !*** ./common/aardvark.ts ***!
  \****************************/
/*! exports provided: Av */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"Av\", function() { return Av; });\nfunction Av() {\r\n    return window.aardvark;\r\n}\r\n\n\n//# sourceURL=webpack:///./common/aardvark.ts?");

/***/ }),

/***/ "./default_poker/src/default_poker_main.ts":
/*!*************************************************!*\
  !*** ./default_poker/src/default_poker_main.ts ***!
  \*************************************************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _common_aardvark__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../common/aardvark */ \"./common/aardvark.ts\");\n\r\nvar myApp = Object(_common_aardvark__WEBPACK_IMPORTED_MODULE_0__[\"Av\"])().createApp(\"default_poker\");\r\nvar shouldHighlight = false;\r\nfunction updateSceneGraph() {\r\n    var sceneContext = myApp.startSceneContext();\r\n    var EAvSceneGraphNodeType = sceneContext.type;\r\n    sceneContext.startNode(11, \"pokerorigin\", EAvSceneGraphNodeType.Origin);\r\n    sceneContext.setOriginPath(\"/user/hand/right\");\r\n    sceneContext.startNode(12, \"pokerxform\", EAvSceneGraphNodeType.Transform);\r\n    sceneContext.setScale(0.01, 0.01, 0.01);\r\n    sceneContext.startNode(13, \"pokermodel\", EAvSceneGraphNodeType.Model);\r\n    if (shouldHighlight) {\r\n        sceneContext.setModelUri(\"file:///e:/homedev/aardvark/data/models/sphere/sphere_highlight.glb\");\r\n    }\r\n    else {\r\n        sceneContext.setModelUri(\"file:///e:/homedev/aardvark/data/models/sphere/sphere.glb\");\r\n    }\r\n    sceneContext.finishNode();\r\n    sceneContext.finishNode();\r\n    sceneContext.startNode(14, \"poker\", EAvSceneGraphNodeType.Poker);\r\n    sceneContext.finishNode();\r\n    sceneContext.finishNode();\r\n    sceneContext.finish();\r\n}\r\nfunction proximityUpdate(proxArray) {\r\n    var oElem = document.getElementById('stuff');\r\n    var oldHighlight = shouldHighlight;\r\n    if (proxArray.length == 0) {\r\n        oElem.innerHTML = \"No prox\";\r\n        shouldHighlight = false;\r\n    }\r\n    else {\r\n        oElem.innerHTML = \"\"\r\n            + proxArray[0].x.toFixed(2) + \", \"\r\n            + proxArray[0].y.toFixed(2) + \", \"\r\n            + proxArray[0].distance.toFixed(2);\r\n        shouldHighlight = true;\r\n    }\r\n    if (oldHighlight != shouldHighlight) {\r\n        updateSceneGraph();\r\n    }\r\n}\r\nupdateSceneGraph();\r\nmyApp.registerPokerHandler(14, proximityUpdate);\r\n\n\n//# sourceURL=webpack:///./default_poker/src/default_poker_main.ts?");

/***/ })

/******/ });