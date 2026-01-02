/**
 * Babel Plugin: Auto-Trace
 * Automatically inserts trace logs into all functions for AI-assisted debugging.
 *
 * Features:
 * - Traces function entry with arguments
 * - Traces function exit with return value
 * - Traces errors with message
 * - Skips React components and hooks (too noisy)
 * - Respects shouldTrace() for runtime control
 *
 * Usage:
 * - Backend: SPECWRIGHT_TRACE=true npm run dev
 * - Frontend: Controlled via Vite config
 */

module.exports = function({ types: t }) {

  function shouldSkip(path, state) {
    const filename = state.filename || '';

    // Skip non-source files
    if (filename.includes('node_modules')) return true;
    if (filename.includes('.test.') || filename.includes('.spec.')) return true;
    if (filename.includes('babel-plugin')) return true;
    if (filename.includes('trace-config')) return true;

    // Get function name
    const name = getFunctionName(path);

    // Skip React components (PascalCase)
    if (name && /^[A-Z][a-zA-Z0-9]*$/.test(name)) return true;

    // Skip hooks (useXxx)
    if (name && /^use[A-Z]/.test(name)) return true;

    // Skip inline arrow functions (callbacks like .map(), .filter())
    if (path.isArrowFunctionExpression()) {
      const parent = path.parentPath;
      if (!parent.isVariableDeclarator() &&
          !parent.isExportDefaultDeclaration() &&
          !parent.isObjectProperty() &&
          !parent.isClassProperty()) {
        return true;
      }
    }

    // Skip getters/setters
    if (path.parentPath.isObjectMethod && path.parentPath.isObjectMethod() &&
        (path.parentPath.node.kind === 'get' || path.parentPath.node.kind === 'set')) {
      return true;
    }

    // Skip very short functions (likely simple getters/utilities)
    const body = path.node.body;
    if (t.isBlockStatement(body) && body.body.length === 1 &&
        t.isReturnStatement(body.body[0]) &&
        !t.isCallExpression(body.body[0].argument)) {
      // Skip simple return statements like: () => { return this.value; }
      // But keep functions that call other functions
    }

    return false;
  }

  function getFunctionName(path) {
    // Named function
    if (path.node.id) return path.node.id.name;

    // Variable declaration: const foo = () => {}
    if (path.parentPath.isVariableDeclarator()) {
      return path.parentPath.node.id.name;
    }

    // Object property: { foo: () => {} }
    if (path.parentPath.isObjectProperty()) {
      const key = path.parentPath.node.key;
      return key.name || key.value;
    }

    // Class method
    if (path.parentPath.isClassMethod && path.parentPath.isClassMethod()) {
      const key = path.parentPath.node.key;
      return key.name || key.value;
    }

    if (path.parentPath.isClassProperty && path.parentPath.isClassProperty()) {
      const key = path.parentPath.node.key;
      return key.name || key.value;
    }

    // Export default
    if (path.parentPath.isExportDefaultDeclaration()) {
      return 'default';
    }

    return null;
  }

  function getFileName(state) {
    const filename = state.filename || '';
    // Extract just the relevant part: src/services/auth.ts -> services/auth
    const match = filename.match(/(?:src|app|lib|components|services|utils)[\/\\](.+?)\.(ts|tsx|js|jsx)$/);
    if (match) {
      return match[1].replace(/[\/\\]/g, '/');
    }
    // Fallback: just get the filename
    const parts = filename.split(/[\/\\]/);
    const file = parts[parts.length - 1];
    return file.replace(/\.(ts|tsx|js|jsx)$/, '');
  }

  function createTraceCall(t, type, name, file, argExpr) {
    // Creates: __trace({ type, name, file, data })
    const props = [
      t.objectProperty(t.identifier('type'), t.stringLiteral(type)),
      t.objectProperty(t.identifier('name'), t.stringLiteral(name)),
      t.objectProperty(t.identifier('file'), t.stringLiteral(file)),
    ];

    if (argExpr) {
      props.push(t.objectProperty(t.identifier('data'), argExpr));
    }

    return t.expressionStatement(
      t.callExpression(
        t.identifier('__trace'),
        [t.objectExpression(props)]
      )
    );
  }

  function wrapFunction(path, t, state) {
    const name = getFunctionName(path) || 'anonymous';
    const file = getFileName(state);

    const body = path.node.body;

    // Handle arrow functions with expression body: () => expression
    if (!t.isBlockStatement(body)) {
      const resultId = path.scope.generateUidIdentifier('result');

      const entryTrace = createTraceCall(t, 'entry', name, file,
        t.arrayExpression(
          path.node.params.map(p => {
            if (t.isIdentifier(p)) return p;
            if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) return p.left;
            if (t.isRestElement(p) && t.isIdentifier(p.argument)) return p.argument;
            return t.identifier('undefined');
          })
        )
      );

      const exitTrace = createTraceCall(t, 'exit', name, file, resultId);

      const errorTrace = createTraceCall(t, 'error', name, file,
        t.memberExpression(t.identifier('__err'), t.identifier('message')));

      const newBody = t.blockStatement([
        entryTrace,
        t.tryStatement(
          t.blockStatement([
            t.variableDeclaration('const', [
              t.variableDeclarator(resultId, body)
            ]),
            exitTrace,
            t.returnStatement(resultId)
          ]),
          t.catchClause(
            t.identifier('__err'),
            t.blockStatement([
              errorTrace,
              t.throwStatement(t.identifier('__err'))
            ])
          )
        )
      ]);

      path.node.body = newBody;
      return;
    }

    // Handle block statement body
    const entryTrace = createTraceCall(t, 'entry', name, file,
      t.arrayExpression(
        path.node.params.map(p => {
          if (t.isIdentifier(p)) return p;
          if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) return p.left;
          if (t.isRestElement(p) && t.isIdentifier(p.argument)) return p.argument;
          return t.identifier('undefined');
        })
      )
    );

    const errorTrace = createTraceCall(t, 'error', name, file,
      t.memberExpression(t.identifier('__err'), t.identifier('message')));

    // Wrap all return statements
    path.traverse({
      ReturnStatement(returnPath) {
        if (returnPath.node.__traced) return;

        // Skip if we're in a nested function
        const parentFunc = returnPath.getFunctionParent();
        if (parentFunc !== path) return;

        const resultId = returnPath.scope.generateUidIdentifier('result');
        const exitTrace = createTraceCall(t, 'exit', name, file, resultId);

        if (returnPath.node.argument) {
          const newReturn = t.returnStatement(resultId);
          newReturn.__traced = true;

          const replacement = [
            t.variableDeclaration('const', [
              t.variableDeclarator(resultId, returnPath.node.argument)
            ]),
            exitTrace,
            newReturn
          ];
          returnPath.replaceWithMultiple(replacement);
        } else {
          const exitVoid = createTraceCall(t, 'exit', name, file, t.identifier('undefined'));
          returnPath.insertBefore(exitVoid);
          returnPath.node.__traced = true;
        }
      }
    });

    // Check if function might not have explicit return
    const hasImplicitReturn = !body.body.some(stmt => t.isReturnStatement(stmt));
    const implicitExitTrace = hasImplicitReturn
      ? [createTraceCall(t, 'exit', name, file, t.identifier('undefined'))]
      : [];

    // Wrap entire body in try-catch
    const originalBody = [...body.body];
    body.body = [
      entryTrace,
      t.tryStatement(
        t.blockStatement([...originalBody, ...implicitExitTrace]),
        t.catchClause(
          t.identifier('__err'),
          t.blockStatement([
            errorTrace,
            t.throwStatement(t.identifier('__err'))
          ])
        )
      )
    ];
  }

  let hasTracedFunctions = false;

  return {
    visitor: {
      Program: {
        enter(path, state) {
          hasTracedFunctions = false;
        },
        exit(path, state) {
          if (!hasTracedFunctions) return;

          // Inject the __trace helper at the top of the file
          const isTypeScript = state.filename && (state.filename.endsWith('.ts') || state.filename.endsWith('.tsx'));

          const traceImport = t.importDeclaration(
            [t.importSpecifier(t.identifier('__trace'), t.identifier('createTracer'))],
            t.stringLiteral('./utils/trace-config.js')
          );

          // Find the right place to insert (after other imports)
          let lastImportIndex = -1;
          path.node.body.forEach((node, index) => {
            if (t.isImportDeclaration(node)) {
              lastImportIndex = index;
            }
          });

          // Create the tracer initialization
          const tracerInit = t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier('__trace'),
              t.callExpression(t.identifier('createTracer'), [])
            )
          ]);

          // We need to use a dynamic import approach for ESM
          // Instead, let's create an inline tracer that checks the env
          const inlineTracer = t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier('__trace'),
              t.callExpression(
                t.arrowFunctionExpression(
                  [],
                  t.blockStatement([
                    // const enabled = typeof process !== 'undefined' && process.env.SPECWRIGHT_TRACE === 'true'
                    t.variableDeclaration('const', [
                      t.variableDeclarator(
                        t.identifier('__enabled'),
                        t.logicalExpression(
                          '&&',
                          t.binaryExpression(
                            '!==',
                            t.unaryExpression('typeof', t.identifier('process')),
                            t.stringLiteral('undefined')
                          ),
                          t.binaryExpression(
                            '===',
                            t.memberExpression(
                              t.memberExpression(t.identifier('process'), t.identifier('env')),
                              t.identifier('SPECWRIGHT_TRACE')
                            ),
                            t.stringLiteral('true')
                          )
                        )
                      )
                    ]),
                    // let depth = 0
                    t.variableDeclaration('let', [
                      t.variableDeclarator(t.identifier('__depth'), t.numericLiteral(0))
                    ]),
                    // return function
                    t.returnStatement(
                      t.arrowFunctionExpression(
                        [t.identifier('e')],
                        t.blockStatement([
                          // if (!enabled) return
                          t.ifStatement(
                            t.unaryExpression('!', t.identifier('__enabled')),
                            t.returnStatement()
                          ),
                          // const indent = '  '.repeat(depth)
                          t.variableDeclaration('const', [
                            t.variableDeclarator(
                              t.identifier('indent'),
                              t.callExpression(
                                t.memberExpression(t.stringLiteral('  '), t.identifier('repeat')),
                                [t.identifier('__depth')]
                              )
                            )
                          ]),
                          // Format data helper inline
                          t.variableDeclaration('const', [
                            t.variableDeclarator(
                              t.identifier('fmt'),
                              t.arrowFunctionExpression(
                                [t.identifier('v')],
                                t.conditionalExpression(
                                  t.binaryExpression('===', t.identifier('v'), t.identifier('undefined')),
                                  t.stringLiteral(''),
                                  t.conditionalExpression(
                                    t.binaryExpression('===', t.identifier('v'), t.nullLiteral()),
                                    t.stringLiteral('null'),
                                    t.conditionalExpression(
                                      t.callExpression(
                                        t.memberExpression(t.identifier('Array'), t.identifier('isArray')),
                                        [t.identifier('v')]
                                      ),
                                      t.templateLiteral(
                                        [t.templateElement({ raw: 'Array(' }), t.templateElement({ raw: ')' }, true)],
                                        [t.memberExpression(t.identifier('v'), t.identifier('length'))]
                                      ),
                                      t.conditionalExpression(
                                        t.binaryExpression('===', t.unaryExpression('typeof', t.identifier('v')), t.stringLiteral('object')),
                                        t.stringLiteral('{...}'),
                                        t.callExpression(t.identifier('String'), [t.identifier('v')])
                                      )
                                    )
                                  )
                                )
                              )
                            )
                          ]),
                          // Format args - check if data is array before calling map
                          t.variableDeclaration('const', [
                            t.variableDeclarator(
                              t.identifier('args'),
                              t.conditionalExpression(
                                t.logicalExpression(
                                  '&&',
                                  t.memberExpression(t.identifier('e'), t.identifier('data')),
                                  t.callExpression(
                                    t.memberExpression(t.identifier('Array'), t.identifier('isArray')),
                                    [t.memberExpression(t.identifier('e'), t.identifier('data'))]
                                  )
                                ),
                                t.callExpression(
                                  t.memberExpression(
                                    t.callExpression(
                                      t.memberExpression(
                                        t.memberExpression(t.identifier('e'), t.identifier('data')),
                                        t.identifier('map')
                                      ),
                                      [t.identifier('fmt')]
                                    ),
                                    t.identifier('join')
                                  ),
                                  [t.stringLiteral(', ')]
                                ),
                                t.callExpression(t.identifier('fmt'), [t.memberExpression(t.identifier('e'), t.identifier('data'))])
                              )
                            )
                          ]),
                          // Switch on type
                          t.ifStatement(
                            t.binaryExpression('===', t.memberExpression(t.identifier('e'), t.identifier('type')), t.stringLiteral('entry')),
                            t.blockStatement([
                              t.expressionStatement(
                                t.callExpression(
                                  t.memberExpression(t.identifier('console'), t.identifier('log')),
                                  [
                                    t.templateLiteral(
                                      [
                                        t.templateElement({ raw: '' }),
                                        t.templateElement({ raw: '\\x1b[36m→\\x1b[0m ' }),
                                        t.templateElement({ raw: '(' }),
                                        t.templateElement({ raw: ') \\x1b[2m' }),
                                        t.templateElement({ raw: '\\x1b[0m' }, true)
                                      ],
                                      [
                                        t.identifier('indent'),
                                        t.memberExpression(t.identifier('e'), t.identifier('name')),
                                        t.identifier('args'),
                                        t.memberExpression(t.identifier('e'), t.identifier('file'))
                                      ]
                                    )
                                  ]
                                )
                              ),
                              t.expressionStatement(
                                t.updateExpression('++', t.identifier('__depth'))
                              )
                            ]),
                            t.ifStatement(
                              t.binaryExpression('===', t.memberExpression(t.identifier('e'), t.identifier('type')), t.stringLiteral('exit')),
                              t.blockStatement([
                                t.expressionStatement(
                                  t.assignmentExpression(
                                    '=',
                                    t.identifier('__depth'),
                                    t.callExpression(
                                      t.memberExpression(t.identifier('Math'), t.identifier('max')),
                                      [t.numericLiteral(0), t.binaryExpression('-', t.identifier('__depth'), t.numericLiteral(1))]
                                    )
                                  )
                                ),
                                t.expressionStatement(
                                  t.callExpression(
                                    t.memberExpression(t.identifier('console'), t.identifier('log')),
                                    [
                                      t.templateLiteral(
                                        [
                                          t.templateElement({ raw: '' }),
                                          t.templateElement({ raw: '\\x1b[32m←\\x1b[0m ' }),
                                          t.templateElement({ raw: ' → ' }),
                                          t.templateElement({ raw: '' }, true)
                                        ],
                                        [
                                          t.identifier('indent'),
                                          t.memberExpression(t.identifier('e'), t.identifier('name')),
                                          t.callExpression(t.identifier('fmt'), [t.memberExpression(t.identifier('e'), t.identifier('data'))])
                                        ]
                                      )
                                    ]
                                  )
                                )
                              ]),
                              t.blockStatement([
                                t.expressionStatement(
                                  t.assignmentExpression(
                                    '=',
                                    t.identifier('__depth'),
                                    t.callExpression(
                                      t.memberExpression(t.identifier('Math'), t.identifier('max')),
                                      [t.numericLiteral(0), t.binaryExpression('-', t.identifier('__depth'), t.numericLiteral(1))]
                                    )
                                  )
                                ),
                                t.expressionStatement(
                                  t.callExpression(
                                    t.memberExpression(t.identifier('console'), t.identifier('log')),
                                    [
                                      t.templateLiteral(
                                        [
                                          t.templateElement({ raw: '' }),
                                          t.templateElement({ raw: '\\x1b[31m✗\\x1b[0m ' }),
                                          t.templateElement({ raw: ': ' }),
                                          t.templateElement({ raw: '' }, true)
                                        ],
                                        [
                                          t.identifier('indent'),
                                          t.memberExpression(t.identifier('e'), t.identifier('name')),
                                          t.memberExpression(t.identifier('e'), t.identifier('data'))
                                        ]
                                      )
                                    ]
                                  )
                                )
                              ])
                            )
                          )
                        ])
                      )
                    )
                  ])
                ),
                []
              )
            )
          ]);

          path.node.body.unshift(inlineTracer);
        }
      },

      FunctionDeclaration(path, state) {
        if (shouldSkip(path, state)) return;
        wrapFunction(path, t, state);
        hasTracedFunctions = true;
      },

      FunctionExpression(path, state) {
        if (shouldSkip(path, state)) return;
        wrapFunction(path, t, state);
        hasTracedFunctions = true;
      },

      ArrowFunctionExpression(path, state) {
        if (shouldSkip(path, state)) return;
        wrapFunction(path, t, state);
        hasTracedFunctions = true;
      },
    },
  };
};
