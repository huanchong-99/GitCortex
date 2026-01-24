module.exports = {
  plugins: {
    // No config specified - @config directives in CSS files take precedence
    tailwindcss: { config: './tailwind.config.cjs' },
    autoprefixer: {},
  },
};
