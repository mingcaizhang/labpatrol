import { DiagTree, DiagNode } from "./DiagUtity"
import { DiagGradePath, DiagGradeItem, DiagGradeItemList } from "./DiagPub"
import logger  from "./logger"


export class DiagGradeParse {
    parseStr:string = ''
    parseTree:DiagTree|undefined
    constructor() {

    }

    setParseStr(parseStr:string) {
        this.parseStr = parseStr
        this.parseTree = undefined
    }

    getConfigLevel(strItem:string):number {
        for (let ii = 0 ; ii < strItem.length; ii++) {
            if (strItem[ii] != ' ') {
                return ii
            }
        }

        return strItem.length
    }

    buildConfgTree() {
        let configTree = new DiagTree()
        let levelNodeList = new Array<DiagNode>(16)
        let parseStrList = this.parseStr.split('\r\n')
        let level = -1
        for (let item of parseStrList) {
            if (item.trim() === '!' || item.trim() === '') {
                continue
            }
            level = this.getConfigLevel(item)
            let node = new DiagNode(item)
            levelNodeList[level] = node
            if (level === 0) {
                configTree.linkToHead(node)
            }else {
                levelNodeList[level -1].add(node)
            }
        }
        this.parseTree = configTree
    }

    retriveParseNode(path:DiagGradePath):DiagGradePath[] {
        if (!this.parseTree) {
            this.buildConfgTree()
        }
        if (this.parseTree && this.parseTree.head) {
            return this._retriveParseNode(this.parseTree.head, path)
        }else {
            return []
        }
    }

    getItemValueFromPath(path:DiagGradePath[], preList:string[]):string[][]{
        let preListLen = preList.length
        let returnList = []
        for (let ii = 0; ii < path.length; ii++) {
            let arrResult = new Array(preList.length)
            let preIdx = 0
            let done = false

            for (let jj = 0; jj < path[ii].length; jj++) {
                for (let zz = 0; zz < path[ii][jj].length; zz++) {
                    if (path[ii][jj][zz].prefix === preList[preIdx]) {
                        arrResult[preIdx] = path[ii][jj][zz].value.trim()
                        preIdx ++
                        if (preIdx >= preList.length) {
                            done = true
                            break
                        }
                    }
                }
                if (done) {
                    break
                }
            }
            returnList.push(arrResult)
        }
        return returnList
    }

	_retriveParseNode(parentNode:DiagNode, path:DiagGradePath): DiagGradePath[]{
        let curNode = parentNode
        let nextNodes:DiagNode[]|null = null
        if (path.length === 0) {
            logger.error('retriveConfigNode: no path')
            return []
        }

        let firstNodePath = path[0]
        let nodeResultList:DiagGradeItemList = []
        for (let ii = 0; ii < firstNodePath.length - 1; ii++) {
            let item = firstNodePath[ii]
            nextNodes = curNode.findChildWithContent(item.prefix)
            if (!nextNodes || nextNodes.length === 0) {
                logger.info(`retriveConfigNode: can not find node with name ${item.prefix} value ${item.value}`)
                return []
            }
            if (nextNodes.length > 1) {
                logger.error(`retriveConfigNode： find more than one Nodes`)
                return []
            }
            if (item.value != '') {
                if (nextNodes[0].isNodeHasContent(item.value)) {
                    logger.info(`retriveConfigNode：can not match node with name ${item.prefix} value ${item.value}`)
                }
            }
            let value = nextNodes[0].getData()
            let nodeWithRes:DiagGradeItem = {prefix: item.prefix, value: value.replace(item.prefix, '')}
            nodeResultList.push(nodeWithRes)
        }

        let item = firstNodePath[firstNodePath.length -1]
		nextNodes = curNode.findChildWithContent(item.prefix)
		if (!nextNodes || nextNodes.length == 0) {
            logger.info(`retriveConfigNode：can not find node with name ${item.prefix} value ${item.value}`)
            return []
        }
        let retResultPath: DiagGradePath[] = []
        for (let nodeNext of nextNodes) {
            if (item.value != '') {
                if (!nodeNext.isNodeHasContent(item.value)) {
                    logger.info(`retriveConfigNode：can not match node with name ${item.prefix} value ${item.value}`)
                    continue
                }
            }
            let value = nodeNext.getData()
            let nodeWithRes:DiagGradeItem = {prefix: item.prefix, value: value.replace(item.prefix, '')}
            let nodeReulstTemp = [...nodeResultList]
            nodeReulstTemp.push(nodeWithRes)
            if (path.length === 1) {
                retResultPath.push([nodeReulstTemp])
            }else {
                let nextPathResult = this._retriveParseNode(nodeNext, path.slice(1))
                if (!nextPathResult || nextPathResult.length == 0) {
                    continue
                }

                for (let ii = 0; ii < nextPathResult.length; ii++)  {
                    retResultPath.push([[...nodeReulstTemp], ...nextPathResult[ii]])
                }
                
            }
        }

        return retResultPath

    }

}