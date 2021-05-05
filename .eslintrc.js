module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    commonjs: true,
    es6: true,
    node: true,
  },
  extends: ['airbnb-base', 'plugin:@typescript-eslint/recommended'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  ignorePatterns: ['node_modules'],
  rules: {
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/*.test.ts'] }],
    'max-len': ['error', 120],
    'import/prefer-default-export': ['off'],
    '@typescript-eslint/explicit-module-boundary-types': 'off', // revisit
    '@typescript-eslint/no-explicit-any': 'off', // revisit
    'no-restricted-syntax': 'off', // revisit
    eqeqeq: 'off', // revisit
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-console': 'off',
    'implicit-arrow-linebreak': 'off',
    'object-curly-newline': ['off'],
    '@typescript-eslint/no-use-before-define': ['off'],
    'no-await-in-loop': ['off'],
    'operator-linebreak': ['off'],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        ts: 'never',
      },
    ],
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
};
