const { NodePath, TraversalContext } = require('@babel/traverse');

/**
 * 获取函数调用的完整名称
 *
 * @param {CallExpression} node AST 节点
 * @return {String} key
 */
function getCalleeName(node) {
  if (node.callee.name) {
    return node.callee.name;
  }
  if (node.callee.object) {
    const name = getPropertyByMemberExpressionNode(node.callee);
    return name;
  }
  // super 调用
  if (node.callee.type === 'Super') {
    return 'super';
  }
  // 其他情况暂时不处理
  // throw new Error('invalid callee');
  return '';
}
/**
 * 检测一个字符串中是否含有中文
 * @param {String} text 输入字符串
 * @return {Boolean} value 是否含有中文
 */
function isChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

function usePrefix(prefix, suffix) {
  return name => {
    return prefix + name + suffix;
  };
}



module.exports = { isChinese, getCalleeName, usePrefix };
