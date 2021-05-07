# `connection-spy`

[![npm](https://img.shields.io/npm/v/connection-spy.svg?colorB=blue)](https://www.npmjs.com/package/connection-spy)

> Debug Logger for Socket Connections

As of May 7, 2021, this monkey patches the `https.Agent` default connection
pool in Node.js. When connections are created or reused in a connection pool,
`connection-spy` will register event callbacks that will trigger debug logs.
Best effort is made to correlate logs (e.g. with a unique UUID) that are
relevant to the same connection.
