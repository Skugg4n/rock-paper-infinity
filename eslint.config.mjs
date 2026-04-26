import globals from "globals";

export default [
  {
    ignores: ["node_modules", "main.js"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        toRoman: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "prefer-const": "warn",
      "no-var": "warn",
      "eqeqeq": ["warn", "always", { "null": "ignore" }],
    },
  },
];
