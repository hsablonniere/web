import path from 'path';
import { expect } from 'chai';
import { TestRunnerCoreConfig, TestRunner, Logger } from '@web/test-runner-core';
import { testRunnerServer } from '@web/test-runner-server';
import portfinder from 'portfinder';

import { playwrightLauncher, ProductType } from '../src/index';

const logger: Logger = {
  ...console,
  debug() {
    //
  },
  logSyntaxError(error) {
    console.log(error);
  },
};

const products = [
  'chromium',
  'firefox',
  // webkit does not work in our CI
  // 'webkit'
] as ProductType[];

let port: number;
beforeEach(async () => {
  port = await portfinder.getPortPromise({
    port: 9000 + Math.floor(Math.random() * 1000),
  });
});

for (const product of products) {
  it(`runs tests with playwright on browser ${product}`, function (done) {
    this.timeout(50000);
    const testFiles = [
      'test/fixtures/test-a.test.js',
      'test/fixtures/test-b.test.js',
      'test/fixtures/test-c.test.js',
      'test/fixtures/test-d.test.js',
      'test/fixtures/test-e.test.js',
      'test/fixtures/test-f.test.js',
      'test/fixtures/test-g.test.js',
      'test/fixtures/test-h.test.js',
      'test/fixtures/test-i.test.js',
      'test/fixtures/test-j.test.js',
      'test/fixtures/test-k.test.js',
      'test/fixtures/test-l.test.js',
      'test/fixtures/test-m.test.js',
      'test/fixtures/test-n.test.js',
      'test/fixtures/test-o.test.js',
    ].map(tf => path.join(process.cwd(), tf));

    const config: TestRunnerCoreConfig = {
      files: [],
      watch: false,
      reporters: [],
      testFramework: { path: require.resolve('@web/test-runner-mocha/dist/autorun.js') },
      rootDir: path.join(process.cwd(), '..', '..'),
      logger,
      protocol: 'http:',
      hostname: 'localhost',
      port,
      concurrency: 10,
      browserStartTimeout: 30000,
      testsStartTimeout: 10000,
      testsFinishTimeout: 20000,
      browsers: [playwrightLauncher({ product })],
      server: testRunnerServer(),
    };

    const runner = new TestRunner(config, testFiles);

    runner.sessions.on('session-status-updated', session => {
      console.log(session.browser.name, session.id, session.status);
    });

    runner.on('finished', () => {
      runner.stop();
    });

    runner.on('stopped', () => {
      const sessions = Array.from(runner.sessions.all());
      expect(sessions.length).to.equal(15, 'there should be 30 test sessions');

      for (const testFile of testFiles) {
        const session = sessions.find(
          s => s.browser.name.toLowerCase() === product && s.testFile === testFile,
        );

        if (!session) {
          throw new Error(`Should have a session for browser ${product} and file ${testFile}`);
        }
      }

      for (const session of sessions) {
        if (!session.passed) {
          const error = session.errors[0];
          if (error instanceof Error) {
            done(error);
          } else if (error) {
            done(new Error(error.message));
          } else {
            done(new Error('unknown error'));
          }
          return;
        }
      }

      done();
    });

    runner.start();
  });
}
