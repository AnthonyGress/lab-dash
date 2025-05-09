import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactImport from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: ['dist', '*.css'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    plugins: {
      'import': reactImport
    },
    rules: {
      'import/no-extraneous-dependencies': 'off',
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/no-import-module-exports': 'off',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': 'off',
      'radix': 'off',
      'global-require': 'off',
      'import/no-dynamic-require': 'off',
      indent: ['warn', 4,  {
          'ignoredNodes': [
              'FunctionExpression > .params > :matches(Decorator, :not(:first-child))',
              'ClassBody.body > PropertyDefinition[decorators.length > 0] > .key',
          ],
      },],
      quotes: ['warn', 'single'],
      'prettier/prettier': 0,
      'object-curly-spacing': ['warn', 'always'],
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-var-requires': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'import/prefer-default-export': 'off',
      'spaced-comment': 'warn',
      'lines-between-class-members': 'off',
      'class-methods-use-this': 'off',
      'no-return-await': 'off',
      'no-undef': 'warn',

      'no-plusplus': 'off',

      'import/newline-after-import': 'off',
      'promise/always-return': 'off',
      'import/order': [
          'warn',
          {
              'alphabetize': {
                  'caseInsensitive': true,
                  'order': 'asc'
              },
              'groups': [
                  ['builtin', 'external', 'object', 'type'],
                  ['internal', 'parent', 'sibling', 'index']
              ],
              'newlines-between': 'always'
          }
      ],
      'sort-imports': [
          'warn',
          {
              'allowSeparatedGroups': true,
              'ignoreCase': true,
              'ignoreDeclarationSort': true,
              'ignoreMemberSort': false,
              'memberSyntaxSortOrder': ['none', 'all', 'multiple', 'single']
          }
      ],
      'jsx-quotes': ['warn', 'prefer-single'],

      '@typescript-eslint/no-explicit-any': 'warn',
      'semi': 'warn'
    },
  },
)
