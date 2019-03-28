var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify');

function getVersions() {
    let vueDir = path.join(__dirname, '../data/d3-all-versions')
    const vueSrc = vueDir.replace(/\\/g, '\\\\')
    const files = fs.readdirSync(vueSrc)
    let fpath = null
    let verReg = /d3-(\d*\.\d*\.\d*)/
    let versions = []
    for (let i = 0, len = files.length; i < len; i++) {
        fpath = path.resolve(vueSrc, files[i])
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

function getFileData() {
    let filepath = path.join(__dirname, '../data/deal-data/d3-all-versions-topic.csv')
    const fpath = filepath.replace(/\\/g, '\\\\')

    const text = fs.readFileSync(fpath, 'utf-8')
    let fileData = parse(text, {
        columns: true
    })
    fileData.forEach(doc => {
        let filename = path.join(__dirname, '../data', doc['filename'])
        doc['filename'] = filename.replace(/\\/g, '\\\\')
    })
    return fileData
}

function getVersion (fileName) {
    let verReg = /d3-(\d*\.\d*\.\d*)/
    return fileName.match(verReg)[1]
}
function getRelPath (fileName) {
    let verReg = /d3-(\d*\.\d*\.\d*)(.*)/
    return fileName.match(verReg)[2]
}

function getDiffDocs(prev, curv, fileData){
    var prevDocs = fileData.filter(d => getVersion(d.filename) === prev),
        curvDocs = fileData.filter(d => getVersion(d.filename) === curv)
    let addDocs = _.differenceBy(curvDocs, prevDocs, d => getRelPath(d['filename'])),
        delDocs = _.differenceBy(prevDocs, curvDocs, d => getRelPath(d['filename']))
    
    if(addDocs.length === 0 || delDocs.length === 0){
        console.log(prev, curv)
        return []
    }
    
    var diffDocs = []
    addDocs.forEach(doc => {
        diffDocs.push({
            ver: curv,
            fileName: doc.filename,
            identifiers: doc.identifiers,
            comments: doc.comments,
            type: 'add',
            fileIds: doc.id,
        })
    })
    delDocs.forEach(doc => {
        diffDocs.push({
            ver: curv,
            fileName: doc.filename,
            identifiers: doc.identifiers, 
            comments: doc.comments,
            type: 'del',
            fileIds: doc.id
        })
    })
    return diffDocs
}

function write2Csv(res, fileName) {
    console.log('writing:', fileName)
    stringify(res, {
    }, (err, data) => {
        fs.appendFileSync(`C:/Users/50809/Desktop/d3/deal-data/d3-all-diffDocs.csv`, data);
        console.log("finish writing:", fileName)
    })
}

function main(){
    var versions = getVersions()
    var fileData = getFileData()
    var prev=versions[0], curv
    for(let i=1; i<versions.length; i++) {
        curv = versions[i]
        let diffDocs = getDiffDocs(prev, curv, fileData)
        if(diffDocs.length != 0)
            write2Csv(diffDocs, curv)
        prev = curv
    }
}

main()