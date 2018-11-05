var path = require('path');
var fs = require('fs');
const extract = require('babel-extract-comments');
const babelParser = require('babylon');
const babelTraverse = require('@babel/traverse').default
const vueSrc = '/Users/wendahuang/Desktop/vue/';
let directory = path.resolve(vueSrc, 'src')

/*
description: 提取文件中的注释和标识符
 */
function extractInfo() {
    const code=fs.readFileSync(path.resolve(directory,'core/vdom/patch.js'),'utf-8'),
        identifiers = [],
        ast = babelParser.parse(code, {
            // parse in strict mode and allow module declarations
            sourceType: "module",
            plugins: [
                // enable jsx and flow syntax
                "flow"
            ]
        }),
        visitor = {
            VariableDeclaration({ node }) {
                let { declarations } = node
                for (let i = 0, len = declarations.length; i < len; i++) {
                    identifiers.push(declarations[i].id.name)
                }
            },
            FunctionDeclaration({node}) {
            	identifiers.push(node.id.name)
            },
            ClassDeclaration({node}){
            	identifiers.push(node.id.name)
            },
            ClassProperty({node}){
            	identifiers.push(node.key.name)
            },
            ImportDeclaration({node}){
            	const {specifiers}=node
            	for(let i=0,len=specifiers.length;i<len;i++){
            		identifiers.push(specifiers[i].local.name)
            	}
            }
        }
    const comments = ast.comments
    babelTraverse(ast, visitor);
    console.log(identifiers)
}
extractInfo()
