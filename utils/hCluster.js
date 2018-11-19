var path = require('path');
var fs = require('fs');
var parse = require('csv-parse/lib/sync')
/**
 * @description 格式化topic数据
 */
function getTopicData() {
    const text = fs.readFileSync('/Users/wendahuang/Desktop/data/vue-topic.csv', 'utf-8')
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
 * @description 计算两个类之间的相似度
 * @param {Cluster} a 
 * @param {Cluster} b 
 */
function calSim({ keywords: a }, { keywords: b }) {
    const wordsNum = 10,
        minLen = a.length < b.length ? a.length : b.length
    let sharedWords = 0, i = 0
    a.sort((i, j) => j.weight - i.weight)
    b.sort((i, j) => j.weight - i.weight)
    while (i < minLen) {
        if (a[i].keyword === b[i].keyword) {
            sharedWords++
        }
        i++
    }
    return sharedWords / 10
}

/**
 * @description 层次聚类
 */
function cluster(data) {
    let topicData = data.map(d => ({
        index: [d.index],
        keywords: d.keywords
    })),
        i = 0, j = 0,
        maxSim = -1, minSim = 10000, clusterI, clusterJ, simIJ = 0,
        maxI, maxJ, tmpClusterI, tmpClusterJ, simThreshold = 0.3,
        len = topicData.length
    while (len > 1) {
        maxSim = -1
        minSim = 10000
        for (i = 0; i < len; i++) {
            clusterI = topicData[i]
            for (j = i + 1; j < len; j++) {
                clusterJ = topicData[j]
                simIJ = calSim(clusterI, clusterJ)
                if (simIJ > maxSim) {
                    maxI = i
                    maxJ = j
                    maxSim = simIJ
                }
            }
        }
        if (maxSim < simThreshold) break
        tmpClusterI = topicData[maxI]
        tmpClusterJ = topicData[maxJ]
        topicData = topicData.filter((d, i) => i !== maxI && i !== maxJ)
        /*         topicData.splice(maxI,1)
                topicData.splice(maxJ,1) */
        topicData.push({
            index: tmpClusterI['index'].concat(tmpClusterJ['index']),
            keywords: tmpClusterI['keywords'].concat(tmpClusterJ['keywords']),
            children:[tmpClusterI,tmpClusterJ]
        })
        len = topicData.length
    }
    return {
        name:'root',
        children:topicData
    }
}
module.exports = cluster
/* function main() {
    cluster()
}
main() */