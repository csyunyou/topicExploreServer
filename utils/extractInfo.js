var path = require('path');
var fs = require('fs');
const extract = require('babel-extract-comments');
const babelParser = require('babylon');
const babelTraverse = require('@babel/traverse').default
const stringify = require('csv-stringify')
const vueSrc = '/Users/wendahuang/Desktop/vue/';
let srcDir = path.resolve(vueSrc, 'src')

const blackList = ['.DS_Store'], res = []
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
                    switch (declarations[i].id.type) {
                        // 解构赋值
                        case 'ObjectPattern':
                            const { properties } = declarations[i].id
                            properties.forEach(({ key }) => {
                                identifiers.push(key.name)
                            })
                            break;
                        default:
                            identifiers.push(declarations[i].id.name)
                            break;
                    }
                }
            },
            FunctionDeclaration({ node }) {
                // 处理匿名函数
                node.id && (identifiers.push(node.id.name))
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
    // console.log('identifiers:', identifiers, fpath)
    res.push({
        identifiers: identifiers.map(formatIdentifier)
            .reduce((a, b) => a.concat(b), [])
            .join(' ')
            .toLocaleLowerCase(),
        comments: comments.map(d => d.value).join(' ').toLocaleLowerCase(),
        fileName: fpath
    })
}

/*
@desc 递归地遍历文件夹
 */
function traverseDir(dir) {
    const files = fs.readdirSync(dir)
    files.forEach(function (file, index) {
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

/**
 * 
 * @param {string} id 
 * @description 格式化标识符名称
 * ASSET_TYPES LIFECYCLE_HOOKS
 * generateComponentTrace
 */
function formatIdentifier(id) {
    let res = []
    if (id.indexOf('_') !== -1) res = id.split('_')
    else res = id.replace(/([a-z])([A-Z])/g, '$1-$2').split('-')
    return res
}

/*
@desc 将对象转成csv格式并写入文件
 */
function write2Csv(res) {
    stringify(res, {
        header: true
    }, (err, data) => {
        // console.log(data)
        fs.writeFileSync('/Users/wendahuang/Desktop/data/vue-1.0.20.csv', data)
        console.log("finish writing")
    })
}

// extractFileInfo('../mock/commentId.js')

traverseDir(srcDir)
write2Csv(res)

// console.log(res)

// extractInfo()