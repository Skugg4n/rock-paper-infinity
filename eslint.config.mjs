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
    rules: {},
  },
];
