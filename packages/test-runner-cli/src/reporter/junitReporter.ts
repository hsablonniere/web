import path from 'path';
import fs from 'fs';
import { Reporter, ReporterArgs, TestResult, TestRunnerCoreConfig, TestSession } from '@web/test-runner-core';

import { createSourceMapFunction, SourceMapFunction } from '../utils/createSourceMapFunction';
import { createStackLocationRegExp } from '../utils/createStackLocationRegExp';

import XML from 'xml';
import { replaceRelativeStackFilePath } from '../utils/replaceRelativeStackFilePath';

export interface JUnitReporterArgs {
  outputPath?: string;
}

type TestSessionMetadata =
  Omit<TestSession, 'tests'>;

type TestResultWithMetadata =
  TestResult & TestSessionMetadata;

// Browser name is highly dynamic, hence `string`
type TestResultsWithMetadataByBrowserName =
  Record<string, TestResultWithMetadata[]>;

interface TestFailureXMLElement {
  _cdata?: string|string[];
  _attr: {
    message: string;
    type: string;
  };
}

interface TestCaseXMLAttributes {
  _attr: {
    name: string;
    time: number;
    classname: string;
  }
}

type PassedTestCase = TestCaseXMLAttributes;
type SkippedTestCase = [TestCaseXMLAttributes, { skipped: null }];
type FailedTestCase = [TestCaseXMLAttributes, { failure: TestFailureXMLElement }];

interface TestCaseXMLElement {
  testcase: PassedTestCase | SkippedTestCase | FailedTestCase;
}

type TestSuitePropertiesXMLElement = [{
  property: {
    _attr: {
      name: string;
      value: string;
    }
  }
}]

interface TestSuiteXMLAttributes {
  _attr: {
    name: string;
    id: number;
    tests: number;
    skipped: number;
    errors: number;
    failures: number;
    time: number;
  }
}

type StackAndSourceMapReplacer =
  (userAgent: string, string: string) =>
    Promise<string>;

const assignSessionPropertiesToTests =
  ({ tests, ...rest }: TestSession): TestResultWithMetadata[] =>
    tests.map(x => ({ ...x, ...rest }));

const toResultsWithMetadataByBrowserName =
  (acc: TestResultsWithMetadataByBrowserName, test: TestResultWithMetadata): TestResultsWithMetadataByBrowserName =>
    ({ ...acc, [test.browserName]: [...acc[test.browserName] ?? [], test] });

const escapeLogs =
  (browserName: string) =>
    (x: TestResultWithMetadata) =>
      x.logs.map(x =>
        x.map(y =>
          ({ _cdata: `${browserName} ${y}` })));

const isFailedTest =
  (test: TestResult): boolean =>
    // NB: shouldn't have to check for `error`,
    // but ATM all tests are coming back `passed: false`
    !test.passed &&
    !!test.error

const addSuiteTime =
  (time: number, test: TestResultWithMetadata) =>
    time + (test.duration || 0) / 1000

const getTestName =
  (test: TestResult): string =>
    test.name
      .split(' > ')
      .pop() || '';

const getSuiteName =
  (test: TestResult): string =>
    test.name
      .split(' > ')
      .slice(0, -1)
      .join(' ');

const getTestDurationInSeconds =
  ({ duration }: TestResult): number =>
      (typeof duration === 'undefined') ? 0
    : duration / 1000;

// A subset of invalid characters as defined in http://www.w3.org/TR/xml/#charsets that can occur in e.g. stacktraces
// lifted from https://github.com/michaelleeallen/mocha-junit-reporter/blob/master/index.js (licensed MIT)
// other portions of code adapted from same
// regex lifted from https://github.com/MylesBorins/xml-sanitizer/ (licensed MIT)
const INVALID_CHARACTERS_REGEX =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007f-\u0084\u0086-\u009f\uD800-\uDFFF\uFDD0-\uFDFF\uFFFF\uC008]/g;

const stripXMLInvalidChars =
  (x: string): string =>
    x.replace(INVALID_CHARACTERS_REGEX, '');

/**
 * Makes a `<failure>` element
 */
async function testFailureXMLElement(replacer: StackAndSourceMapReplacer, test: TestResultWithMetadata): Promise<TestFailureXMLElement> {
  const { error, userAgent = '' } = test;

  const message =
   stripXMLInvalidChars(await replacer(userAgent, error?.message ?? ''));

  const stack =
   stripXMLInvalidChars(await replacer(userAgent, error?.stack ?? ''));

  const type =
    stack.match(/^\w+Error:/) ? stack.split(':')[0] : '';

  return {
    _attr: { message, type },
    _cdata: stack || message || undefined,
  };
}

/**
 * Makes attributes for a `<testcase>` element
 * @param test Test Result
 */
function testCaseXMLAttributes(test: TestResult): TestCaseXMLAttributes {
  const name =
    getTestName(test);

  const time =
    getTestDurationInSeconds(test);

  const classname =
    getSuiteName(test);

  return {
    _attr: {
      name,
      time,
      classname,
    }
  };
}

/**
 * Makes a `<testcase>` element
 */
const testCaseXMLElement =
  (replacer: StackAndSourceMapReplacer) =>
    async function testCaseXMLElement(test: TestResultWithMetadata): Promise<TestCaseXMLElement> {
      const attributes = testCaseXMLAttributes(test);

      if (test.skipped)
        return { testcase: [attributes, { skipped: null }]}
      else if (isFailedTest(test))
        return { testcase: [attributes, { failure: await testFailureXMLElement(replacer, test) }] }
      else
        return { testcase: attributes }
    }

/**
 * Makes attributes for a `<testsuite>` element
 * @param name Test Suite Name
 * @param id Test Run ID
 * @param results Test Results
 */
function testSuiteXMLAttributes(name: string, id: number, results: TestResultWithMetadata[]): TestSuiteXMLAttributes {
  const tests =
    results
      .length;

  const skipped =
    results
      .filter(x => x.skipped)
      .length;

  const errors =
    results
      .map(x => x.error)
      .filter(Boolean)
      .length;

  const failures =
    results
      .filter(isFailedTest)
      .length;

  const time =
    results
      .reduce(addSuiteTime, 0);

  return {
    _attr: {
      name,
      id,
      tests,
      skipped,
      errors,
      failures,
      time,
    }
  }
}

/**
 * Makes a `<properties>` element
 * @param name Suite name
 * @param value User Agent String
 */
function testSuitePropertiesXMLElement(name: string, value: string): TestSuitePropertiesXMLElement {
  return [
    {
      property: {
        _attr: {
          name,
          value
        }
      }
    }]
}

/**
 * Collates test sessions by browser, converts them to an XML object representation,
 * then stringifies the XML.
 * @param sessions Test Sessions
 */
async function getTestRunXML(sessions: TestSession[], replacer: StackAndSourceMapReplacer): Promise<string> {
  const testsuites =
    await Promise.all(Object.entries(sessions
      .flatMap(assignSessionPropertiesToTests)
      .reduce(toResultsWithMetadataByBrowserName, {} as TestResultsWithMetadataByBrowserName))
    .map(async ([name, tests]) => {
      const [{ testRun = 0, userAgent = '' }] = tests;
      const attributes =
        testSuiteXMLAttributes(name, testRun, tests);

      const properties =
        testSuitePropertiesXMLElement(name, userAgent);

      const testcases =
        await Promise.all(tests.map(testCaseXMLElement(replacer)));

      const testsuite =
        [attributes, { properties }, ...testcases];

      const systemOut =
        tests.flatMap(escapeLogs(name));

      return {
        testsuite,
        'system-out': systemOut
      }
    }));

  return XML({ testsuites }, { declaration: true, indent: '  ' })
}

/**
 * A JUnit-format XML file reporter for Web Test Runner
 *
 * @param args Options for JUnit Reporter
 */
export function junitReporter({
  outputPath = './test-results.xml',
}: JUnitReporterArgs = {}): Reporter {
  let args: ReporterArgs;
  let stackLocationRegExp: RegExp;
  let sourceMapFunction: SourceMapFunction;
  let config: TestRunnerCoreConfig;
  let replacer: StackAndSourceMapReplacer;

  return {
    start(_args) {
      args = _args;
      config = args.config

      const { protocol, hostname, port, rootDir } = config;

      stackLocationRegExp =
        createStackLocationRegExp(protocol, hostname, port);

      sourceMapFunction =
        createSourceMapFunction(protocol, hostname, port);

      replacer =
        (userAgent: string, string: string) =>
          replaceRelativeStackFilePath(
            string,
            userAgent,
            rootDir,
            stackLocationRegExp,
            sourceMapFunction,
          );
    },

    onTestRunStarted({ testRun }) {
      if (testRun !== 0) {
        // create a new source map function to clear the cached source maps
        const { protocol, hostname, port, rootDir } = config;

        sourceMapFunction =
          createSourceMapFunction(protocol, hostname, port);

        replacer =
          (userAgent: string, string: string) =>
            replaceRelativeStackFilePath(
              string,
              userAgent,
              rootDir,
              stackLocationRegExp,
              sourceMapFunction,
            );
      }
    },

    async onTestRunFinished({ sessions }) {
      const xml =
        await getTestRunXML(sessions, replacer);

      console.log(xml)

      const filepath =
        path.join(process.cwd(), outputPath);

      fs.writeFileSync(filepath, xml);
    },

  };
}
