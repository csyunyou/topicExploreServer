var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify');

function getVersion (filename, lib) {
    let verReg = new RegExp(lib+"-(\\d*\\.\\d*\\.\\d*)")
    return filename.match(verReg)[1]
}
function getRelPath (filename, lib) {
    let verReg = new RegExp(lib+"-(\\d*\\.\\d*\\.\\d*)(.*)")
    return filename.match(verReg)[2]
}

function getVersions(src, lib) {
    const libSrc = src.replace(/\\/g, '\\\\')
    const files = fs.readdirSync(libSrc)
    let fpath = null
    let verReg = new RegExp(lib+"-(\\d*\\.\\d*\\.\\d*)")
    let versions = []
    for (let i = 0, len = files.length; i < len; i++) {
        fpath = path.resolve(libSrc, files[i])
        let stat = fs.statSync(fpath)
        stat.isDirectory() && (versions.push(fpath.match(verReg)[1]))
    }
    versions.sort((a, b) => {
        let arr = a.split('.').map(d => parseInt(d)), brr = b.split('.').map(d => parseInt(d))
        for (let i = 0, len = arr.length; i < len; i++) {
            if (arr[i] < brr[i])
                return -1
            else if (arr[i] > brr[i])
                return 1
        }
    })
    return versions
}

function getFileData(filepath) {
    const fpath = filepath.replace(/\\/g, '\\\\')
    // 添加csv文件头
    let header = ['id', 'identifiers','commentsArr','comments','filename', 'size', 'fun_num', 'version']
    const text = fs.readFileSync(fpath, 'utf-8')
    let fileData = parse(text, {
        columns: header
    })
    let dirpath = filepath.substr(0, filepath.lastIndexOf('\\'))
    fileData.forEach(doc => {
        let filename = path.join(dirpath, doc['filename'])
        doc['filename'] = filename.replace(/\\/g, '\\\\')
    })
    return fileData 
}

function classifyFiles(prev, curv, fileData, lib){
    var similarIds = [], diffIds = []
    var prevDocs = fileData.filter(d => getVersion(d.filename, lib) === prev),
        curvDocs = fileData.filter(d => getVersion(d.filename, lib) === curv)
    
    // 找相似文件
    var editDocsObj = _.groupBy(prevDocs.concat(curvDocs), d => getRelPath(d['filename'], lib))
    Object.keys(editDocsObj).forEach(key => {
        let preData, curData, version
        if(editDocsObj[key].length === 2){
            for (let j = 0; j < editDocsObj[key].length; j++) {
                version = getVersion(editDocsObj[key][j].filename, lib)
                if (version === prev) preData = editDocsObj[key][j]
                else curData = editDocsObj[key][j]
            }
            similarIds.push({
                previd: preData.id,
                curvid: curData.id
            })   
        }
    })

    // 找差异文件
    let addDocs = _.differenceBy(curvDocs, prevDocs, d => getRelPath(d['filename'], lib)),
        delDocs = _.differenceBy(prevDocs, curvDocs, d => getRelPath(d['filename'], lib))
    if(addDocs.length === 0 && delDocs.length === 0){
        console.log(prev, curv, 'no difference!')
    }
    else{
        addDocs.forEach(doc => {
            diffIds.push({
                fileIds: doc.id,
                type: 'add'
            })
        })
        delDocs.forEach(doc => {
            diffIds.push({
                fileIds: doc.id,
                type: 'del'
            })
        })
    }  

    return {similar: similarIds, diff: diffIds}
}

function main(src, file, lib){
    const fileData = getFileData(file)
    const versions = getVersions(src, lib)

    var prev = versions[0], similarIds = [], diffIds = []
    for(let i = 1; i < versions.length; i++){
        var curv = versions[i]
        console.log('compare ' + prev + ' ' + curv)
        let ids = classifyFiles(prev, curv, fileData, lib)
        similarIds = similarIds.concat(ids.similar)
        diffIds = diffIds.concat(ids.diff)
        prev = curv
    }

    let dirpath = src.substr(0, src.lastIndexOf('/'))
    stringify(similarIds, {
        // header: true
    }, (err, data) => {
        if(err) throw err
        fs.writeFile(dirpath+'/similarIds1.csv', data, err => {
            if(err) console.error(err)
            else console.log('finish writing similarIds')
        });
    })

    stringify(diffIds, {
        // header: true
    }, (err, data) => {
        if(err) throw err
        fs.writeFile(dirpath+'/diffIds1.csv', data, err => {
            if(err) console.error(err)
            else console.log('finish writing diffIds')
        });
    })
}

// 第一个参数是类库所在的文件夹，第二个参数是提取的文本文件，第三个是类库名
main('C:/Users/50809/Desktop/vue/vue-all-versions', 'C:/Users/50809/Desktop/vue/vue-all-original-text.csv', 'vue')