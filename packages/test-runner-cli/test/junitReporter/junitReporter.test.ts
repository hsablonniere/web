import { expect } from 'chai';
import path from 'path'
import fs from 'fs'

import { promisify } from 'util';
import child_process from 'child_process';
const exec = promisify(child_process.exec);

describe('junitReporter', function () {
  describe('for a simple case', function () {

    const STACK_TRACE_UNIQUE_IDS_REGEX =
      /localhost:\d+|wtr-session-id=[\w\d]+-[\w\d]+-[\w\d]+-[\w\d]+-[\w\d]+/g;

    const NON_ZERO_TIME_VALUE_REGEX =
      /time="((\d\.\d+)|(\d))"/g

    const cwd =
      path.join(__dirname, 'fixtures/simple');

    const expectedPath =
      path.join(cwd, './expected.xml');

    const outputPath =
      path.join(cwd, './test-results.xml');

    async function runTestFixture() {
      try {
        const { stdout } = await exec(`web-test-runner simple.test.js --node-resolve`, { cwd })
        console.log('ok')
        console.log(stdout)
      } catch (e) {
        console.log(e.stderr, e.stdout)
      }
    }

    function cleanUpFixture() {
      fs.unlinkSync(outputPath);
    }

    beforeEach(runTestFixture);

    afterEach(cleanUpFixture);

    it('produces expected results', function () {
      const actual = fs.readFileSync(outputPath, 'utf-8')
        .replace(STACK_TRACE_UNIQUE_IDS_REGEX, '<<unique>>')
        .replace(NON_ZERO_TIME_VALUE_REGEX, 'time="<<computed>>"');

      const expected = fs.readFileSync(expectedPath, 'utf-8')
        .replace(STACK_TRACE_UNIQUE_IDS_REGEX, '<<unique>>')
        .replace(NON_ZERO_TIME_VALUE_REGEX, 'time="<<computed>>"');

      expect(actual).to.equal(expected);
    })
  })
})