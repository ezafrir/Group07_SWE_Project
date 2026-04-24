module.exports = {
  default: {
    paths:   ["features/**/*.feature"],
    require: ["features/step_definitions/**/*.js"],
    format:  ["progress-bar", "html:reports/cucumber-report.html"]
    // Step timeout is set via setDefaultTimeout(90000) in steps.js.
    // Do NOT set timeout here — it overrides setDefaultTimeout and
    // causes LLM-response steps to fail when Ollama is slow.
  }
};
