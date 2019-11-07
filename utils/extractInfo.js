var path = require('path');
var fs = require('fs');
// const extract = require('babel-extract-comments');
const babelParser = require('babylon');
const babelTraverse = require('@babel/traverse').default
const stringify = require('csv-stringify')
const blackList = ['.DS_Store','.html', '.map']
let res = [], id = 0

/*
description: 提取文件中的注释和标识符
 */
function extractFileInfo(fpath, lib) {
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
                            // 对象结构赋值
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
                id: id,
                identifiers: identifiers.map(formatIdentifier)
                    .reduce((a, b) => a.concat(b), [])
                    .join(' ')
                    .toLocaleLowerCase(),
                commentsArr: comments.map(d => d.value.toLowerCase()),
                comments:comments.map(d => d.value).join(' ').toLocaleLowerCase(),
                filename: fpath,
                size: fInfo.size,
                func: funcNum,
                version: getVersion(fpath.replace(/\\/g, '\\\\'), lib)
            })
            id++
        }
        catch(e){
            console.log(fpath)
            res.push({
                id: id,
                identifiers: [],
                commentsArr: [],
                comments:'',
                filename: fpath,
                size: fInfo.size,
                func: funcNum,
                version: getVersion(fpath.replace(/\\/g, '\\\\'), lib),
            })
            id++
            return
        }
}

function getVersion (filename, lib) {
    let verReg = new RegExp(lib+"-(\\d*\\.\\d*\\.\\d*)")
    return filename.match(verReg)[1]
}

/*
@desc 获取该目录下所有文件的文字信息
 */
function extractText(rootPath, lib) {
    function traverseDir(dir) {
        const files = fs.readdirSync(dir)
        files.forEach(function (file, index) {
            let suffix = file.substr(file.lastIndexOf('.'))
            if (blackList.indexOf(suffix) !== -1) return
            var curPath = path.resolve(dir, file),
                info = fs.statSync(curPath)
            if (info.isDirectory()) {
                traverseDir(curPath);
            } else {
                extractFileInfo(curPath, lib)
            }
        })
    }
    res = []
    traverseDir(path.resolve(rootPath, 'src'))
    write2Csv(res, rootPath, lib)
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
function write2Csv(res, filename, lib) {
    console.log('writing:', filename)
    //构造路径
    let fpath = filename.substr(0, filename.lastIndexOf('\\'))
    fpath = fpath.substr(0, fpath.lastIndexOf('\\'))
    fpath.replace(/\\/g, '/')

    stringify(res, {
        // header: true
    }, (err, data) => {
        fs.appendFileSync(fpath+"/"+lib+"-all-original-text.csv", data);
        console.log("finish writing:", filename)
    })
}

function main(src, lib) {
    const files = fs.readdirSync(src)

    //先排序版本
    files.sort(function(a, b){
        let arrA = getVersion(a, lib).split('.'),
            arrB = getVersion(b, lib).split('.')
        for(let i=0; i<arrA.length; i++){
            if(parseInt(arrA[i]) > parseInt(arrB[i])) return 1
            if(parseInt(arrA[i]) < parseInt(arrB[i])) return -1
        }
    })

    let fpath = null
    for (let i = 0, len = files.length; i < len; i++) {
        fpath = path.resolve(src, files[i])
        let stat = fs.statSync(fpath)
        stat.isDirectory() && extractText(fpath, lib)
    }
}

// 第一个参数是类库所在的文件夹，第二个参数是类库名
main('C:/Users/50809/Desktop/vue/vue-all-versions', 'vue')