# `connection-spy`

> Debug Logger for Socket Connections

This monkey patches the `http.Agent` and `https.Agent` default connection
pools in Node.js. When connections are created or reused in a connection pool,
`connection-spy` will register event callbacks that will trigger debug logs.
Best effort is made to correlate logs (e.g. with a unique UUID) that are
relevant to the same connection.

The `monkeyPatch()` function is responsible for adding custom behavior to
`http.Agent` and `https.Agent`. In addition, the `spyNewSocket()` function can
be used for manually created sockets, i.e. outside of a connection pool.
