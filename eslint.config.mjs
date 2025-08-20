import globals from "globals";

export default [
  {
    ignores: ["node_modules", "main.js"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        lucide: "readonly",
        toRoman: "readonly",
      },
    },
    rules: {},
  },
];
