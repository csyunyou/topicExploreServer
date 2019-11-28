var express = require('express');
var axios = require('axios')
var router = express.Router();
var fs = require('fs');
var parse = require('csv-parse/lib/sync');
var path = require('path');
var _ = require('lodash');
const blackList = ['.DS_Store','.html', '.map']

// 提取文件信息
var libData= {
    vue: {
        name: 'vue',
        dirpath: 'C:/Users/50809/Desktop/vue',
        srcPath: 'C:/Users/50809/Desktop/vue/vue-all-versions',
        infoPath: 'C:/Users/50809/Desktop/vue/all-original-text.csv',
        diffPath: 'C:/Users/50809/Desktop/vue/diffIds.csv',
        editPath: 'C:/Users/50809/Desktop/vue/editIds.csv',
        topicWordsPath: 'C:/Users/50809/Desktop/vue/topic_words.csv',
        docTopicsPath: 'C:/Users/50809/Desktop/vue/doc_topics.csv',
        topicWords: null,
        docTopics: null,
        topicData: null,
        fileData: null,
        versions: null,
        editIds: null,
        diffIds: null,
        normData: null
    },
    d3: {
        name: 'd3',
        dirpath: 'C:/Users/50809/Desktop/d3',
        srcPath: 'C:/Users/50809/Desktop/d3/d3-all-versions',
        infoPath: 'C:/Users/50809/Desktop/d3/all-original-text.csv',
        diffPath: 'C:/Users/50809/Desktop/d3/diffIds.csv',
        editPath: 'C:/Users/50809/Desktop/d3/editIds.csv',
        topicWordsPath: 'C:/Users/50809/Desktop/d3/topic_words.csv',
        docTopicsPath: 'C:/Users/50809/Desktop/d3/doc_topics.csv',
        topicWords: null,
        docTopics: null,
        topicData: null,
        fileData: null,
        versions: null,
        editIds: null,
        diffIds: null,
        normData: null
    }
}

var topicData, fileData, versions, normData
preprocess('vue')

/* GET home page. */
router.get('/getLibName', function (req, res, next) {
    lib = req.query.libName
    topicData = libData[lib].topicData
    fileData = libData[lib].fileData
    versions = libData[lib].versions
    normData = libData[lib].normData
    res.send({'flag': true})
})

// 获取所有文件数据
router.get('/getAllDocs', function (req, res, next) {
    res.send({
        files: fileData,
        versions: versions
    })
});

// 获取主题关键词
router.get('/getTopicData', function (req, res, next) {
    res.send(topicData) 
})

// 获取前后版本向量差的模
router.get('/getNormOfDiffVecs', function(req, res, next){
    res.send(normData)
})

/**
 * @description 后台预处理数据
 */
function preprocess(lib){
    // topic-word数据
    libData[lib].topicWords = readTopicWords(libData[lib].topicWordsPath)
    // doc-topic数据
    libData[lib].docTopics = readDocTopics(libData[lib].docTopicsPath)
    // 单词重新赋权重
    libData[lib].topicData = getTopicData(libData[lib].topicWords)
    // 文件数据
    libData[lib].fileData = getFileData(libData[lib].infoPath, libData[lib].docTopics)
    // 版本号
    libData[lib].versions = getVersions(lib, libData[lib].srcPath) 
    // 编辑文件
    libData[lib].editIds = readEditIds(libData[lib].editPath)
    // 差异文件
    libData[lib].diffIds = readDiffIds(libData[lib].diffPath) 
    // 版本向量差模
    libData[lib].normData = getNormOfDiffVecs(libData[lib].versions, libData[lib].diffIds, libData[lib].editIds, libData[lib].docTopics)
    console.log(lib+' data preprocess finish')
}

/**
 * @description 读取topic数据
 */
function readTopicWords(fpath){
    var topics = fs.readFileSync(fpath, 'utf-8')
    topics = topics.split('\r\n')
    // 删除最后一个元素(空字符串)
    topics.pop()
    let new_topics = []
    for(let i=0; i<topics.length; i+=2){
        let words = topics[i].split(','),
            weights = topics[i+1].split(',')
        let new_words = []
        for (let j=0; j<words.length; j++){
            new_words.push({'keyword': words[j], 'weight': parseFloat(weights[j])})
        }
        new_topics.push({'topic_id':i/2, 'words': new_words})
    }
    return new_topics
}

/**
 * @description 读取doctopics数据
 */
function readDocTopics(fpath){
    var docTopics = fs.readFileSync(fpath, 'utf-8')
    docTopics = docTopics.split('\r\n')
    // 删除最后一个元素(空字符串)
    docTopics.pop()
    let new_docTopics = []
    for(let i=0; i<docTopics.length; i++){
        let weights = docTopics[i].split(',')
        for(let j=0; j<weights.length; j++){
            weights[j] = parseFloat(weights[j])
        }
        new_docTopics.push(weights)
    }
    return new_docTopics
}

/**
 * @description 格式化topic数据
 */
function getTopicData(topics) {
    // td-idf 词云关键字重新赋权重
    let wordDict = new Array();
    topics.forEach(topic => {
        topic.words.forEach(d => {
            if(!wordDict.hasOwnProperty(d.keyword))
                wordDict[d.keyword] = 1
            else
                wordDict[d.keyword] += 1
        })
    })
    let num = topics.length
    topics.forEach(topic =>{
        topic.words.forEach(d => {
            //weight作为tf, 在主题中出现的次数计算idf
            d.weight = d.weight * Math.log(num/wordDict[d.keyword])
        })
    })
    return topics
}

/**
 * @description 构造每个文件的数据
 */
function getFileData(fpath, docTopics) {
    const text = fs.readFileSync(fpath, 'utf-8')
    let header = ['id', 'identifiers','commentsArr','comments','filename', 'size', 'fun_num', 'version']
    let fileData = parse(text, {
        columns: header
    })
    // 用0来补充缺失的topic percent
    fileData.forEach(doc => {
        doc['id'] = parseInt(doc['id'])
        doc['filename'] = doc['filename'].replace(/\\/g, '\\\\')
        // 重新构造doc-topic矩阵
        topicWeights = docTopics[doc['id']]
        let id = 0, newTopicWeights = []
        topicWeights.forEach(d =>{
            newTopicWeights.push({'topic_id': id, 'weight': d})
            id++
        })
        // 对权重排序
        newTopicWeights.sort(function(a, b){
            return b.weight - a.weight
        })
        doc['main_topic'] = newTopicWeights[0]['topic_id']
        doc['main_weight'] = newTopicWeights[0]['weight']
        doc['topicDistribution'] = newTopicWeights 
    })
    return fileData 
}

/**
 * @description 获取类库的版本
 */
function getVersions(lib, src) {
    const files = fs.readdirSync(src)
    let fpath = null
    let verReg = new RegExp(lib+"-(\\d*\\.\\d*\\.\\d*)")
    let versions = []
    for (let i = 0; i < files.length; i++) {
        fpath = path.resolve(src, files[i])
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

/**
 * @description 读取编辑文件id
 */
function readEditIds(fpath){
    const text = fs.readFileSync(fpath, 'utf-8')
    let header = ['preid', 'curid', 'version']
    let editIds = parse(text, {
        columns: header
    })
    return editIds
}

/**
 * @description 读取差异文件id
 */
function readDiffIds(fpath){
    const text = fs.readFileSync(fpath, 'utf-8')
    let header = ['id', 'type', 'version']
    let diffIds = parse(text, {
        columns: header
    })
    return diffIds
}

/**
 * @description 计算前后版本的主题向量差之模
 * 版本间的差异由增删改三种文件产生
 * 对应文件求向量差（主题概率）
 * 将向量差的距离叠加起来成为版本间主题的差异（求和）
 */
function getNormOfDiffVecs(versions, diffIds, editIds, docTopics) {
    var norm = []

    versions.forEach(d => {
        norm.push({ver: d, val: 0})
    })
    
    for(let i=1; i<versions.length; i++) {
        curv = versions[i]
        // 增加文件
        diffIds.forEach(item =>{
            if(item.version === curv && item.type === 'add'){
                let diffvec = docTopics[parseInt(item.id)]
                norm[i].val += getNorm(diffvec)
            }
        })
        // 删除文件
        diffIds.forEach(item =>{
            if(item.version === curv && item.type === 'del'){
                let diffvec = docTopics[parseInt(item.id)].map(x => -x)
                norm[i].val += getNorm(diffvec)
            }
        })
        // 修改文件
        editIds.forEach(item =>{
            if(item.version === curv){
                let prevec = docTopics[parseInt(item.preid)],
                    curvec = docTopics[parseInt(item.curid)]
                let diffvec = curvec.map((x, i) => x-prevec[i])
                norm[i].val += getNorm(diffvec)
            }
        })
    }
    return norm
}

function getNorm(vec){
    let sum = 0
    vec.forEach(x =>{
        sum += x*x
    })
    return Math.sqrt(sum)
}


// const topicData = getTopicData(), fileData = getFileData(topicData.length),
//     editFileIds = getEditFileIds(fileData),
//     normData = getNormOfDiffVecs(fileData, editFileIds)



// router.get('/getEditFileIds', function(req, res, next){
//     res.send(editFileIds)
// })



// /**
//  * @description 获取源代码
//  */
// router.get('/getCode', function (req, res, next) {
//     var text = fs.readFileSync(req.query.filepath, 'utf-8')
//     res.send(text)
// })

// router.get('/getDiffDocs', function(req,res,next){
//     let prev = req.query.prev,
//         curv = req.query.curv
//     const diffDocs = getDiffDocs(prev, curv, fileData, editFileIds)
//     res.send(diffDocs)
// })

// /**
//  * @description 根据版本号获取主题在文件中的分布
//  */
// router.get('/getTopicDisByVersion', function (req, res, next) {
//     const verReg = /vue-(\d*\.\d*\.\d*)/
//     const curv = req.query.curv,
//         curvFilteredTopicData = fileData.filter(d => d.filename.match(verReg)[1] === curv)
//     let vueDir = path.join(__dirname, '../data/vue-all-versions', `vue-${curv}`, 'src')
//     let directory = vueDir.replace(/\\/g, '\\\\'),
//         root = {
//             name: vueDir,
//             type: 'dir',
//             children: []
//         }
//     readDirSync(directory, root, curvFilteredTopicData, 'curv') 
    
//     // 增加上一版本的文件
//     const prev = req.query.prev
//     if(prev){
//         prevFilteredTopicData = fileData.filter(d => d.filename.match(verReg)[1] === prev)
//         let prevDir = path.join(__dirname, '../data/vue-all-versions', `vue-${prev}`, 'src')
//         addPrevFile(convertSlash(prevDir), root, prevFilteredTopicData)

//         var diffDocs = getDiffDocs(prev, curv, fileData, editFileIds)
//         diffDocs.forEach(doc =>{
//             let vec = doc.vec
//             vec = vec.map(d => d*d)
//             let norm = Math.sqrt(vec.reduce(getSum))
//             doc['norm'] = norm
//         })
//         res.send({root: root, diffDocs: diffDocs})
//     }
//     else
//         res.send(root) 
// })

// function convertSlash(path){
//     let slashReg=/\\/g
//     return path.replace(slashReg,'\\\\')
// }

// // 读取文件夹下的子文件
// function readDirSync(rootPath, root, topicData, strv) {
//     var pa = fs.readdirSync(rootPath);
//     pa.forEach(function (ele, index) {
//         let suffix = ele.substr(ele.lastIndexOf('.'))
//         if (blackList.indexOf(suffix) !== -1) return
//         var curPath = path.resolve(rootPath, ele),
//             info = fs.statSync(curPath)
//         if (info.isDirectory()) {
//             let tmpdir = { name: curPath, children: [], type: 'dir', version: strv }
//             root.children.push(tmpdir)
//             readDirSync(curPath, tmpdir, topicData, strv);
//         } else {
//             let convertPath=convertSlash(curPath)
//             let curDoc = topicData.find(d => d.filename === convertPath)
//             if(curDoc===undefined){
//                 return
//             }
//             root.children.push({
//                 name: curPath,
//                 type: 'file',
//                 topic: curDoc['Dominant_Topic'],
//                 id: curDoc['id'],
//                 version: strv 
//             })
//         }
//     })
// }

// function addPrevFile(rootPath, root, topicData){
//     let pa = fs.readdirSync(rootPath)
//     pa.forEach(function(ele, index) {
//         let suffix = ele.substr(ele.lastIndexOf('.'))
//         if (blackList.indexOf(suffix) !== -1) return
//         let curPath = path.resolve(rootPath, ele),
//             info = fs.statSync(curPath)
//         let i=0
//         for(; i<root.children.length; i++) {
//             let dirName = root.children[i].name
//             dirName = dirName.substr(dirName.lastIndexOf('\\')+1)
//             if(ele === dirName){
//                 if(info.isDirectory())
//                     addPrevFile(curPath, root.children[i], topicData)
//                 else{
//                     let convertPath=convertSlash(curPath)
//                     curDoc = topicData.find(d => d.filename === convertPath)
//                     root.children[i]['preId'] = curDoc['id']
//                 }
//                 break
//             }     
//         }
//         if(i === root.children.length){
//             if(info.isDirectory()) {
//                 root.children.push({
//                     name: curPath, 
//                     children: [], 
//                     type: 'dir', 
//                     version: 'prev'
//                 })
//                 readDirSync(curPath, root.children[i], topicData, 'prev')
//             }
//             else {
//                 let convertPath=convertSlash(curPath)
//                 curDoc = topicData.find(d => d.filename === convertPath)
//                 root.children.push({
//                     name: curPath,
//                     type: 'file',
//                     topic: curDoc['Dominant_Topic'],
//                     id: curDoc['id'],
//                     version: 'prev' 
//                 })
//             }
//         }     
//     })
// }




// function getSum(total, num){
//     return total+num
// }
// function getVersion (fileName) {
//     let verReg = /vue-(\d*\.\d*\.\d*)/
//     return fileName.match(verReg)[1]
// }
// function getRelPath (fileName) {
//     let verReg = /vue-(\d*\.\d*\.\d*)(.*)/
//     return fileName.match(verReg)[2]
// }

// // 获取指定版本范围后, 前后版本间的文件
// function getDiffDocs(prev, curv, fileData, editFileIds){
//     var prevDocs = fileData.filter(d => getVersion(d.filename) === prev),
//         curvDocs = fileData.filter(d => getVersion(d.filename) === curv)
//     let addDocs = _.differenceBy(curvDocs, prevDocs, d => getRelPath(d['filename'])),
//         delDocs = _.differenceBy(prevDocs, curvDocs, d => getRelPath(d['filename'])),
//         editDocsObj = _.groupBy(prevDocs.concat(curvDocs), d => getRelPath(d['filename']))
    
//     var diffDocs = [], delIds = []
//     addDocs.forEach(doc => {
//         let editIds = editFileIds.filter(ids => ids.curid.indexOf(parseInt(doc.id)) != -1)
//         if(editIds.length > 0){
//             let prevDoc = delDocs.filter(deldoc => editIds[0].preid.indexOf(parseInt(deldoc.id)) != -1)
//             if(prevDoc.length > 0){
//                 let prevVec = prevDoc[0]['Topic_Contribution'].map(topic => topic['percent']),
//                     curvVec = doc['Topic_Contribution'].map(topic => topic['percent'])
//                 diffDocs.push({
//                     fileName: [prevDoc.filename, doc.filename],
//                     vec: curvVec.map((d,i) => d - prevVec[i]),
//                     type: 'edit',
//                     fileIds: [prevDoc[0].id, doc.id]
//                 })
//                 delIds.push(prevDoc[0].id)
//             }
//         }
//         else {
//             let curvVec = doc['Topic_Contribution'].map(topic => topic['percent'])
//             diffDocs.push({
//                 fileName: [doc.filename],
//                 vec: curvVec,
//                 type: 'add',
//                 fileIds: [doc.id],
//             })
//         }
//     })

//     delDocs.filter(doc => delIds.indexOf(doc.id) === -1)
//         .forEach(doc => {
//         let prevVec = doc['Topic_Contribution'].map(topic => -topic['percent'])
//         diffDocs.push({
//             fileName: [doc.filename],
//             vec: prevVec,
//             type: 'del',
//             fileIds: [doc.id]
//         })
//     })
//     Object.keys(editDocsObj).forEach(key => {
//         let preData, nextData, version
//         if(editDocsObj[key].length === 2){
//             for (let j = 0; j < editDocsObj[key].length; j++) {
//                 version = getVersion(editDocsObj[key][j].filename)
//                 if (version === prev) preData = editDocsObj[key][j]
//                 else nextData = editDocsObj[key][j]
//             }
//             let prevVec = preData['Topic_Contribution'].map(topic => topic['percent']),
//                 curvVec = nextData['Topic_Contribution'].map(topic => topic['percent'])
//             diffDocs.push({
//                 fileName: [preData.filename, nextData.filename],
//                 vec: curvVec.map((d,i) => d - prevVec[i]),
//                 type: 'edit',
//                 fileIds: [preData.id, nextData.id]
//             })
//         }
//     })
//     return diffDocs
// }

// function getEditFileIds(fileData){
//     let filepath = path.join(__dirname, '../data/deal-data/edit-fileids.csv')
//     const fpath = filepath.replace(/\\/g, '\\\\')

//     const text = fs.readFileSync(fpath, 'utf-8')
//     var fileIds = parse(text, {
//         columns: true
//     })
//     fileIds.forEach(d => {
//         let preDoc = fileData[parseInt(d.preid)], curDoc = fileData[parseInt(d.curid)]
//         let preIds = [parseInt(d.preid)], curIds = [parseInt(d.curid)]
//         for(let i=0; i<parseInt(d.preid); i++){
//             if(getRelPath(fileData[i].filename)===getRelPath(preDoc.filename))
//                 preIds.push(i)
//         }
//         for(let i=parseInt(d.curid)+1; i<fileData.length; i++){
//             if(getRelPath(fileData[i].filename)===getRelPath(curDoc.filename))
//                 curIds.push(i)
//         }
//         d.preid = preIds
//         d.curid = curIds
//     })
//     return fileIds
// }

module.exports = router;