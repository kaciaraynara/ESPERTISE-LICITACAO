/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.env.js'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@integrations/(.*)$': '<rootDir>/src/integrations/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@jobs/(.*)$': '<rootDir>/src/jobs/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
};
