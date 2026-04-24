module.exports = {
  default: {
    paths:   ["features/**/*.feature"],
    require: ["features/step_definitions/**/*.js"],
    format:  ["progress-bar", "html:reports/cucumber-report.html"],
    timeout: 180000 // 3 min — must match setDefaultTimeout in steps.js
  }
};
