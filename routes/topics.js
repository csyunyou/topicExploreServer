var express = require('express');
var router = express.Router();
var fs = require('fs');
var parse = require('csv-parse/lib/sync')
var path = require('path')
var hCluster = require('../utils/hCluster')
const topicData = getTopicData(), fileData = getFileData(topicData.length),
    topicCluster = getTopicCluster(topicData, fileData),
    dominantDocs = getDominantDocs()

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
 * @description 根据版本号获取主题在文件中的分布
 */
router.get('/getTopicDisByVersion', function (req, res, next) {
    const verReg = /vue-(\d*\.\d*\.\d*)/
    const version = req.query.version,
        filteredTopicData = fileData.filter(d => d.filename.match(verReg)[1] === version)

    let vueDir = path.join(__dirname, '../data/vue-all-versions', `vue-${version}`, 'src')
    let directory = vueDir.replace(/\\/g, '\\\\')
        root = {
            name: vueDir,
            type: 'dir',
            children: []
        },
        // blackList = ['.DS_Store'],
        curDoc = null
    // console.log(filteredTopicData[0])
    readDirSync(directory, root)    
    console.log(root)
    res.send(root)

    function convertSlash(path){
        let slashReg=/\\/g
        return path.replace(slashReg,'\\\\')
    }

    function readDirSync(rootPath, root) {
        var pa = fs.readdirSync(rootPath);
        pa.forEach(function (ele, index) {
            // console.log(ele)
            // if (blackList.indexOf(ele) !== -1) return
            var curPath = path.resolve(rootPath, ele),
                info = fs.statSync(curPath)
            if (info.isDirectory()) {
                // console.log("dir: "+ele)
                let tmpdir = { name: curPath, children: [], type: 'dir' }
                root.children.push(tmpdir)
                readDirSync(curPath, tmpdir);
            } else {
                let convertPath=convertSlash(curPath)
                curDoc = filteredTopicData.find(d => d.filename === convertPath)
                if(curDoc===undefined){
                    // console.log(curPath)
                    return
                }
                root.children.push({
                    name: curPath,
                    type: 'file',
                    topic: curDoc['Dominant_Topic'],
                    id: curDoc['id']
                })
                // console.log("file: "+ele)
            }
        })
    }
})

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
module.exports = router;