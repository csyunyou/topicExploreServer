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
        dirpath: '../Data/vue',
        srcPath: '../Data/vue/vue-all-versions',
        infoPath: '../Data/vue/all-original-text.csv',
        diffPath: '../Data/vue/diffIds.csv',
        editPath: '../Data/vue/editIds.csv',
        topicWordsPath: '../Data/vue/topic_words.csv',
        docTopicsPath: '../Data/vue/doc_topics.csv',
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
        dirpath: '../Data/d3',
        srcPath: '../Data/d3/d3-all-versions',
        infoPath: '../Data/d3/all-original-text.csv',
        diffPath: '../Data/d3/diffIds.csv',
        editPath: '../Data/d3/editIds.csv',
        topicWordsPath: '../Data/d3/topic_words.csv',
        docTopicsPath: '../Data/d3/doc_topics.csv',
        topicWords: null,
        docTopics: null,
        topicData: null,
        fileData: null,
        versions: null,
        editIds: null,
        diffIds: null,
        normData: null,
        curNormData: null
    }
}

var lib, topicData, fileData, versions, editIds, normData, curNormData

/* GET home page. */
router.get('/getLibName', function (req, res, next) {
    lib = req.query.libName
    preprocess(lib)

    topicData = libData[lib].topicData
    fileData = libData[lib].fileData
    versions = libData[lib].versions
    editIds = libData[lib].editIds
    normData = libData[lib].normData
    docTopics = libData[lib].docTopics
    curNormData = libData[lib].curNormData

    res.send({'flag': true})
})

// 获取所有文件数据
router.get('/getAllDocs', function (req, res, next) {
    res.send({
        files: fileData,
        versions: versions
    })
});

router.get('/getNormData', function(req, res, next){
    res.send(curNormData)
})

// 获取主题关键词
router.get('/getTopicData', function (req, res, next) {
    res.send(topicData) 
})

// 获取前后版本向量差的模
router.get('/getNormOfDiffVecs', function(req, res, next){
    res.send(normData)
})

//获取文件-主题矩阵
router.get('/getDocTopics', function(req, res, next){
    res.send(docTopics)
})

// 获取文件结构
router.get('/getFileHierarchyByVersion', function (req, res, next) {
    const version = req.query.version,
        curFileData = fileData.filter(d => d.version === version)
    
    // join路径之后, '/'变成'\'
    let libDir = path.join(libData[lib].srcPath, `${lib}-${version}`, 'src')
    let directory = libDir.replace(/\\/g, '/')

    let root = {
            name: libDir,
            type: 'dir',
            children: []
        }
    readFileHierarchy(directory, root, curFileData, version) 
    addTopicNodes(root)
    res.send(root)
})

// 获取两个版本间的差异文件
router.get('/getDiffDocs', function(req,res,next){
    let prev = req.query.prev,
        curv = req.query.curv
    var diffDocs = getDiffDocs(prev, curv, editIds, fileData)
    res.send(diffDocs)
})

// 获取文件源码
router.get('/getCode', function (req, res, next) {
    var text = fs.readFileSync(req.query.filename, 'utf-8')
    res.send(text)
})

/**
 * @description 后台预处理数据
 */
function preprocess(lib){
    // topic-word数据
    libData[lib].topicWords = readTopicWords(libData[lib].topicWordsPath)
    console.log('topic-word finish')
    // doc-topic数据
    libData[lib].docTopics = readDocTopics(libData[lib].docTopicsPath)
    console.log('doc-topic finish')
    // 单词重新赋权重
    libData[lib].topicData = getTopicData(libData[lib].topicWords)
    console.log('new-topic-word finish')
    // 文件数据
    libData[lib].fileData = getFileData(libData[lib].infoPath, libData[lib].docTopics)
    console.log('all-file-data finish')
    // 版本号
    libData[lib].versions = getVersions(lib, libData[lib].srcPath) 
    console.log('all-version finish')
    // 编辑文件
    libData[lib].editIds = readEditIds(libData[lib].editPath)
    console.log('edit-file finish')
    // 差异文件
    libData[lib].diffIds = readDiffIds(libData[lib].diffPath) 
    console.log('diff-file finish')
    // 版本向量差模
    libData[lib].normData = getNormOfDiffVecs(libData[lib].versions, libData[lib].diffIds, libData[lib].editIds, libData[lib].docTopics)
    console.log('diff-vec finish')
    //文件向量模
    libData[lib].curNormData = getNormData(libData[lib].docTopics)
    console.log('norm-data finish')

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
   
    fileData.forEach(doc => {
        // 删除不需要的字段
        delete doc.identifiers
        delete doc.commentsArr
        delete doc.comments
        delete doc.size
        delete doc.fun_num

        doc['id'] = parseInt(doc['id'])
        doc['filename'] = doc['filename'].replace(/\\/g, '/')

        // 重新构造doc-topic矩阵
        let topicProbs = docTopics[doc['id']]     
        let id = 0, newTopicProbs = []
        topicProbs.forEach(d =>{
            // weight表示文档在每个主题上的概率
            newTopicProbs.push({'topic_id': id, 'weight': d})
            id++
        })
        newTopicProbs.sort(function(a, b){
            return b.weight - a.weight
        })

        doc['main_topic'] = newTopicProbs[0]['topic_id']
        doc['main_weight'] = newTopicProbs[0]['weight']
        doc['topicDistribution'] = newTopicProbs 
    })
    return fileData 
}

/**
 * @description 获取类库的版本
 */
function getVersions(lib, src) {
    const files = fs.readdirSync(src)
    let fpath = null,
        verReg = new RegExp(lib+"-(\\d*\\.\\d*\\.\\d*)"),
        versions = []
    for (let i = 0; i < files.length; i++) {
        // resolve路径之后得到绝对路径'\'
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
    editIds.forEach(d =>{
        d['preid'] = parseInt(d['preid'])
        d['curid'] = parseInt(d['curid'])
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
    diffIds.forEach(d =>{
        d['id'] = parseInt(d['id'])
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
                let diffvec = docTopics[item.id]
                norm[i].val += getNorm(diffvec)
            }
        })
        // 删除文件
        diffIds.forEach(item =>{
            if(item.version === curv && item.type === 'del'){
                let diffvec = docTopics[item.id].map(x => -x)
                norm[i].val += getNorm(diffvec)
            }
        })
        // 修改文件
        editIds.forEach(item =>{
            if(item.version === curv){
                let prevec = docTopics[item.preid],
                    curvec = docTopics[item.curid]
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

/**
 * @description 获取文件向量的模长
 */
function getNormData(docTopics){
    var norm = []
    var sum = 0
    for(let i = 0; i < docTopics.length; i++){
        let vec = docTopics[i]
        norm.push(getNorm(vec))
    }
    return norm;
}

/**
 * @description 读取文件结构
 */
function readFileHierarchy(rootPath, root, fileData, version) {
    var pa = fs.readdirSync(rootPath);
    pa.forEach(function (ele, index) {
        // 判断是否是黑名单
        let suffix = ele.substr(ele.lastIndexOf('.'))
        if (blackList.indexOf(suffix) !== -1) return
        
        // resolve路径之后, 得到绝对路径'\'
        var curPath = path.resolve(rootPath, ele),
            info = fs.statSync(curPath)

        // 绝对路径转换为相对路径
        var convertPath = curPath.replace(/C:\\Users\\50809\\Desktop\\CodeEvolution/g, '..')
        convertPath = convertPath.replace(/\\/g, '/')

        if (info.isDirectory()) {
            let tmpdir = { name: convertPath, children: [], type: 'dir', version: version }
            root.children.push(tmpdir)
            readFileHierarchy(curPath, tmpdir, fileData, version);
        } else {
            let curDoc = fileData.find(d => d.filename === convertPath)
            if(curDoc === undefined) return 
            root.children.push({
                name: convertPath,
                type: 'file',
                topic: curDoc['main_topic'],
                id: curDoc['id'],
                version: version,
            })                   
        }
    })
}

/**
 * @description 在文件结构图中添加主题节点
 */
function addTopicNodes(root){
    for(let i=0; i<root.children.length; i++){
        if(root.children[i].type === 'dir')
            addTopicNodes(root.children[i])
        if(root.children[i].type === 'file'){
            let topicNode = root.children.filter(d => d.topicId === root.children[i].topic)
            if(topicNode.length === 1){
                topicNode[0].children.push(root.children[i])
            }
            else{
                let newTopicNode = { 
                    name: 'topic_'+root.children[i].topic, 
                    topicId: root.children[i].topic,
                    type: 'topic',
                    children: []
                }
                root.children.push(newTopicNode)
                newTopicNode.children.push(root.children[i])
            }
        }
        if(root.children[i].type === 'topic'){
            root.children = root.children.filter(d => d.type != "file")
            break
        }
    }
}

/**
 * @description 分类差异文件
 */
function getDiffDocs(prev, curv, editIds, fileData){
    var prevDocs = fileData.filter(d => d.version === prev),
        curvDocs = fileData.filter(d => d.version === curv)

    let verReg = new RegExp(lib+"-(/d*/./d*/./d*)(.*)")
    let addDocs = _.differenceBy(curvDocs, prevDocs, d => d['filename'].match(verReg)[2]),
        delDocs = _.differenceBy(prevDocs, curvDocs, d => d['filename'].match(verReg)[2]),
        editDocs = _.groupBy(prevDocs.concat(curvDocs), d => d['filename'].match(verReg)[2])
    
    var addIds_ = [], delIds_ = [], editIds_ = []
    addDocs.forEach(doc => {
        // 查找是否有属于edit的增加文件(首先保证编辑文件中id是一对一的)
        let edit_in_add = editIds.filter(d => d.curid === doc.id), preid = -1
        if(edit_in_add.length > 0){
            // 当前版本与前一版本对应的编辑文件id
            preid = edit_in_add[0].preid
            for(let i=versions.indexOf(curv)-1; i> versions.indexOf(prev); i--){
                // 继续往前一版本查找
                let preid_ = editIds.filter(d => d.version === versions[i] && d.curid === preid)
                if(preid_.length > 0){
                    preid = preid_.preid
                }
                else{
                    addIds_.push(doc.id)
                    break
                }
            }
            if(preid != -1){
                editIds_.push([preid, doc.id, 'm'])
            } 
        }
        addIds_.push(doc.id)
    })

    delDocs.forEach(doc => {
        // 查找是否有属于edit的删除文件(首先保证编辑文件中id是一对一的)
        let edit_in_del = editIds.filter(d => d.preid === doc.id), curid = -1
        if(edit_in_del.length > 0){
            // 当前版本与后一版本对应的编辑文件id
            curid = edit_in_del[0].curid
            for(let i=versions.indexOf(prev)+2; i<=versions.indexOf(curv); i++){
                // 继续往前一版本查找
                let curid_ = editIds.filter(d => d.version === versions[i] && d.preid === curid)
                if(curid_.length > 0){
                    curid = curid_.curid
                }
                else{
                    delIds_.push(doc.id)
                    break
                }
            }
            if(curid != -1) {
                editIds_.push([doc.id, curid, 'm'])
            }
        }
        delIds_.push(doc.id)
    })

    Object.keys(editDocs).forEach(key => {
        if(editDocs[key].length === 2){
            let item = editDocs[key]
            editIds_.push([item[0].id, item[1].id])
        }  
    })

    return {'add': addIds_, 'del': delIds_, 'edit': editIds_}
}

module.exports = router;