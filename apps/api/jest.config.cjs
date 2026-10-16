module.exports = {
  preset: 'ts-jest', testEnvironment: 'node',
  testMatch: ['**/test/**/*.spec.ts', '**/test/**/*.e2e-spec.ts'],
  testTimeout: 30000, clearMocks: true,
};
