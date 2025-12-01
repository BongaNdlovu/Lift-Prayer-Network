module.exports = {
  root: true,
  extends: [
    'expo',
    '@react-native',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  env: {
    'react-native/react-native': true,
    es2021: true,
    node: true,
  },
  rules: {
    // TypeScript specific
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    
    // React specific
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'warn',
    'no-unused-expressions': 'warn',
    
    // Allow empty catch blocks with comment
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'dist-check/',
    '.expo/',
    'cloud-functions/',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
};
