const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: ['<rootDir>/src/__tests__/firestore.rules.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
};
