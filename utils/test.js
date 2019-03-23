var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify');

function getVersion (fileName) {
    let verReg = /vue-(\d*\.\d*\.\d*)/
    return fileName.match(verReg)[1]
}
function getRelPath (fileName) {
    let verReg = /vue-(\d*\.\d*\.\d*)(.*)/
    return fileName.match(verReg)[2]
}

function getVersions() {
    let vueDir = 'C:/Users/50809/Desktop/vue/vue-all-versions'
    const vueSrc = vueDir.replace(/\\/g, '\\\\')
    const files = fs.readdirSync(vueSrc)
    let fpath = null
    let verReg = /vue-(\d*\.\d*\.\d*)/
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
    let filepath = 'C:/Users/50809/Desktop/vue/deal-data/vue-all-versions-topic.csv'
    const fpath = filepath.replace(/\\/g, '\\\\')

    const text = fs.readFileSync(fpath, 'utf-8')
    let fileData = parse(text, {
        columns: true
    })
    fileData.forEach(doc => {
        let filename = path.join('C:/Users/50809/Desktop/vue', doc['filename'])
        doc['filename'] = filename.replace(/\\/g, '\\\\')
    })
    return fileData 
}

function getSimilarFiles(prev, curv, fileData){
    var ids = []
    var prevDocs = fileData.filter(d => getVersion(d.filename) === prev),
        curvDocs = fileData.filter(d => getVersion(d.filename) === curv)
    var editDocsObj = _.groupBy(prevDocs.concat(curvDocs), d => getRelPath(d['filename']))
    Object.keys(editDocsObj).forEach(key => {
        let preData, version
        if(editDocsObj[key].length === 2){
            for (let j = 0; j < editDocsObj[key].length; j++) {
                version = getVersion(editDocsObj[key][j].filename)
                if (version === prev) preData = editDocsObj[key][j]
            }
            ids.push(preData.id)   
        }
    })
    return ids
}

function main(){
    const fileData = getFileData()
    const versions = getVersions()
    var prev = versions[0], allIds = []
    for(let i = 1; i < versions.length; i++){
        console.log('compare ' + prev + ' ' + curv)
        var curv = versions[i]
        let ids = getSimilarFiles(prev, curv, fileData)
        allIds = allIds.concat(ids)
        prev = curv
    }
    fs.writeFile('C:/Users/50809/Desktop/vue/deal-data/editIds.csv', allIds, function (err) {
        if(err) console.error(err)
        else console.log('写入成功')
    })
}

main()
