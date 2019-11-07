var express = require('express');
var router = express.Router();
var fs = require('fs');
var parse = require('csv-parse/lib/sync');
var path = require('path');
var _ = require('lodash');
const blackList = ['.DS_Store','.html', '.map']

const topicData = getTopicData(), fileData = getFileData(topicData.length),
    editFileIds = getEditFileIds(fileData),
    normData = getNormOfDiffVecs(fileData, editFileIds)

/* GET home page. */
router.get('/getAllDocs', function (req, res, next) {
    res.send({
        files: fileData,
        versions: getVersions()
    })
});

router.get('/getEditFileIds', function(req, res, next){
    res.send(editFileIds)
})

/**
 * @description 获取主题的关键词
 */
router.get('/getTopicData', function (req, res, next) {
    res.send(topicData) 
})

/**
 * @description 获取源代码
 */
router.get('/getCode', function (req, res, next) {
    var text = fs.readFileSync(req.query.filepath, 'utf-8')
    res.send(text)
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
    const diffDocs = getDiffDocs(prev, curv, fileData, editFileIds)
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

        var diffDocs = getDiffDocs(prev, curv, fileData, editFileIds)
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
        let suffix = ele.substr(ele.lastIndexOf('.'))
        if (blackList.indexOf(suffix) !== -1) return
        var curPath = path.resolve(rootPath, ele),
            info = fs.statSync(curPath)
        if (info.isDirectory()) {
            let tmpdir = { name: curPath, children: [], type: 'dir', version: strv }
            root.children.push(tmpdir)
            readDirSync(curPath, tmpdir, topicData, strv);
        } else {
            let convertPath=convertSlash(curPath)
            let curDoc = topicData.find(d => d.filename === convertPath)
            if(curDoc===undefined){
                return
            }
            root.children.push({
                name: curPath,
                type: 'file',
                topic: curDoc['Dominant_Topic'],
                id: curDoc['id'],
                version: strv 
            })
        }
    })
}

function addPrevFile(rootPath, root, topicData){
    let pa = fs.readdirSync(rootPath)
    pa.forEach(function(ele, index) {
        let suffix = ele.substr(ele.lastIndexOf('.'))
        if (blackList.indexOf(suffix) !== -1) return
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
    let tmpTopicConItem
    let fileData = parse(text, {
        columns: true
    })
    // 用0来补充缺失的topic percent
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
 * @description 格式化topic数据
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

    // td-idf 词云关键字重新赋权重
    let wordDict = new Array();
    res.forEach(topic => {
        topic.keywords.forEach(d => {
            if(!wordDict.hasOwnProperty(d.keyword))
                wordDict[d.keyword] = 1
            else
                wordDict[d.keyword] += 1
        })
    })
    let num = res.length
    res.forEach(topic =>{
        topic.keywords.forEach(d => {
            //weight作为tf, 在主题中出现的次数计算idf
            d.weight = d.weight * Math.log(num/wordDict[d.keyword])
        })
    })
    return res
}

/**
 * @description 计算前后版本的主题向量差之模
 */
function getNormOfDiffVecs(fileData, editFileIds) {
    var versions = getVersions()
    var prev = versions[0]
    var norm = []

    versions.forEach(d => {
        norm.push({ver: d, val: 0})
    })
    
    for(let i=1; i<versions.length; i++) {
        let curv = versions[i]
        let diffDocs = getDiffDocs(prev, curv, fileData, editFileIds)
        diffDocs.forEach(doc=>{
            let vec = doc.vec.map(d => d*d)
            norm[i].val = norm[i].val+Math.sqrt(vec.reduce(getSum))
        })
        prev = curv
    }
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

// 获取指定版本范围后, 前后版本间的文件
function getDiffDocs(prev, curv, fileData, editFileIds){
    var prevDocs = fileData.filter(d => getVersion(d.filename) === prev),
        curvDocs = fileData.filter(d => getVersion(d.filename) === curv)
    let addDocs = _.differenceBy(curvDocs, prevDocs, d => getRelPath(d['filename'])),
        delDocs = _.differenceBy(prevDocs, curvDocs, d => getRelPath(d['filename'])),
        editDocsObj = _.groupBy(prevDocs.concat(curvDocs), d => getRelPath(d['filename']))
    
    var diffDocs = [], delIds = []
    addDocs.forEach(doc => {
        let editIds = editFileIds.filter(ids => ids.curid.indexOf(parseInt(doc.id)) != -1)
        if(editIds.length > 0){
            let prevDoc = delDocs.filter(deldoc => editIds[0].preid.indexOf(parseInt(deldoc.id)) != -1)
            if(prevDoc.length > 0){
                let prevVec = prevDoc[0]['Topic_Contribution'].map(topic => topic['percent']),
                    curvVec = doc['Topic_Contribution'].map(topic => topic['percent'])
                diffDocs.push({
                    fileName: [prevDoc.filename, doc.filename],
                    vec: curvVec.map((d,i) => d - prevVec[i]),
                    type: 'edit',
                    fileIds: [prevDoc[0].id, doc.id]
                })
                delIds.push(prevDoc[0].id)
            }
        }
        else {
            let curvVec = doc['Topic_Contribution'].map(topic => topic['percent'])
            diffDocs.push({
                fileName: [doc.filename],
                vec: curvVec,
                type: 'add',
                fileIds: [doc.id],
            })
        }
    })

    delDocs.filter(doc => delIds.indexOf(doc.id) === -1)
        .forEach(doc => {
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

function getEditFileIds(fileData){
    let filepath = path.join(__dirname, '../data/deal-data/edit-fileids.csv')
    const fpath = filepath.replace(/\\/g, '\\\\')

    const text = fs.readFileSync(fpath, 'utf-8')
    var fileIds = parse(text, {
        columns: true
    })
    fileIds.forEach(d => {
        let preDoc = fileData[parseInt(d.preid)], curDoc = fileData[parseInt(d.curid)]
        let preIds = [parseInt(d.preid)], curIds = [parseInt(d.curid)]
        for(let i=0; i<parseInt(d.preid); i++){
            if(getRelPath(fileData[i].filename)===getRelPath(preDoc.filename))
                preIds.push(i)
        }
        for(let i=parseInt(d.curid)+1; i<fileData.length; i++){
            if(getRelPath(fileData[i].filename)===getRelPath(curDoc.filename))
                curIds.push(i)
        }
        d.preid = preIds
        d.curid = curIds
    })
    return fileIds
}

module.exports = router;