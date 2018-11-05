var path = require('path');
var fs = require('fs');
const extract = require('babel-extract-comments');
const babelParser = require('babylon');
const babelTraverse = require('@babel/traverse').default
const stringify = require('csv-stringify')
const vueSrc = '/Users/wendahuang/Desktop/vue/';
let srcDir = path.resolve(vueSrc, 'src')

const blackList = ['.DS_Store']
/*
description: 提取文件中的注释和标识符
 */
function extractFileInfo(fpath) {
    const code = fs.readFileSync(fpath, 'utf-8'),
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
            FunctionDeclaration({ node }) {
                identifiers.push(node.id.name)
            },
            ClassDeclaration({ node }) {
                identifiers.push(node.id.name)
            },
            ClassProperty({ node }) {
                identifiers.push(node.key.name)
            },
            ImportDeclaration({ node }) {
                const { specifiers } = node
                for (let i = 0, len = specifiers.length; i < len; i++) {
                    identifiers.push(specifiers[i].local.name)
                }
            }
        }
    const comments = ast.comments
    babelTraverse(ast, visitor);
    console.log(identifiers)
}

/*
@desc 递归地遍历文件夹
 */
function traverseDir(dir) {
    const files = fs.readdirSync(dir)
    files.forEach(function(file, index) {
        if (blackList.indexOf(file) !== -1) return
        var curPath = path.resolve(dir, file),
            info = fs.statSync(curPath)
        if (info.isDirectory()) {
            traverseDir(curPath);
        } else {
        	extractFileInfo(curPath)
        }
    })
}

traverseDir(srcDir)
/*const data=[{comments:'what am sfsd',identifiers:['what','hey']}]
stringify(data,{
	header:true
},(err,data)=>{
	console.log(data)
})*/
// extractInfo()