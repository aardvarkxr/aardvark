const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  modulePaths: 
  [
    __dirname, 
    path.resolve( __dirname, "./node_modules/" ),
  ]
};