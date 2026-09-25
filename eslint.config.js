'use strict';

var js = require('@eslint/js');
var globals = require('globals');
var noUnsanitized = require('eslint-plugin-no-unsanitized');

var securityRules = {
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
};

module.exports = [
  { ignores: ['dist/', 'vendor/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['kanban/**/*.js', 'risk-matrix/**/*.js'],
    plugins: { 'no-unsanitized': noUnsanitized },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: Object.assign({}, globals.browser, {
        module: 'readonly',
        grist: 'readonly',
        Sortable: 'readonly',
        KanbanLogic: 'readonly',
        RiskMatrixLogic: 'readonly',
      }),
    },
    rules: Object.assign({}, securityRules, {
      'no-unsanitized/property': 'error',
      'no-unsanitized/method': 'error',
    }),
  },
  {
    files: ['scripts/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: securityRules,
  },
];
