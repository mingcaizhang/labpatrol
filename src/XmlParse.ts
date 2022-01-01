import * as cheerio from 'cheerio'
import { DiagGradePath, DiagGradeItem, DiagGradeItemList } from "./DiagPub"
import logger from "./logger"
import * as fs from "fs"
class XmlParse {
    parseStr:string = ''
    $:cheerio.CheerioAPI|undefined
    constructor() {
    }

    setParseStr(parseStr:string) {
        this.parseStr = parseStr
        this.$ = cheerio.load(parseStr)
    }


    retriveParseNode(prePath:string, path:DiagGradePath, preElem:cheerio.Element|undefined):DiagGradePath[] {
        if (!this.$) {
            logger.error('retriveParseNode: no cheerio loaded')
            return []
        }
        let that = this
        let firstNodePath = path[0]
        let nodeResultList:DiagGradeItemList = []
        let nextElem: cheerio.Cheerio<cheerio.Element>
        for (let ii = 0; ii < firstNodePath.length - 1; ii++) {
            let searchNode = firstNodePath[ii]
            if (preElem) {
                nextElem  = this.$(prePath + searchNode.prefix, preElem) as cheerio.Cheerio<cheerio.Element> 
            }else {
                nextElem = this.$(prePath +  searchNode.prefix) as cheerio.Cheerio<cheerio.Element> 
                
            }


            if (searchNode.value != '') {
                if (nextElem.text() != searchNode.value) {
                    logger.info(`retriveParseNode：<1> can not match node with name ${searchNode.prefix} value ${searchNode.value}`)
                    return []
                }
            }
            let value = nextElem.text()
            let nodeWithRes:DiagGradeItem = {prefix: searchNode.prefix, value: value}
            nodeResultList.push(nodeWithRes)
        }

        let searchNode = firstNodePath[firstNodePath.length -1]
        if (preElem) {
            nextElem = this.$(prePath + searchNode.prefix, preElem) as cheerio.Cheerio<cheerio.Element> 
        }else {
            nextElem = this.$(prePath + searchNode.prefix) as cheerio.Cheerio<cheerio.Element> 
        }

		if (!nextElem) {
            logger.info(`retriveParseNode：<2> can not find node with name ${searchNode.prefix} value ${searchNode.value}`)
            return []
        }
        let retResultPath: DiagGradePath[] = []
        
        nextElem.each(function(index, elem) {
            let value = ''
            if (that.$ && elem.childNodes.length === 1) {
                value = that.$(elem).text()
            }
           
            if (searchNode.value != '') {
                if (that.$) {
                    if (that.$(elem).text() === (searchNode.value)) {
                        logger.info(`retriveParseNode：<3> can not match node with name ${searchNode.prefix} value ${searchNode.value}`)
                        return
                    }
                }
            }

            let nodeWithRes:DiagGradeItem = {prefix: searchNode.prefix, value: value}
            let nodeReulstTemp = [...nodeResultList]
            nodeReulstTemp.push(nodeWithRes)
            if (path.length === 1) {
                retResultPath.push([nodeReulstTemp])
            }else {
                let nextPathResult = that.retriveParseNode('', path.slice(1), elem)
                if (!nextPathResult || nextPathResult.length == 0) {
                    return
                }

                for (let ii = 0; ii < nextPathResult.length; ii++)  {
                    retResultPath.push([[...nodeReulstTemp], ...nextPathResult[ii]])
                }
                
            }
        })

        return  retResultPath       
    }    
}

if (__filename === require.main?.filename) {
    (async ()=>{
        var data = fs.readFileSync('startup-config.xml')
        let xml = new XmlParse()
        xml.setParseStr(data.toString())

        let pathResult = [[{prefix:"ont", value:''}], [{prefix:"ont-id", value:"836"}, {prefix:"linked", value:""}], [{prefix:'serial-number', value:''}]]

        let ret = xml.retriveParseNode('config system >', pathResult, undefined)
        console.log(JSON.stringify(ret))

        pathResult = [[{prefix:"ont", value:''}], [{prefix:"ont-id", value:"836"}, {prefix:"interface", value:""}],
                        [{prefix:"ont-ethernet", value:""}], [{prefix:"port", value:""}, {prefix:"vlan", value:""}],
                        [{prefix:"> vlan-id", value:""}, {prefix:"c-vlan", value:""}], [{prefix:"vlan-id", value:""}, {prefix:"policy-map", value:""}], [{prefix:"name", value:""}]
                        ]
        ret = xml.retriveParseNode('config system >', pathResult, undefined)
        console.log(JSON.stringify(ret))

    })()
}