TimeCapsuleD
============

A queue that doesn't release messages until a specified time.

TimeCapsule accepts a piece of data, and a date from a publisher. It will return this data to a subscriber once the date has passed.

It is designed to be used for scheduling once off events, at scale, with redundancy and consistency.

Quick Start
-----------

```npm install -g timecapsuled```

```timecapsuled```

We recommend using a tool like [forever](https://www.npmjs.com/package/forever) or [pm2](https://www.npmjs.com/package/pm2) to keep your process running. 

Example use cases:
------------------

- Remind a user to verify their email a week after they signed up
- Send a subscription reminder before a subscription ends
- Complete a time bound leaderboard and notify the winners at the end date

Core principles:
----------------

1. A message will only be delivered once
2. A message will never be delivered before the end date
3. In the event of a failure then messages will not be lost
4. If a message is not acknowledged by the subscriber then it will be resent

If there are not enough subscribers to handle the number of messages becoming available then messages will be sent later that expected.

If a subscriber handles a message, but fails to acknowledge then the message may be processed twice.

You cannot delete messages once they are published. It is the responsibility of the subscriber to ensure that the message is still valid.

Technology:
-----------

Currently TimeCapsule is written in Node, and uses a Redis database to store messages.

Configuration:
--------------

Time capsule runs on 127.0.0.1:1777 by default, and requires a Redis database to be available at 127.0.0.1:6379. These can be configured by either

1. Passing a json config to the command line parameter: ```--config```.
    e.g. ```timecapsuled --config='{"redis": {"host":"localhost"}}'```
    
    OR 
    
2. Passing the location of a json config file the command line parameter: ```--config-file```.
    e.g ```timecapsuled --config-file=config.json```
    
The basic config options available are:
- __host__: (default: *127.0.0.1*) The host name that timecapsule will listen on. 
- __port__: (default: *1777*) The port that timescapsule will listen on
- __log__: (default: *false*) If log messages should be written to the console
- __redis.host__: (default *127.0.0.1*) The host name for the redis database
- __redis.port__: (default *6379*) The port for the redis database
 
 Example:
 ```
 {
    "host": "127.0.0.1",
    "port": 1777,
    "log": false,
    "redis": {
        "host": "127.0.0.1",
        "port": 6379
    }
 }
 ```
 
 For a full set of config variable please see [lib/config.js]()

Publishers/Subscribers:
-----------------------

It is simple to write a new publisher/subscriber library. The following libraries are already available:

- PHP [TimeCapsule PHP Client](https://github.com/Mangahigh/TimeCapsule-PHP-Client)

Basic format of messages

__Publishing messages__
1. Client connects to TimecapsuleD
2. Server sends "OK"
3. Client sends "STORE <Queue Name> <Embargo Date>"
    - Queue Name can be any string without spaces
    - Embargo date must be a RFC 2822 formatted date (e.g. "2004-02-12T15:19:21+00:00")
4. Server sends "OK"
5. Client sends message
6. Server sents "OK" and closes connection

__Retrieving messages__
1. Client connects to TimecapsuleD
2. Server sends "OK"
3. Client sends "FETCH <Queue Name>"
4. Server hangs until message has reached embargo date
5. Server sends message to client
6. Client sends "ACK"
7. Server closes connection

__Getting stats__
1. Client connects to TimecapsuleD
2. Server sends "OK"
3. Client sends "STATS"
4. Server sends stats and closes connection


Influences:
-----------

- RabbitMq - https://www.rabbitmq.com
- Linux at, batch, atq, atrm - https://linux.die.net/man/1/at
- Kue - https://github.com/Automattic/kue
- Bull - https://github.com/OptimalBits/bull
- https://redislabs.com/ebook/part-2-core-concepts/chapter-6-application-components-in-redis/6-4-task-queues/6-4-2-delayed-tasks/

Contributing:
-------------

Please get involved in making this project better! Please submit a pull request with your changes. 

Take a look at [TODO.md]() for inspiration of things you could work on.

Licenses:
---------

Released under the MIT license. See [LICENSE]() for more details.

Acknowledgments:
----------------

Mangahigh - https://www.mangahigh.com

