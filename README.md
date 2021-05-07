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

## Example

Consider a hypothetical web service `https://web.k8s.invalid`:

```
$ dig +short web.k8s.invalid
internal-abe8a4fd143901ecb3562a21080430b6-409806529.us-east-1.elb.amazonaws.com.
10.10.18.239
10.10.29.138
10.10.33.92
10.10.58.21
```

As the CNAME indicates, this hypothetical web service sits behind an internal
[AWS ELB][1]. What's more the ELB has the idle timeout set to 10 seconds,
so that connections will be closed after 10 seconds of inactivity.

```
$ aws elb describe-load-balancer-attributes \
>   --load-balancer-name abe8a4fd143901ecb3562a21080430b6 \
>   | jq '.LoadBalancerAttributes.ConnectionSettings'
{
  "IdleTimeout": 10
}
```

Assuming `connection-spy` has been activated, three requests will be made
in this example: the first two spaced apart by less than 10 seconds and the
last two spaced aprt by more than 10 seconds so that the ELB will close the
connection. We can see a `Socket Connect` debug log line for the first and
third request and a `Reuse Socket` debug log line for the second request.
Additionally, when the ELB closes the connection we see `Socket End` and
`Socket Close` debug log lines.

```
{"id":"aa603c85-1591-4d10-a543-206317986a51","producer":"connection-spy","localAddress":"192.168.244.2","localPort":52238,"remoteAddress":"10.10.29.138","remotePort":443,"target":"GET https://web.k8s.invalid:443/headers?a=b","level":"debug","message":"Socket Connect","_timestamp":"2021-05-07T17:16:29.743Z"}
{"id":"aa603c85-1591-4d10-a543-206317986a51","producer":"connection-spy","localAddress":"192.168.244.2","localPort":52238,"remoteAddress":"10.10.29.138","remotePort":443,"target":"GET https://web.k8s.invalid:443/headers?a=b","level":"debug","message":"HTTP(S) Response","_timestamp":"2021-05-07T17:16:30.003Z"}
{"id":"29d6820b-789b-4f57-ad18-eec1c7ae4228","producer":"connection-spy","localAddress":"192.168.244.2","localPort":52238,"remoteAddress":"10.10.29.138","remotePort":443,"target":"GET https://web.k8s.invalid:443/headers?c=d","level":"debug","message":"Reuse Socket","_timestamp":"2021-05-07T17:16:35.011Z"}
{"id":"29d6820b-789b-4f57-ad18-eec1c7ae4228","producer":"connection-spy","localAddress":"192.168.244.2","localPort":52238,"remoteAddress":"10.10.29.138","remotePort":443,"target":"GET https://web.k8s.invalid:443/headers?c=d","level":"debug","message":"HTTP(S) Response","_timestamp":"2021-05-07T17:16:35.138Z"}
{"id":"aa603c85-1591-4d10-a543-206317986a51","producer":"connection-spy","localAddress":"192.168.244.2","localPort":52238,"remoteAddress":"10.10.29.138","remotePort":443,"level":"debug","message":"Socket End","_timestamp":"2021-05-07T17:16:44.924Z"}
{"id":"aa603c85-1591-4d10-a543-206317986a51","producer":"connection-spy","localAddress":null,"localPort":null,"remoteAddress":"10.10.29.138","remotePort":443,"hadError":false,"level":"debug","message":"Socket Close","_timestamp":"2021-05-07T17:16:44.926Z"}
{"id":"83b41ba4-217a-458e-8fa5-f8e5e50b184e","producer":"connection-spy","localAddress":"192.168.244.2","localPort":52246,"remoteAddress":"10.10.29.138","remotePort":443,"target":"GET https://web.k8s.invalid:443/headers?e=f","level":"debug","message":"Socket Connect","_timestamp":"2021-05-07T17:16:46.281Z"}
{"id":"83b41ba4-217a-458e-8fa5-f8e5e50b184e","producer":"connection-spy","localAddress":"192.168.244.2","localPort":52246,"remoteAddress":"10.10.29.138","remotePort":443,"target":"GET https://web.k8s.invalid:443/headers?e=f","level":"debug","message":"HTTP(S) Response","_timestamp":"2021-05-07T17:16:46.544Z"}
```

Expanding one of these as multiline JSON:

```json
{
    "id": "aa603c85-1591-4d10-a543-206317986a51",
    "producer": "connection-spy",
    "localAddress": "192.168.244.2",
    "localPort": 52238,
    "remoteAddress": "10.10.29.138",
    "remotePort": 443,
    "target": "GET https://web.k8s.invalid:443/headers?a=b",
    "level": "debug",
    "message": "Socket Connect",
    "_timestamp": "2021-05-07T17:16:29.743Z"
}
```

[1]: https://aws.amazon.com/elasticloadbalancing/
