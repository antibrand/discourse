# discourse

For consideration as the antibrand website's forum software.

## Setup

If you want to set up a forum for production use, see [the install guide](docs/INSTALL.md).

## Requirements

Discourse is built for the *next* 10 years of the Internet, so our requirements are high:

| Browsers              | Tablets      | Phones       |
| --------------------- | ------------ | ------------ |
| Safari 10+           | iPad 4+      | iOS 10+       |
| Google Chrome 57+     | Android 4.4+ | Android 4.4+ |
| Internet Explorer 11+ |              |              |
| Firefox 52+           |              |              |

## Built With

- [Ruby on Rails](https://github.com/rails/rails) &mdash; Backend API is a Rails app. It responds to requests RESTfully in JSON.
- [Ember.js](https://github.com/emberjs/ember.js) &mdash; Frontend is an Ember.js app that communicates with the Rails API.
- [PostgreSQL](https://www.postgresql.org/) &mdash; Main data store is in Postgres.
- [Redis](https://redis.io/) &mdash; Redis is used as a cache and for transient data.
- Complete list of Ruby Gems at [/master/Gemfile](https://github.com/antibrand/discourse/blob/master/Gemfile).
