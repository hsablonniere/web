interface PackageConfiguration {
  name: string;
  type: 'ts' | 'js';
  environment: 'node' | 'browser' | 'mixed';
}

const packages: PackageConfiguration[] = [
  { name: 'config-loader', type: 'js', environment: 'node' },
  { name: 'browser-logs', type: 'ts', environment: 'node' },
  { name: 'dev-server-core', type: 'ts', environment: 'node' },
  { name: 'dev-server-esbuild', type: 'ts', environment: 'node' },
  { name: 'dev-server-rollup', type: 'ts', environment: 'node' },
  { name: 'dev-server-legacy', type: 'ts', environment: 'node' },
  { name: 'test-runner', type: 'ts', environment: 'node' },
  { name: 'test-runner-core', type: 'ts', environment: 'node' },
  { name: 'test-runner-cli', type: 'ts', environment: 'node' },
  { name: 'test-runner-server', type: 'ts', environment: 'node' },
  { name: 'test-runner-chrome', type: 'ts', environment: 'node' },
  { name: 'test-runner-puppeteer', type: 'ts', environment: 'node' },
  { name: 'test-runner-playwright', type: 'ts', environment: 'node' },
  { name: 'test-runner-selenium', type: 'ts', environment: 'node' },
  { name: 'test-runner-browserstack', type: 'ts', environment: 'node' },
  { name: 'test-runner-coverage-v8', type: 'ts', environment: 'node' },
  { name: 'test-runner-browser-lib', type: 'ts', environment: 'browser' },
  { name: 'test-runner-helpers', type: 'ts', environment: 'browser' },
  { name: 'test-runner-mocha', type: 'ts', environment: 'browser' },
];

export { packages };
