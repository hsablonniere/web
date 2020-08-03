import { expect } from 'chai';
import path from 'path';
import fs from 'fs';

import { promisify } from 'util';
import child_process from 'child_process';
const exec = promisify(child_process.exec);

const STACK_TRACE_UNIQUE_IDS_REGEX = /localhost:\d+|wtr-session-id=[\w\d]+-[\w\d]+-[\w\d]+-[\w\d]+-[\w\d]+|\.js:\d+:\d+/g;

const NON_ZERO_TIME_VALUE_REGEX = /time="((\d\.\d+)|(\d))"/g;

const USER_AGENT_STRING_REGEX = /"Mozilla\/5\.0 (.*)"/g;

const normalizeOutput = (cwd: string, output: string) =>
  output
    .replace(STACK_TRACE_UNIQUE_IDS_REGEX, '<<unique>>')
    .replace(NON_ZERO_TIME_VALUE_REGEX, 'time="<<computed>>"')
    .replace(USER_AGENT_STRING_REGEX, '"<<useragent>>"')
    .replace(cwd, '<<cwd>>');

describe('junitReporter', function () {
  describe('for a simple case', function () {
    const cwd = path.join(__dirname, 'fixtures/simple');

    const expectedPath = path.join(cwd, './expected.xml');

    const outputPath = path.join(cwd, './test-results.xml');

    let stdout: string;
    let stderr: string;
    async function runTestFixture() {
      try {
        await exec(`npx web-test-runner simple.test.js --node-resolve`, { cwd });
      } catch (e) {
        stdout = e.stdout;
        stderr = e.stderr;
      }
    }

    function cleanUpFixture() {
      fs.unlinkSync(outputPath);
    }

    beforeEach(runTestFixture);

    afterEach(cleanUpFixture);

    after(function () {
      console.log(stdout, stderr);
    });

    it('produces expected results', function () {
      const actual = normalizeOutput(cwd, fs.readFileSync(outputPath, 'utf-8'));

      const expected = normalizeOutput(cwd, fs.readFileSync(expectedPath, 'utf-8'));

      expect(actual).to.equal(expected);
    });
  });
});
