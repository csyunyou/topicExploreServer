var express = require('express');
var router = express.Router();
var readline = require('readline');
var fs = require('fs');
var parse = require('csv-parse/lib/sync');
var path = require('path');
var hCluster = require('../utils/hCluster');
var _ = require('lodash');

const topicData = getTopicData(), fileData = getFileData(topicData.length),
    topicCluster = getTopicCluster(topicData, fileData),
    dominantDocs = getDominantDocs(), normData = getNormOfDiffVecs(topicData, fileData)

/* GET home page. */
router.get('/getAllDocs', function (req, res, next) {
    res.send({
        files: fileData,
        versions: getVersions()
    })
});

/**
 * @description 获取主题的关键词
 */
router.get('/getTopicData', function (req, res, next) {
    res.send(topicData)
})

router.get('/getTopicCluster', function (req, res, next) {
    res.send(topicCluster)
})

router.get('/getDominantDocsByTopic', function (req, res, next) {
    const topicNum = parseInt(req.query.topicNum),
        filteredDocs = dominantDocs.filter(d => parseInt(d['Dominant_Topic']) === topicNum)
    res.send(filteredDocs)
})

/**
 * @description 获取源代码
 */
router.get('/getCode', function (req, res, next) {
    var text = fs.readFileSync(req.query.filepath, 'utf-8')
    res.send(text)
    // var fRead = fs.createReadStream(req.query.filepath)
    // var objReadline = readline.createInterface({
    //     input: fRead
    // })
    // var arr = []
    // objReadline.on('line', (line) => {
    //     arr.push(line)
    // })
    // objReadline.on('close', () => {
    //     callback(arr)
    //     console.log('read close...')
    // })
    // function callback(data){
    //     res.send(data)
    // }
})

/**
 * @description 获取前后版本向量差的模
 */
router.get('/getNormOfDiffVecs', function(req, res, next){
    res.send(normData)
})

router.get('/getDiffDocs', function(req,res,next){
    let prev = req.query.prev,
        curv = req.query.curv
    const diffDocs = getDiffDocs(prev, curv, fileData)
    res.send(diffDocs)
})

/**
 * @description 根据版本号获取主题在文件中的分布
 */
router.get('/getTopicDisByVersion', function (req, res, next) {
    const verReg = /vue-(\d*\.\d*\.\d*)/
    const curv = req.query.curv,
        curvFilteredTopicData = fileData.filter(d => d.filename.match(verReg)[1] === curv)
    let vueDir = path.join(__dirname, '../data/vue-all-versions', `vue-${curv}`, 'src')
    let directory = vueDir.replace(/\\/g, '\\\\'),
        root = {
            name: vueDir,
            type: 'dir',
            children: []
        }
    readDirSync(directory, root, curvFilteredTopicData, 'curv') 
    
    // 增加上一版本的文件
    const prev = req.query.prev
    if(prev){
        prevFilteredTopicData = fileData.filter(d => d.filename.match(verReg)[1] === prev)
        let prevDir = path.join(__dirname, '../data/vue-all-versions', `vue-${prev}`, 'src')
        addPrevFile(convertSlash(prevDir), root, prevFilteredTopicData)

        var diffDocs = getDiffDocs(prev, curv, fileData)
        diffDocs.forEach(doc =>{
            let vec = doc.vec
            vec = vec.map(d => d*d)
            let norm = Math.sqrt(vec.reduce(getSum))
            doc['norm'] = norm
        })
        res.send({root: root, diffDocs: diffDocs})
    }
    else
        res.send(root) 
})

function convertSlash(path){
    let slashReg=/\\/g
    return path.replace(slashReg,'\\\\')
}

// 读取文件夹下的子文件
function readDirSync(rootPath, root, topicData, strv) {
    var pa = fs.readdirSync(rootPath);
    pa.forEach(function (ele, index) {
        // console.log(ele)
        // if (blackList.indexOf(ele) !== -1) return
        var curPath = path.resolve(rootPath, ele),
            info = fs.statSync(curPath)
        if (info.isDirectory()) {
            // console.log("dir: "+ele)
            let tmpdir = { name: curPath, children: [], type: 'dir', version: strv }
            root.children.push(tmpdir)
            readDirSync(curPath, tmpdir, topicData, strv);
        } else {
            let convertPath=convertSlash(curPath)
            let curDoc = topicData.find(d => d.filename === convertPath)
            if(curDoc===undefined){
                // console.log(curPath)
                return
            }
            root.children.push({
                name: curPath,
                type: 'file',
                topic: curDoc['Dominant_Topic'],
                id: curDoc['id'],
                version: strv 
            })
            // console.log("file: "+ele)
        }
    })
}

function addPrevFile(rootPath, root, topicData){
    let pa = fs.readdirSync(rootPath)
    pa.forEach(function(ele, index) {
        let curPath = path.resolve(rootPath, ele),
            info = fs.statSync(curPath)
        let i=0
        for(; i<root.children.length; i++) {
            let dirName = root.children[i].name
            dirName = dirName.substr(dirName.lastIndexOf('\\')+1)
            if(ele === dirName){
                if(info.isDirectory())
                    addPrevFile(curPath, root.children[i], topicData)
                else{
                    let convertPath=convertSlash(curPath)
                    curDoc = topicData.find(d => d.filename === convertPath)
                    root.children[i]['preId'] = curDoc['id']
                }
                break
            }     
        }
        if(i === root.children.length){
            if(info.isDirectory()) {
                root.children.push({
                    name: curPath, 
                    children: [], 
                    type: 'dir', 
                    version: 'prev'
                })
                readDirSync(curPath, root.children[i], topicData, 'prev')
            }
            else {
                let convertPath=convertSlash(curPath)
                curDoc = topicData.find(d => d.filename === convertPath)
                root.children.push({
                    name: curPath,
                    type: 'file',
                    topic: curDoc['Dominant_Topic'],
                    id: curDoc['id'],
                    version: 'prev' 
                })
            }
        }     
    })
}

function getVersions() {
    let vueDir = path.join(__dirname, '../data/vue-all-versions')
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

function getFileData(topicNum) {
    let filepath = path.join(__dirname, '../data/deal-data/vue-all-versions-topic.csv')
    const fpath = filepath.replace(/\\/g, '\\\\')

    const text = fs.readFileSync(fpath, 'utf-8')
    let tmpTopicCon = [], tmpTopicConItem
    let fileData = parse(text, {
        columns: true
    })
    // 用0来补充缺失值
    fileData.forEach(doc => {
        let filename = path.join(__dirname, '../data', doc['filename'])
        doc['filename'] = filename.replace(/\\/g, '\\\\')
        tmpTopicContribution = []
        doc['Topic_Contribution'] = JSON.parse(doc['Topic_Contribution'])
        for (let num = 0; num < topicNum; num++) {
            tmpTopicConItem = doc['Topic_Contribution'].find(d => d[0] === num)
            if (!tmpTopicConItem) tmpTopicContribution.push({ topicId: num, percent: 0 })
            else tmpTopicContribution.push({ topicId: num, percent: tmpTopicConItem[1] })
        }
        doc['Topic_Contribution'] = tmpTopicContribution
        doc['size'] = parseInt(doc['size'])
        doc['func_Num'] = parseInt(doc['func_Num'])
        doc['Perc_Contribution'] = Number(doc['Perc_Contribution'])
        doc['commentArr'] = JSON.parse(doc['commentArr'])
    })
    return fileData
}

/**
 * @description 格式化topic数据
 */
function getTopicData() {
    let filepath = path.join(__dirname, '../data/deal-data/vue-topic.csv')
    const fpath = filepath.replace(/\\/g, '\\\\')

    const text = fs.readFileSync(fpath, 'utf-8')
    let topicData = parse(text, {
        columns: true
    }), res = [], seg, weight, keyword, topic
    topicData.forEach(({ index, topic: val }) => {
        topic = {
            index: parseInt(index),
            keywords: []
        }
        index = parseInt(index)
        seg = val.split('+')
        seg.forEach(d => {
            [weight, keyword] = (d.split('*'))
            weight = +weight.trim()
            keyword = keyword.match(/\"(.*)\"/)[1]
            topic.keywords.push({
                weight,
                keyword
            })
        })
        res.push(topic)
    })
    return res
}

/**
 * @description 返回树状结构组织的聚类结果
 * @param {Array} topicData 
 * @param {Array} fileData 
 */
function getTopicCluster(topicData, fileData) {
    const root = hCluster(topicData)
    function dfs(root) {
        if (!root.children) {
            root.size = fileData.filter(d => parseInt(d['Dominant_Topic']) === root.index[0]).length
            return
        }
        root.children.forEach(child => {
            dfs(child)
        })
    }
    dfs(root)
    return root
}

/**
 * @description 获得每个主题的代表文件
 */
function getDominantDocs() {
    let filepath = path.join(__dirname, '../data/deal-data/dominant-documents-per-topic.csv')
    const fpath = filepath.replace(/\\/g, '\\\\')

    const text = fs.readFileSync(fpath, 'utf-8')
    return parse(text, {
        columns: true
    })
}

/**
 * @description 计算前后版本的主题向量差之模
 */
function getNormOfDiffVecs(topicData, fileData) {
    var versions = getVersions()
    var diffVecs = []

    var prev = versions[0], 
        curv,
        prevDocs = fileData.filter(d => getVersion(d.filename) === prev),
        curvDocs
    
    // // 第一个版本的主题向量差为当前所有文件的主题向量和
    // prevDocs.forEach(doc => {
    //     let curvVec = doc['Topic_Contribution'].map(topic => topic['percent'])
    //     diffVecs[0] = diffVecs[0].map((d, i) => d+curvVec[i])
    // })

    for(let i=1; i<versions.length; i++) {
        curv = versions[i]
        curvDocs = fileData.filter(d => getVersion(d.filename) === curv)
        let addDocs = _.differenceBy(curvDocs, prevDocs, d => getRelPath(d['filename'])),
            delDocs = _.differenceBy(prevDocs, curvDocs, d => getRelPath(d['filename'])),
            editDocsObj = _.groupBy(prevDocs.concat(curvDocs), d => getRelPath(d['filename']))
        
        let diffVec = Array(topicData.length).fill(0)
        // 增加文件的diffvec = curdocvec
        addDocs.forEach(doc => {
            let curvVec = doc['Topic_Contribution'].map(topic => topic['percent'])
            diffVec = diffVec.map((d, i) => d+curvVec[i])
        })
        // 删除文件的diffvec = -predocvec
        delDocs.forEach(doc => {
            let prevVec = doc['Topic_Contribution'].map(topic => topic['percent'])
            diffVec = diffVec.map((d, i) => d-prevVec[i])
        })
        // 修改文件的diffvec = curdocvec-predocvec
        Object.keys(editDocsObj).forEach(key => {
            let preData, nextData, version
            if(editDocsObj[key].length === 2){
                for (let j = 0; j < editDocsObj[key].length; j++) {
                    version = getVersion(editDocsObj[key][j].filename)
                    if (version === prev) preData = editDocsObj[key][j]
                    else nextData = editDocsObj[key][j]
                }
                let prevVec = preData['Topic_Contribution'].map(topic => topic['percent']),
                    curvVec = nextData['Topic_Contribution'].map(topic => topic['percent'])
                diffVec = diffVec.map((d,i) => d+(curvVec[i]-prevVec[i]))
            }
        })
        diffVecs.push(diffVec)
        prev = curv
        prevDocs = curvDocs 
    }
    // 计算各个diffvec的模
    var norm = [{ver: versions[0], val: 0}]
    diffVecs.forEach((vec, i) => {
        vec = vec.map(d => d*d)
        norm.push({
            ver: versions[i+1],
            val: Math.sqrt(vec.reduce(getSum))
        })
    })
    return norm
}

function getSum(total, num){
    return total+num
}
function getVersion (fileName) {
    let verReg = /vue-(\d*\.\d*\.\d*)/
    return fileName.match(verReg)[1]
}
function getRelPath (fileName) {
    let verReg = /vue-(\d*\.\d*\.\d*)(.*)/
    return fileName.match(verReg)[2]
}
function getFileName(filename){
    let index = filename.lastIndexOf('\\')
    return filename.substr(index+1)
}

// 获取指定版本范围后, 前后版本间的文件
function getDiffDocs(prev, curv, fileData){
    var prevDocs = fileData.filter(d => getVersion(d.filename) === prev),
        curvDocs = fileData.filter(d => getVersion(d.filename) === curv)
    let addDocs = _.differenceBy(curvDocs, prevDocs, d => getRelPath(d['filename'])),
        delDocs = _.differenceBy(prevDocs, curvDocs, d => getRelPath(d['filename'])),
        editDocsObj = _.groupBy(prevDocs.concat(curvDocs), d => getRelPath(d['filename']))
    
    var diffDocs = []
    addDocs.forEach(doc => {
        let curvVec = doc['Topic_Contribution'].map(topic => topic['percent'])
        diffDocs.push({
            fileName: [doc.filename],
            vec: curvVec,
            type: 'add',
            fileIds: [doc.id],
        })
    })
    delDocs.forEach(doc => {
        let prevVec = doc['Topic_Contribution'].map(topic => -topic['percent'])
        diffDocs.push({
            fileName: [doc.filename],
            vec: prevVec,
            type: 'del',
            fileIds: [doc.id]
        })
    })
    Object.keys(editDocsObj).forEach(key => {
        let preData, nextData, version
        if(editDocsObj[key].length === 2){
            for (let j = 0; j < editDocsObj[key].length; j++) {
                version = getVersion(editDocsObj[key][j].filename)
                if (version === prev) preData = editDocsObj[key][j]
                else nextData = editDocsObj[key][j]
            }
            let prevVec = preData['Topic_Contribution'].map(topic => topic['percent']),
                curvVec = nextData['Topic_Contribution'].map(topic => topic['percent'])
            diffDocs.push({
                fileName: [preData.filename, nextData.filename],
                vec: curvVec.map((d,i) => d - prevVec[i]),
                type: 'edit',
                fileIds: [preData.id, nextData.id]
            })
        }
    })
    return diffDocs
}

module.exports = router;