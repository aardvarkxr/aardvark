---
layout: post
title: Aardvark interfaces
---
# What are interfaces and entities?

Aardvark provides a general-purpose mechanism to allow the gadgets and their subcomponents to communicate and provide transforms for each other.
Gadgets participate in this system by including **interface entities** (AvInterfaceEntity) in their scene graphs, each of which expose one or more interface.
When Aardvark detects that an entity that transmits a given named interface intersects with an entity that receives that same interface, it notifies both entities and provides a conduit for those two entities to interact.

Interface names are strings of the form <interface>@<version. 
An entity can transmit or receive as many interfaces as it likes, including multiple versions of the same interface. 
The interface name, with version, declares that the transmitter and receiver entities share a common protocol that they can use to coordinate with each other.
Aardvark's job is to match up those like-minded entities so they can provide whatever functionality the interface itself is actually intended to provide.

## Examples of interfaces

* `aardvark-grab@1` - Allows the user to move gadgets or subcomponents of gadgets around. It is transmitted by each of the users hands and received by anything moveable, including `AvStandardGrabbable`.
* `aardvark-panel@1` - Allows the user to interact with 2D panels or other receivers that have an "activate" action of some kind. It is transmitted by each of the user's hands and received by anything activatable, including `AvPanel` (with the interactive prop set to true) and `AvGrabButton`.
* `aardvark-container@1` - Allows moveable entities to be held by other enties. It is transmitted by the moveable and received by the container, of which `SimpleContainerComponent` is an example.
* `color_picker@1` - Allows a receiver to set the selected color of a transmitter. This is used by the paint buckets and markers in the whiteboard example.
* `surface-drawing@1` - Allows a transmitter to draw on surface provided by a receiver. This is used by the markers and the drawing surface in the whiteboard example.

# Defining an entity

Entities are defined by the `AvInterfaceEntity` component in Aardvark, or at a slightly higher level by `AvComposedEntity`.
Each entity defines the following properties:

* `transmits` - This is a list of interface names and the matching processor for that kind of interface. The processor will be called when a new interface of that kind is established with another entity. Transmitted interfaces are considered in the order in which they appear, so if a receiver and transmitter share more than one interface, Aardvark will pick the one that appears first in the transmitter's list.
* `receives` - This is a list of interface names and the matching processor for that kind of interface. The processor will be called when a new interface of that kind is established with another entity. 
* `priority` - The priority to use when breaking a tie between multiple simultaneous intersections. The entity with the highest priority number is selected.
* `volume` - The physical volume that represents this entity. The volume will be positioned at the entities transform from the scene graph. For certain kinds of interfaces, it can be useful to define infinite (intersect everything) or empty (intersect nothing) volumes on some of the entities.
* `parent` - The endpoint address of the node that provide the transform for this entity. If this is not specified, the entity will be positioned according to its scene graph parent.
* `wantsTransforms` - If this is true, the entity will receive a stream of transforms on its `onTransform` callback, if any. 
* `interfaceLocks` - The first time an entity is submitted as part of a scene graph, Aardvark uses this list of initial locks to attempt to establish interfaces with the specified receivers. Entries in this field are only valid for interfaces that are transmitted by this entity. This field is unused after the initial submission of the entity.

Aardvark will evaluate the transforms and volumes of all unlocked transmitters looking for matches with receivers that share at least one interface with the transmitter. 
When such a match is found, the transmitter and receiver callback are called with an ActiveInterface object that represents the active connection between the two entities. 

ActiveInterface defines the following methods and properties:
* `self` - The entities own endpoint address. 
* `peer` - The endpoint address of the other entity in the interface. I.e. if the entity being called back is the transmitter, this will be the endpoint address of the receiver and vice versa.
* `interface` - The name of the interface
* `role` - The role of the local entity in the interface. This will be either InterfaceRole.Transmitter or InterfaceRole.Receiver.
* `transmitterFromReceiver` - The transform from the receiver's coordinate system to the transmitter's coordinate system.
* `selfFromPeer` - The transform from the peer's coordinate system to the local entity's coordinate system. This will either be the same as `transmitterFromReceiver` or its inverse depending on whether the local entity is the transmitter or the receiver.
* `params` - If this interface was established by an initial interface lock on the transmitter, this will be the params object from that lock.
* `lock()` - The transmitter can call this function to lock the interface to this specific receiver. See below for more information about locked interfaces.
* `unlock()` - The transmitter can call this function to unlock the interface from this specific receiver. See below for more information about locked interfaces.
* `relock( newReceiver: EndpointAddr )` - The transmitter can call this function on a locked interface to atomically discard that lock, establish a new interface with the specified endpoint, and lock that new interface. See below for more information about locked interfaces.
* `sendEvent( event: object )` - The transmitter or receiver can call this function to send an opaque event object to its peer. Aardvark doesn't know or care about the contents of these events. These are transmitted via web sockets currently, so they should probably generally be limited in size to tens of kilobytes or less. There is not currently a limit enforced by Aardvark.
* `onEnded( callback )` - The transmitter or receiver can call this function to register a callback that will be invoked when the interface ends. An interface could end because the volumes no longer intersect, because the receiver or transmitter no longer exists, or because the receiver or transmitter no longer specifies the interface name that the active interface was established with.
* `onEvent( callback )` - The transmitter or receiver can call this function to register a callback. The callback will be invoked when the peer entity calls `sendEvent()`. If the receiving side does not register a callback, any event sent with `sendEvent()` will be discarded.
* `onTransformUpdated( callback )` - The transmitter or receiver can call this interface to register a callback. The callback is invoked when the transform between the entities is updated because Aardvark processed a frame. See below for more details on active interface transforms.

* 

# Documentation for built-in interfaces

## `aardvark-grab@1`

This interface allows the user to pick up the components of various gadgets and move them around. 

**Transmitter**

The default hand gadget that's built into Aardvark transmits this interface. 
Eventually it may be possible to replace this default implementation with one of your own, but for now it is probably best to consider the `aardvark-grab@1` transmitter to be built-in.

**Receiver**

When you include an `AvStandardGrabbable` component in your gadget, you are including an implementation of the receiver side of this interface.
If you need more fine-grained control of your grabbable entity than `AvStandardGrabbable` can support, you could also use `MoveableComponent` directly, or implement the interface yourself.

