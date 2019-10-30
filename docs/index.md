**Aardvark in React**

The @aardvark/aardvark-react package includes many components that make building Aardvark gadgets straightforward.
These are the React components included in the core package:

* AvGadgetSeed
* AvGrabbable
* AvGrabButton
* AvGrabber
* AvHook
* AvModel
* AvModelBoxHandle
* AvOrigin
* AvPanel
* AvPanelAnchor
* AvPoker
* AvSlider
* AvSphereHandle
* AvStandardHook
* AvTransform
* AvTransformControl

There are also useful functions available on the global AvGadget object.

The render function in your own root React component might look something like this:

```
					<AvGrabbable updateHighlight={ this.onGrabbableHighlight } 
						dropOnHooks={ true }>
						<AvSphereHandle radius={0.1} />
						{ charms }
						{ grabbedMode && <AvModel uri="http://aardvark.install/models/bracelet.glb" /> }
						{ this.renderControls() }
					</AvGrabbable>
```

