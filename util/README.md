### authSocket
An example of extending functionality to a socket io client.


### auth0Client
Standalone client for authenticating JWTs issued by auth0.


### parsePropertyNames
Utility for parsing an object and maps all of its terminal(leaf) properties
to a string that is made up of itself and all of its ancestors.

`{a: 'a', b: { c: 'c'} } with # as the separator` becomes `{a: 'a', b: { c: 'b#c'}}`