const path = require('path')
const { defineConfig } = require('vite')
const dts = require('vite-plugin-dts').default;

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, './src/index.js'),
      name: 'tracer',
      fileName: (format) => `tracer.${format}.js`
    }
  },
  plugins: [
    dts({
      entryRoot: 'src',
      outDir: 'dist/types',
      insertTypesEntry: true,
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js'],
      staticImport: true,
      rollupTypes: true,
      copyDtsFiles: true
    })
  ]
});