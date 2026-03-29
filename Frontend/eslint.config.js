const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
    },
    plugins: {
      react: require('eslint-plugin-react'),
    },
    rules: {
      'react/react-in-jsx-scope': 'off', // React 17+ doesn't need import
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'react/prop-types': 'off', // Optional: if you're not using PropTypes
    },
  },
]);