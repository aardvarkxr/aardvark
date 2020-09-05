const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@aardvarkxr/aardvark-shared$': path.resolve(__dirname, '../packages/aardvark-shared/src/index.ts'),
    '^@aardvarkxr/aardvark-react$': path.resolve(__dirname, '../packages/aardvark-react/src/index.ts'),
    "\\.(css|less)$": "<rootDir>/__mocks__/styleMock.js",
  },
  modulePaths: 
  [
    __dirname, 
    path.resolve( __dirname, "./node_modules/" ),
  ]
};