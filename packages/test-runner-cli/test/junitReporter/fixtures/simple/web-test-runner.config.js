const { junitReporter } = require('../../../../dist/reporter/junitReporter');

module.exports = {
  reporters: [junitReporter()],
  testRunnerHtml: (testRunnerImport, config) => `
    <script src="chai.min.js"></script>
    <script type="module">
      import '${testRunnerImport}';
    </script>
  `,
};