var path = require('path');
var fs = require('fs');

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
function calSim(a,b) {

}

/**
 * @description 层次聚类
 */
function cluster() {
    let topicData = getTopicData().map(d => ({
        key:[d.key],
        keywords:d.keywords
    })),
        simThreshold = 0.3, i = 0, j = 0,
        maxSim = -1, minSim = 10000, clusterI, clusterJ, simIJ = 0,
        maxI, maxJ, tmpClusterI, tmpClusterJ
    len = topicData.length
    while (len > 1) {
        maxSim = -1
        minSim = 10000
        for (i = 0; i < len; i++) {
            clusterI = topicData[i]
            for (j = i + 1; j < len; j++) {
                simIJ = calSim(clusterI, clusterJ)
                if (simIJ < minSim) minSim = simIJ
                if (simIJ > maxSim) {
                    maxI = i
                    maxJ = j
                    maxSim = simIJ
                }
            }
        }
        tmpClusterI = topicData[maxI]
        tmpClusterJ = topicData[maxJ]
        topicData.splice(maxI)
        topicData.splice(maxJ)
        topicData.push({
            index: tmpClusterI[key].concat(tmpClusterJ[key]),
            keywords: tmpClusterI[keywords].concat(tmpClusterJ[keywords])
        })
        len = topicData.length
    }
}
function main() {

}