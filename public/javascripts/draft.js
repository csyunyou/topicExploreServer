/**
 * @description 草稿本
 */
const _ =require('lodash')
let arr=[{name:'tom',age:11},{name:'tom',age:12}]
console.log(_.intersectionBy(arr,d=>d.name))
console.log(Array.isArray([]))
// console.log(arr.sort((a,b)=>(b-a)))

