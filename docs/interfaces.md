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

## Locked interfaces

Normally the active interface for a transmitter will be the current highest priority volume that the transmitter's own volume intersects.
There are some circumstances where that floating behavior isn't sufficient, so the transmitter may call `lock()` on the active interface to **lock** that interface to that receiver. 
Once an interface is locked, the transmitter will not start another interface until it calls `unlock()`.

Locking an interface has two effects:

1. The transmitter will start another interface.
2. Regardless of what happens with the intersection between the transmitter and receivers' volumes, the active interface will not end. The spacial relationship of the two entities in a locked interface will never cause the interface to end.

If the receiver disappears or stops publishing the interface it shares with the transmitter, the transmitter will receive a call back to the handler it registered with `onEnded()`.
This is the transmitter's cue that the interface is no longer valid.
A transmitter in this situation will still need to call `unlock()` if it wants to be eligible for new interfaces.

If the transmitter in a locked interface disappears or stops publishing the interface it shares with the receiver, the lock is discarded and the interface ends immediately for the receiver. 

### Relocking

Sometimes a transmitter will need to shift its lock from one receiver to another without any time passing, and without the need to intersect volumes with the new receiver. 
For instance, gadget seeds do this to transfer their newly spawned gadget to the gadget seed's parent.
Sometimes this will happen with receivers that have an empty volume and don't ever intersect transmitters "naturally". 
Transmitters can relock to that interface to force the new active interface.

### Initial Interface Locks

Sometimes entities will need to start up with a interface already in place. 
Any entity that spawns a gadget that it needs to be the parent of would do this to point that new child at itself.
This is accomplished by setting the interfaceLocks property of `AvInterfaceEntity` to include the required receiver.

This kind of interface lock can also include whatever additional information the interface requires in the `params` field of that initial lock.  

## Entity volumes

Entities normally intersect each other by testing their volumes against each other.
There are some special rules, however, to cover some of these cases:
* Empty volumes never intersect anything. They will only start interfaces via `relock()` on an active interface or via an initial interface lock. This is useful for any circumstance where the need for an interface can only be determined programmatically in the interface implementations themselves and Aardvark has no way of knowing hte interface needs to exist.
* Infinite volumes intersect everything (except empty volumes.) These are useful for "catch all" entities like the room contain that allows you to drop a Moveable anywhere in space and have it appear in the container.
* Entities that are ultimately parented to /user/hand/left, /user/hand/right, or /user/head will not intersect other volumes with the same parent. So Aardvark won't ever match a volume on the user's left hand with another volume on the user's left hand. This is to avoid a wide variety of annoying situations with the hands themselves.

## Entity Transforms

The transform between the two entities in an active interface will update to the current transform at a few different points in time:
1. When the interface starts, so no matter what else, the active interface will always have a transform that is at least as recent as the start of the interface.
2. When the interface ends.
3. When an interface event is sent to a recipient. If the transmitter sends an event to the receiver, the receiver will get an updated transform along with that event, and vice versa.
4. Every frame, but only to entities with their wantsTransform field set to true.



# Documentation for built-in interfaces

The `aardvarkxr/aardvark-react` npm package includes implementations for all of these interfaces. 
Gadget implementors are free to use those implementations or write their own.



## `aardvark-grab@1`

This interface allows the user to pick up the components of various gadgets and move them around. 

### Transmitter

The default hand gadget that's built into Aardvark transmits this interface. 
Eventually it may be possible to replace this default implementation with one of your own, but for now it is probably best to consider the `aardvark-grab@1` transmitter to be built-in.

### Receiver

When you include an `AvStandardGrabbable` component in your gadget, you are including an implementation of the receiver side of this interface.
If you need more fine-grained control of your grabbable entity than `AvStandardGrabbable` can support, you could also use `MoveableComponent` directly, or implement the interface yourself.

### Events

**Drop Yourself**

Sent by the transmitter to tell the receiver to drop itself into whatever container it's currently in.

```
{
	type: "drop_yourself"
}
```

**Drop Complete**

Sent by the receiver to tell the transmitter that the drop is complete and that it should unlock the receiver.

```
{
	type: "drop_complete"
}
```


**Set Grabber**

Sent by the transmitter to tell the receiver that it should set that grabber to be its parent and unlock itself from whatever container it is in.


```
{
	type: "set_grabber"
}
```


