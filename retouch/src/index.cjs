'use strict';
module.exports = {
  ...require('./id.cjs'),
  ...require('./stamp.cjs'),
  withRetouch: require('./next.cjs').withRetouch,
};
