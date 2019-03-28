var path = require('path');
var fs = require('fs');
const extract = require('babel-extract-comments');
const babelParser = require('babylon');
const babelTraverse = require('@babel/traverse').default
const stringify = require('csv-stringify')
const blackList = ['.DS_Store']
let res = []

/*
description: 提取文件中的注释和标识符
 */
function extractFileInfo(fpath) {
    let funcNum = 0
    const code = fs.readFileSync(fpath, 'utf-8'),
        fInfo = fs.statSync(fpath),
        identifiers = []
        try{
            const ast = babelParser.parse(code, {
                // parse in strict mode and allow module declarations
                sourceType: "module",
                plugins: [
                    // enable jsx and flow syntax
                    "flow"
                ]
            })
            const visitor = {
                VariableDeclaration({ node }) {
                    let { declarations } = node
                    for (let i = 0, len = declarations.length; i < len; i++) {
                        switch (declarations[i].id.type) {
                            // 对象解构赋值
                            case 'ObjectPattern':
                                const props = declarations[i].id.properties
                                props.forEach(({ key }) => {
                                    identifiers.push(key.name)
                                })
                                break;
                            //  数组结构赋值
                            case 'ArrayPattern':
                                const elems = declarations[i].id.elements
                                elems.forEach(({ name }) => {
                                    identifiers.push(name)
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
                    funcNum++
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
                },
                AssignmentExpression({ node }){
                    let left  = node.left
                    if(left.property)
                        left.property.name && identifiers.push(left.property.name)
                    while(left.object && left.object.type === 'MemberExpression'){
                        left.object.property && left.object.property.name && (identifiers.push(left.object.property.name))
                        left = left.object
                    }
                }
            }
            const comments = ast.comments
            babelTraverse(ast, visitor)
            res.push({
                identifiers: identifiers.map(formatIdentifier)
                    .reduce((a, b) => a.concat(b), [])
                    .join(' ')
                    .toLocaleLowerCase(),
                commentsArr: comments.map(d => d.value.toLowerCase()),
                comments:comments.map(d => d.value).join(' ').toLocaleLowerCase(),
                fileName: fpath,
                size: fInfo.size,
                funcNum
                // version: getVersion(fpath.replace(/\\/g, '\\\\'))
            })
        }
        catch(e){
            console.log(fpath)
            res.push({
                identifiers: [],
                commentsArr: [],
                comments:'',
                fileName: fpath,
                size: fInfo.size,
                funcNum
                // version: getVersion(fpath.replace(/\\/g, '\\\\')),
            })
            return
        }
    
    // console.log('identifiers:', identifiers, fpath)
   
}

function getVersion (fileName) {
    let verReg = /d3-(\d*\.\d*\.\d*)/
    if(fileName.match(verReg))
        return fileName.match(verReg)[1]
    else{
        verReg = /d3-(\d*\.\d*)/
        return fileName.match(verReg)[1]
    }
}

/*
@desc 获取该目录下所有文件的文字信息
 */
function extractText(rootPath) {
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
    res = []
    traverseDir(path.resolve(rootPath, 'src'))
    const seg = rootPath.split('/'), dirName = seg[seg.length - 1]
    write2Csv(res, dirName)
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
function write2Csv(res, fileName) {
    console.log('writing:', fileName)
    stringify(res, {
        // header: true
    }, (err, data) => {
        // fs.writeFileSync(`/Users/wendahuang/Desktop/data/${fileName}.csv`, data)
        fs.appendFileSync(`C:/Users/50809/Desktop/d3/d3-all.csv`, data);
        console.log("finish writing:", fileName)
    })
}

// extractFileInfo('../mock/commentId.js')

function main() {
    const vueSrc = 'C:/Users/50809/Desktop/d3/d3-all-versions',
        files = fs.readdirSync(vueSrc)
    let fpath = null
    for (let i = 0, len = files.length; i < len; i++) {
        fpath = path.resolve(vueSrc, files[i])
        let stat = fs.statSync(fpath)
        stat.isDirectory() && extractText(fpath)
    }
}
// console.log(path.resolve(__dirname,'../public/javascripts/draft.js'))
main()
// extractFileInfo(path.resolve(__dirname,'../public/javascripts/draft.js'))
/* traverseDir(srcDir)
write2Csv(res) */

// console.log(res)
// extractFileInfo('C:\\Users\\50809\\Desktop\\d3\\d3-all-versions\\d3-1.0.0\\src\\core\\selection.js')
