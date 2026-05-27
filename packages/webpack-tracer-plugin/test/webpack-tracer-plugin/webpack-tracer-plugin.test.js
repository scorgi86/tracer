const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const InjectConstructorCodePlugin = require('../../src/UniversalCodeInjectorPlugin.js');
const TracerCodeGenerator = require('../../src/TracerCodeGenerator.js');
const { ENTRY_ORDER } = require('webpack-inject-plugin');

describe('InjectConstructorCodePlugin', () => {
  const outputDir = path.join(__dirname, 'test-output');
  const outputFile = path.join(outputDir, 'bundle.js');
  const indexFile = path.join(__dirname, 'src', 'index.js');

  const targetsConfig = {
      // Person: ['name', 'sername'],
      // TestClass: ['testProp'],
      // EmptyConstructor: ['emptyProp'],
      CEditorPage: [],
      // asc_docs_api: []
  };

  beforeAll((done) => {
    // Создаем тестовый конфиг
    source = fs.readFileSync(indexFile, { encoding: "utf-8" }, (err, result) => {
      if (err) {
        throw new Error(err);
      }

      return result;
    });

    const config = {
      mode: 'development',
      entry: indexFile,
      output: {
        path: outputDir,
        filename: 'bundle.js' 
      },
      plugins: [
        new InjectConstructorCodePlugin({
          injectLoaderOpts: {
            targets: (className) => className === "CEditorPage",
            /** @type   */
            generateCode: {
                /** Добавит код после конструктора */
                // construct: {
                //   CEditorPage: {
                //     code: () => { return 'window.page = this;' }
                //   },
                //   asc_docs_api: {
                //     code: ({ propList }) => { return 'window.api = this;' }
                //   },
                // },
                construct: ({ className }) => {
                    let code = '';
                    // const propsList = targetsConfig[className];

                    if (className === 'CEditorPage') {
                      code = 'window.page = this;';
                      return code;
                    }

                    if (className === 'asc_docs_api') {

                      code = 'window.api = this;';
                      return code;
                    }

                    // if (propsList) {
                    //   code = TracerCodeGenerator.observePropertyAll(className, propsList)
                    // }

                    return code.trim();
                }
            },
          },
          listInjectPluginOptions: [
            {
              options: {
                entryName: (name) => name === 'main' || name === 'import',
                entryOrder: ENTRY_ORDER.Last,
              },
              files: [path.join(__dirname, './src/tracer-code.js')]
            },
            {
              options: {
                entryName: (name) => name === 'main' || name === 'import',
                entryOrder: ENTRY_ORDER.Last,
              },
              files: [path.join(__dirname, './src/common-tracer.js')]
            },
            {
              options: {
                entryName: (name) => name === 'main' || name === 'import',
                entryOrder: ENTRY_ORDER.First,
              },
              files: [path.join(__dirname, './src/tracer.js')]
            }
          ],
        })
      ]
    };
    
    // Запускаем webpack
    let w = webpack(config, (err, stats) => {
      if (err || stats.hasErrors()) {
        console.error(err || stats.toString());
      }
      done();
    });
  });
  
  // test('должен инжектировать код в конструкторы', () => {
  //   const newCode = fs.readFileSync(outputFile, 'utf8');
    
  //   Object.keys(targetsConfig).forEach(className => {
  //       const classProps = targetsConfig[className];
        
  //       classProps.forEach((propName) => {
  //           const pos = newCode.indexOf(TracerCodeGenerator.observeProperty(className, propName));
  //           expect(pos > -1).toBe(true);
  //       });
  //   });
  // });

  // test('Плагин должен включить в сборку файлы сценариев', () => {
  //   const newCode = fs.readFileSync(outputFile, 'utf8');

  //   expect(newCode.indexOf('tracer-js') > -1).toBe(true);
  //   expect(newCode.indexOf('common-tracer-js') > -1).toBe(true);
  //   expect(newCode.indexOf('tracer-code-js') > -1).toBe(true);
  // })

  test('CEditorPage добавляет ссылку на себя в window.page', () => {
    const newCode = fs.readFileSync(outputFile, 'utf8');
    expect(newCode.indexOf('window.page = this;') > -1).toBe(true);
  });

  test('injects tracer runtime bootstrap', () => {
    const newCode = fs.readFileSync(outputFile, 'utf8');
    expect(newCode.includes('__WEBPACK_TRACER_RUNTIME_BOOTSTRAP__')).toBe(true);
    expect(newCode.includes('__WEBPACK_TRACER_RUNTIME_BOOTSTRAPPED__')).toBe(true);
    expect(newCode.includes('__WEBPACK_TRACER_RUNTIME_INSTANCE__')).toBe(true);
  });

  // test('asc_docs_api добавляет ссылку на себя в window.api', () => {
  //   const newCode = fs.readFileSync(outputFile, 'utf8');
  //   expect(newCode.indexOf('window.api = this;') > -1).toBe(true);
  // });
});
