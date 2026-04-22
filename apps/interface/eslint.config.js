const nextConfig = require("eslint-config-next");
const jsxA11y = require("eslint-plugin-jsx-a11y");

module.exports = [
  ...nextConfig,
  // Spread only the rules from jsx-a11y/recommended — the plugin is already
  // registered by eslint-config-next, so we must not re-register it.
  {
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // next/link renders its own <a>; the href rule doesn't apply to Next.js <Link>
      "jsx-a11y/anchor-is-valid": "warn",
    },
  },
];
