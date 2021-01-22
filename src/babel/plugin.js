const { NodePath } = require('@babel/traverse');
const jsxBuildChildren = require('@babel/types/lib/builders/react/buildChildren')
  .default;
const Babel = require('@babel/core');
const babelParser = require('@babel/parser');
const {
  isChinese,
  usePrefix,
  getCalleeName,
  TraverseState,
} = require('./utils');

const NEXTLINEIGNORE = 'starling-disable-next-line';
const CURRENTIGNORE = 'starling-disable-line';

/**
 *
 * @param babel {Babel}
 * @returns {{visitor: {FunctionDeclaration(): void, FunctionExpression(*, *): void, VariableDeclaration(*, *), ObjectExpression(*): void, VariableDeclarator(NodePath, *): void}}}
 */
function getTransformVisitor(babel) {
  const i18nFunctionNameList = ['i18n'];
  function report(...args) {
    console.log('report args', args);
  }
  const { config = {} } = this || {};
  const { openNonCn = false, i18n = {} } = config;
  const { interpolation = {} } = i18n;
  const { prefix = '{', suffix = '}' } = interpolation;
  const setPrefix = usePrefix(prefix, suffix);
  let totalComments = [];

  /**
   * 跳过一些特定函数调用的参数
   * @param  path{NodePath}
   * @param  state{TraverseState}
   * @description
   *  1. console 函数调用参数中包括中文，不处理
   *  2. 跳过 JSX 编译之后的函数 React.createElement，否则会造成节点递归的重复遍历
   *  3. TODO: i18n 函数调用参数中，可能包含中文（默认文案），不处理
   */
  const CallExpressionVisitor = function CallExpression(path, state) {
    try {
      const name = getCalleeName(path.node);
      const inBlackList = i18nFunctionNameList.find(fn => fn === name);
      if (path.node.callee && path.node.callee.object) {
        // skip console.xxx()
        if (path.node.callee.object.name === 'console') {
          path.skip();
          return;
        }
        // skip React.createElement()
        if (
          path.node.callee.object.name === 'React' &&
          path.node.callee.property.name === 'createElement'
        ) {
          path.skip();
          return;
        }
      }
      if (openNonCn) {
        // TODO
      } else if (inBlackList) {
        path.skip();
      }
    } catch (err) {
      // TODO
    }
  };

  const findChineseStringLiteralVisitor = {
    /**
     *
     * @param path{NodePath}
     * @param context{TraverseState}
     * @constructor
     */
    StringLiteral(path, context) {
      if (isChinese(path.node.value)) {
        context.hasChinese = true;
        path.stop();
      }
    },
    CallExpression: CallExpressionVisitor,
  };

  const checkIgnore = path => {
    return (
      path.node &&
      path.node.loc &&
      totalComments.includes(path.node.loc.start.line)
    );
  };

  return {
    visitor: {
      Program(path) {
        totalComments = path.parent.comments
          .map(comment => {
            if (comment.value.indexOf(NEXTLINEIGNORE) > 0) {
              return comment.loc.start.line + 1;
            }

            if (comment.value.indexOf(CURRENTIGNORE) > 0) {
              return comment.loc.start.line;
            }

            return null;
          })
          .filter(x => !!x);
      },
      /**
       * 跳过一些特定的 JSXAttribute
       * @param path{NodePath}
       * @param state{TraverseState}
       * @description
       *  1. defaultMessage intl 组件默认文案的参数名
       */
      JSXAttribute(path, state) {
        const { node } = path;
        if (node.name.name === 'defaultMessage') {
          // 默认文案的参数，跳过
          path.skip();
          return;
        }
        if (!node.value) {
          path.skip();
          return;
        }
      },
      /**
       * @param path{NodePath}
       * @param state{TraverseState}
       */
      JSXExpressionContainer(path,state) {
        // case <div>我是一个段落{'我是一个中文'}</div>，不再重复进入 StringLiteral 收集文案
        if (path.visited) path.skip();
      },

      /**
       * 特殊处理 JSXText
       * @param path{NodePath}
       * @param state{TraverseState}
       * @description
       *  1. 表达式直接继续让 StringLiteral 处理，case1: <div>{"测试文案"}</div>
       *  2. 普通文本直接处理，case2: <div>测试文案</div>
       */
      JSXText(path, state) {
        debugger;
        if (path.parent.type === 'JSXExpressionContainer') {
          return;
        }
        if (checkIgnore(path)) {
          return;
        }
        const { node } = path;
        if (
          path.visited ||
          !node.value ||
          !node.value.trim() ||
          !isChinese(node.value)
        ) {
          path.skip();
          return;
        }
        // 避免重复进入收集
        path.visited = true;

        const index = path.key;
        const siblingPath = path.parentPath.get('children');

        // JSXText 前面如果是 Indentifier 则应该合并
        let startIndex = index;
        for (let i = index - 1; i >= 0; i--) {
          const p = siblingPath[i];
          if (p.type === 'JSXText') {
            // 理论上不会进入这里
            p.visited = true;
            startIndex = i;
          } else if (p.type === 'JSXExpressionContainer') {
            let context = { hasChinese: false };
            p.traverse(findChineseStringLiteralVisitor, context);
            if (context.hasChinese) {
              break;
            } else {
              startIndex = i;
            }
          } else {
            break;
          }
        }
        // JSXText 后面如果是 Indentifier 则应该合并
        let endIndex = index + 1;
        for (let i = endIndex; i < siblingPath.length; i++) {
          const p = siblingPath[i];
          if (p.type === 'JSXText') {
            p.visited = true;
            endIndex = i + 1;
          } else if (p.type === 'JSXExpressionContainer') {
            let context = { hasChinese: false };
            p.traverse(findChineseStringLiteralVisitor, context);
            if (context.hasChinese) {
              break;
            } else {
              endIndex = i + 1;
            }
          } else {
            break;
          }
        }
        const tempJsxElement =
          siblingPath.slice(startIndex, endIndex).reduce((acc, p) => {
            acc += p.toString();
            return acc;
          }, '<div>') + '</div>';
        const ast = babelParser.parse(tempJsxElement, {
          plugins: ['jsx', 'typescript'],
        });
        const code = tempJsxElement;
        const childrenValue = jsxBuildChildren(ast.program.body[0].expression);
        const variable = {};
        const value = childrenValue
          .reduce((result, childValue, i) => {
            if (childValue.type === 'StringLiteral') {
              result += childValue.value;
            } else if (childValue.type === 'Identifier') {
              const { name } = childValue;
              result += setPrefix(childValue.name);
              variable[name] = name;
            } else {
              const { start, end } = childValue;
              const val = code.slice(start, end);
              const name = `placeholder${i}`;
              result += setPrefix(name);
              variable[name] = val;
              // nodeType = 'JSXTextWithExpression';
            }
            return result;
          }, '')
          .trim();
        // 使用这步去掉 jsxText 无用的空格换行
        // "\n     申请权限   \n"   =====>   "申请权限"
        // const childrenValue = jsxBuildChildren(path.parent) || [];
        // const variable = {};
        // const value = childrenValue.slice(index, endIndex).reduce((result, childValue) => {
        //   if (childValue.type === 'StringLiteral') {
        //     result += childValue.value;
        //   } else if (childValue.type === 'Identifier') {
        //     const { name } = childValue;
        //     result += `{${childValue.name}}`;
        //     variable[name] = name;
        //   }
        //   return result;
        // }, '').trim();
        // 获取 children 的 path
        const raw = siblingPath
          .slice(startIndex, endIndex)
          .reduce(
            (result, childPath) =>
              result + (childPath.getSource() || childPath.toString()),
            '',
          );
        // 修正合并后的位置信息
        if (startIndex !== index) {
          path.node.loc.start = siblingPath[startIndex].node.loc.start;
          path.node.start = siblingPath[startIndex].node.start;
        }
        if (endIndex - 1 > 0) {
          path.node.loc.end = siblingPath[endIndex - 1].node.loc.end;
          path.node.end = siblingPath[endIndex - 1].node.end;
        }

        // if (path.parent) {
        //   const children = jsxBuildChildren(path.parent) || [];
        //   // 获取到对应的 索引
        //   if (children[index].type === 'StringLiteral') {
        //     value = children[index].value;
        //     text = value;
        //   }
        // }
        report({
          status: 'unhandled',
          astPath: path,
          value,
          text: raw,
          raw,
          type: 'jsx',
          nodeType: 'JSXText',
          reactPlaceHolder: false,
          variable,
        });
        path.skip();
      },
      /**
       * @param path{NodePath}
       * @param state{TraverseState}
       */
      StringLiteral(path,state) {
        if (path.visited) return;
        if (checkIgnore(path)) {
          return;
        }
        const { node } = path;
        const { value } = node;
        if (openNonCn) {
          // 开启非中文扫描，统一上报
        } else if (!isChinese(value)) {
          path.skip();
          return;
        }
        let raw = value;
        if (node.extra && node.extra.raw) {
          raw = node.extra.raw;
        }
        // case: <FeedCard name="好玩" />
        if (path.parent.type === 'JSXAttribute') {
          report({
            status: 'unhandled',
            astPath: path,
            value: value.trim(),
            text: value,
            raw,
            nodeType: 'JSXAttribute',
            reactPlaceHolder: false,
          });
        } else if (path.parent.type === 'ObjectProperty') {
          // case: {label: '所有', value: ''}
          report({
            status: 'unhandled',
            astPath: path,
            value,
            text: value,
            raw,
            nodeType: 'ObjectProperty',
          });
        } else if (path.parent.type === 'AssignmentExpression') {
          // case: foo = "测试文案"
          report({
            status: 'unhandled',
            astPath: path,
            value,
            text: value,
            raw,
            nodeType: 'AssignmentExpression',
          });
        } else {
          report({
            status: 'unhandled',
            astPath: path,
            value,
            text: value,
            raw,
            nodeType: 'StringLiteral',
          });
        }
        path.skip();
      },

      /**
       * @param path{NodePath}
       * @param state{TraverseState}
       * case: `测试 ${util.test}`
       * case: `测试`
       */
      TemplateElement(path,state) {
        if (checkIgnore(path)) {
          return;
        }
        const currentNode = path.node;
        // 空字符串，非中文字符串，直接退出
        const cookedValue = currentNode.value && currentNode.value.cooked;
        if (
          (path.visited && !cookedValue) ||
          !cookedValue.trim() ||
          !isChinese(cookedValue)
        )
          return;
        path.visited = true;

        const expressions = path.parentPath.get('expressions');
        const quasis = path.parentPath.get('quasis');
        const children = []
          .concat(
            quasis.filter(p => p.node.start !== p.node.end),
            expressions,
          )
          .sort((a, b) => a.node.start - b.node.start);
        const index = quasis.findIndex(p => p.node.start === currentNode.start);
        let startIndex = index;
        const simpleNodeType = [
          'TemplateElement',
          'StringLiteral',
          'Identifier',
        ];
        for (let i = index - 1; i >= 0; i--) {
          const path = children[i];
          if (simpleNodeType.includes(path.type)) {
            path.visited = true;
            startIndex = i;
          } else if (path.isExpression()) {
            let context = { hasChinese: false };
            path.traverse(findChineseStringLiteralVisitor, context);
            if (context.hasChinese) {
              break;
            } else {
              startIndex = i;
            }
          } else {
            break;
          }
        }
        let endIndex = index + 1;
        for (let i = endIndex; i < children.length; i++) {
          const path = children[i];
          if (simpleNodeType.includes(path.type)) {
            path.visited = true;
            endIndex = i + 1;
          } else if (path.isExpression()) {
            let context = { hasChinese: false };
            path.traverse(findChineseStringLiteralVisitor, context);
            if (context.hasChinese) {
              break;
            } else {
              endIndex = i + 1;
            }
          } else {
            break;
          }
        }
        const resultPaths = children.slice(startIndex, endIndex);
        const variable = {};
        const [raw, value] = resultPaths.reduce(
          (acc, path, i) => {
            if (path.type === 'StringLiteral') {
              const [raw, value] = acc;
              return [`${raw}\${${path.getSource()}}`, value + path.node.value];
            } else if (path.type === 'Identifier') {
              let [raw, value] = acc;
              const source = path.getSource();
              const name = source;
              variable[name] = name;
              value += setPrefix(source);
              return [`${raw}\${${source}}`, value];
            } else if (path.type === 'TemplateElement') {
              const [raw, value] = acc;
              const source = path.getSource();
              return [raw + source, value + source];
            } else {
              let [raw, value] = acc;
              const name = 'placeholder' + i;
              const source = path.getSource();
              variable[name] = source;
              value += setPrefix(name);
              return [`${raw}\${${source}}`, value];
            }
          },
          ['', ''],
        );
        if (startIndex !== index) {
          const startNode = children[startIndex].node;
          if (startNode.type === 'TemplateElement') {
            path.node.loc.start = startNode.loc.start;
            path.node.start = startNode.start;
          } else {
            const { line, column } = startNode.loc.start;
            path.node.loc.start = { line: line, column: column - 2 };
            path.node.start = startNode.start - 2;
          }
        }
        if (endIndex - 1 > 0) {
          const endNode = children[endIndex - 1].node;
          if (endNode.type === 'TemplateElement') {
            path.node.loc.end = endNode.loc.end;
            path.node.end = endNode.end;
          } else {
            const { line, column } = endNode.loc.end;
            path.node.loc.end = { line: line, column: column + 1 };
            path.node.end = endNode.end + 1;
          }
        }
        report({
          status: 'unhandled',
          astPath: path,
          value,
          text: raw,
          raw,
          nodeType: 'TemplateElement',
          reactPlaceHolder: false,
          variable,
        });
      },
      TaggedTemplateExpression(path) {
        try {
          // 跳过style-component的代码
          // const { name, type } = path.node.tag.object;
          // if (name === 'styled' && type === 'Identifier') {
          path.skip();
          // }
        } catch (error) {}
      },
      CallExpression: CallExpressionVisitor,
    },
  };
}

module.exports = getTransformVisitor;
