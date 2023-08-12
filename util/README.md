## [authSocket](authSocket.ts)
An example of extending the functionality for a socket.io client. This uses
a mixin sort of approach to avoid having to mess with any underlying socket.io
code or prototypes.


## [auth0Client](auth0Client.ts)
Standalone client for authenticating JWTs issued by auth0. Useful for
authenticating tokens outside of typical request/response cycles.

## [parsePropertyNames](parsePropertyNames.ts)
Utility for parsing an object and maps all of its terminal(leaf) properties
to a string that is made up of itself and all of its ancestors. The values
are discarded.

`{a: 'hello', b: { c: 'world'} } with # as the separator` becomes `{a: 'a', b: { c: 'b#c'}}`


## [useLocation](useLocation)
A custom react hook for React-Native Expo that deals with location permissions
on an android device.

When requesting location permission, it first checks to see if it's possible to
request it directly through the app. If that's not possible it asks for
permission through `Settings`. If permission is denied it has the option 
to fall back to a static location provided during the initial use hook call.

useLocation also handles subscribing and unsubscribing to location updates.

All location data with the exception of the `granted` permission status is local
to the component. The reason for `granted` being the exception is because when 
location permission is either granted or revoked it has an effect on all location 
related tasks. In this example the `granted` state is stored as a redux state
(implementation not shown.) but any other state management strategy, such as 
React.context, will work as well. This way if the status of `granted` changes all
the instances of `useLocation` will know about it and act accordingly. 