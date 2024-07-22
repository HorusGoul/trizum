module.exports = {
  root: true,
  extends: ["@horus.dev/eslint-config/react"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  plugins: ["eslint-plugin-react-compiler", "eslint-plugin-lingui"],
  rules: {
    "react-compiler/react-compiler": "error",
    "import/no-named-as-default-member": "off",
    "import/no-named-as-default": "off",
  },
};
