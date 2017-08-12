## force-live-change-detector

watch salesforce for record changes using streaming topics and polling as a fallback

### Setup

1. Clone this repo

```sh
$ git clone https://github.com/pfeilbr/web-app-boilerplate.git
```

2. Change `package.json` properties (`name`, `version`, etc.) for your project

3. Install dependencies

```sh
$ npm install
```

### Develop with Livereload for server and client

```sh
$ npm run dev
```

  > * [nodemon](https://github.com/remy/nodemon) to reload when server code (`server.js`) changes
  > * [watchify](https://github.com/substack/watchify) to rebuild client code (`app.js`) on file change
  > * [Browsersync](https://www.browsersync.io/) to reload browser when client code changes

### Test

[mocha](https://mochajs.org/) tests with [es6 babel](https://babeljs.io/docs/setup/#mocha) support

Tests are located in `test/`

```sh
$ DEBUG=Observer npm test -- --no-timeouts

# watch / re-run on file changes
$ DEBUG=Observer npm test -- -w --no-timeouts
```

### Build

```sh
$ npm run build
```

> client side bundle is written to `public/js/bundle.js`

### Files

* `server.js` - express server
* `app.js` - client side app
* `config/index.js` - config data

### TODO

* remove hard coded sleep for browsersync start.
  * poll every second for port 3000 in use, when it is, launch browsersync
