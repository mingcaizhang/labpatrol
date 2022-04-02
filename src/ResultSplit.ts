import logger from "./logger"
import {DiagTable, DiagTableRow, DiagTableItem} from './DiagPub'

type SpacePos = {
    start: number;
    end: number;
  };

class ResultFormat {
    name:string;
    value:string;
    level:number;
    parent:ResultFormat|undefined;
    childs:ResultFormat[];
    constructor() {
        this.name = ''
        this.value = ''
        this.level=-1
        this.parent = undefined;
        this.childs = []
    }
};

export enum CliResFormatMode {
    CliResFormatTable = 1,
    CliResFormatLine = 2,
    CliResFormatTableWithSeparator = 3,
    CliResFormatLineExaWithColon = 4,   
    CliResFormatTableWithColumnNum = 5,
    CliResFormatTableCsv = 6
}

export class ResultSplit{
    outputStr:string;
    seperator:string;
    splitLines:string[];
    splitLinePos:number[];
    headerCol:string[][];
    contentCol:string[][];
    tableFormatOut:ResultFormat[];
    lineFormatOut:ResultFormat[];
    constructor () {
        this.outputStr = '';
        this.seperator = '--------';
        this.splitLines=[];
        this.headerCol = []
        this.contentCol = []
        this.splitLinePos = []
        this.tableFormatOut = []
        this.lineFormatOut = []

    }

    setOutput(output:string) {
        this.outputStr = output
    }

    mergeSpace(pos1:SpacePos[], pos2:SpacePos[]):SpacePos[] {
        let maxNum = pos1.length > pos2.length? pos2.length:pos1.length
        let pos1Cur = 0;
        let pos2Cur = 0;
        let resultPos:SpacePos[] = []
        let findStart = false;
        let newStart = 0
        let newEnd = 0;
        while(pos1Cur < pos1.length && pos2Cur < pos2.length) {
            if (findStart === false) {
                newStart = pos1[pos1Cur].start > pos2[pos2Cur].start?pos1[pos1Cur].start:pos2[pos2Cur].start
            }

            if (pos2[pos2Cur].end <= newStart) {
                pos2Cur++;
                continue;
            }
            if (pos1[pos1Cur].end <= newStart) {
                pos1Cur++;
                continue;
            }

            if (pos1[pos1Cur].start > pos2[pos2Cur].end) {
                newEnd = pos2[pos2Cur].end;
                resultPos.push({start:newStart, end:newEnd})
                pos2Cur++;
                findStart = false;
                continue;
            }else if (pos2[pos2Cur].start > pos1[pos1Cur].end) {
                newEnd = pos1[pos1Cur].end;
                resultPos.push({start:newStart, end:newEnd})
                pos1Cur++;
                findStart = false;
                continue;
            }   


            if (pos1[pos1Cur].end >  pos2[pos2Cur].end) {
                pos2Cur++
                continue;
            }else if (pos1[pos1Cur].end <  pos2[pos2Cur].end) {
                pos1Cur++
                continue;
            }else if (pos1[pos1Cur].end == pos2[pos2Cur].end) {
                newEnd = pos1[pos1Cur].end 
                resultPos.push({start:newStart, end:newEnd})
                pos1Cur++;
                pos2Cur++;
                findStart = false;
                continue;
            }
        }

        return resultPos
    }

    findSpace(lineStr:string):SpacePos[] {
        let headerSpl:SpacePos[] = []
        let isStartSpace:boolean = false
        let lineContent = lineStr
        let startPos:number = 0;
        let endPos:number = 0;
        if (!lineContent) {
            return headerSpl
        }
        for (let jj = 0; jj < lineContent.length; jj++) {
            
            if(lineContent[jj] == ' '){
                if (isStartSpace === false) {
                    startPos= jj;
                    isStartSpace = true;
                }
            }else {
                if (isStartSpace === true) {
                    endPos = jj;
                    let spacePos:SpacePos = {start:startPos, end:endPos}
                    headerSpl.push(spacePos)
                    isStartSpace = false
                }
            }
        }

        return headerSpl
    }

    splitToColumn(strContent:string, space:SpacePos[]):string[] {
        let strPos = 0;
        let resultColumn:string[] = []
        for (let ii = 0; ii < space.length; ii++) {
            let str = strContent.substr(strPos, space[ii].end - strPos)
            str = str.trim()
            resultColumn.push(str)
            strPos = space[ii].end;
        }

        if (strPos < strContent.length) {
            resultColumn.push(strContent.substr(strPos))
        }else {
            resultColumn.push('')
        }

        return resultColumn;
    }

    splitToColumnMultiline(startLine:number, endLine:number, space:SpacePos[]):string[] {
        let strPos = 0;
        let resultColumn:string[] = []
        for (let ii = 0; ii < space.length; ii++) {
            let str = ''
            for (let jj=startLine; jj <= endLine; jj++) {
                let tmp = this.splitLines[jj].substr(strPos, space[ii].end - strPos).trim() 
                if (tmp.length == 0) {
                    str = ''
                }else {
                    str += this.splitLines[jj].substr(strPos, space[ii].end - strPos).trim() + ' '
                }
                
            }
            str = str.trim()
            resultColumn.push(str)
            strPos = space[ii].end;
        }

        if (strPos < this.splitLines[endLine].length) {
            let str = ''
            for (let jj=startLine; jj <= endLine; jj++) {
                let tmp = this.splitLines[jj].substr(strPos).trim();
                if (tmp.length == 0) {
                    str = ''
                }else {
                    str += this.splitLines[jj].substr(strPos).trim() + ' '
                }
            }
            str = str.trim()
            resultColumn.push(str)
        }

        return resultColumn;
    }


    resultLineToNameValue(lineStr:string):[string, string] {
        let lineStrTmp = lineStr.trimStart();
        let sPos = lineStrTmp.search(/\s/)
        if (sPos != -1) {
            return [lineStrTmp.substr(0, sPos).trimEnd(), lineStrTmp.substr(sPos).trim()]
        }else {
            return [lineStrTmp, '']
        }
    }

    resultLineWithColonToNameValue(lineStr:string):[string, string] {
        let lineStrTmp = lineStr.trimStart();
        let sPos = lineStrTmp.search(/:/)
        if (sPos != -1) {
            return [lineStrTmp.substr(0, sPos).trimEnd(), lineStrTmp.substr(sPos+1).trim() === ''? ' ':lineStrTmp.substr(sPos+1).trim()]
        }else {
            return [lineStrTmp, '']
        }
    }    

    printResultTableFormat(resFormat:ResultFormat[]) {
        for (let ii = 0; ii < resFormat.length; ii++) {
            for (let jj = 0; jj < resFormat[ii].childs.length; jj++) {
                // console.log(resFormat[ii].childs[jj].name + '  ' + resFormat[ii].childs[jj].value)
            } 
        }

    }

    printResultLineFormat(resFormat:ResultFormat[]) {
        let printStr = ''
        for (let ii = 0; ii < resFormat.length; ii++) {
            printStr = ''
            for (let jj = 0; jj < resFormat[ii].level; jj++) {
                printStr += ' '
            }
            printStr += resFormat[ii].name + '  ' + resFormat[ii].value;
            logger.info(printStr)
            if (resFormat[ii].childs) {
                this.printResultLineFormat(resFormat[ii].childs)
            }
        }
    }

    splitResultExaLineWithColon():ResultFormat[] {
        let splitTmp = this.outputStr.split('\r\n')
        for (let ii = 0; ii < splitTmp.length; ii++) {
            this.splitLines.push(splitTmp[ii])
        }        
        let match = /\S/
        let splitResult:ResultFormat[] = []
        let parent:ResultFormat|undefined;
        let previous:ResultFormat|undefined;
        let curLevel = -1;
        for (let ii = -1; ii < this.splitLines.length; ii++) {
            let spaceNum = 0
            if (ii >= 0) {
                this.splitLines[ii] = this.splitLines[ii].trimEnd()
                spaceNum = this.splitLines[ii].search(match)
            }

            if (ii === -1 || this.splitLines[ii].length === 0) {
                if (ii - 1 > 0 && this.splitLines[ii-1].length === 0) {
                    continue;
                }
                let newResult = new ResultFormat()
                newResult.level = -1;
                [newResult.name, newResult.value] = ['','']
                curLevel = 0;
                parent = newResult
                previous = newResult
                splitResult.push(newResult)   
        
            }else {
                if (spaceNum == curLevel) {
                    let newResult = new ResultFormat()
                    newResult.level = spaceNum;
                    [newResult.name, newResult.value] = this.resultLineWithColonToNameValue(this.splitLines[ii])
                    if (newResult.value === '') {
                        continue
                    }
                    newResult.parent = parent;
                    previous = newResult;
                    parent?.childs.push(newResult)
                }else if (spaceNum > curLevel) {
                    let newResult = new ResultFormat()
                    newResult.level = spaceNum;
                    [newResult.name, newResult.value] = this.resultLineWithColonToNameValue(this.splitLines[ii])
                    if (newResult.value === '') {
                        continue
                    }
                    newResult.parent = previous
                    parent = previous;
                    previous = newResult;
                    parent?.childs.push(newResult);
                    curLevel = spaceNum;

                }else {
                    let newResult = new ResultFormat()
                    newResult.level = spaceNum;   
                    [newResult.name, newResult.value] = this.resultLineWithColonToNameValue(this.splitLines[ii])
                    if (newResult.value === '') {
                        continue
                    }
                    parent = parent?.parent
                    previous = newResult;
                    parent?.childs.push(newResult)       
                    curLevel = spaceNum       
                }
            }

        }      
        this.lineFormatOut = splitResult;  
        return splitResult
        
    }

    splitResultLine():ResultFormat[] {
        let splitTmp = this.outputStr.split('\r\n')
        for (let ii = 0; ii < splitTmp.length; ii++) {
            if (splitTmp.length <=0) {
                continue;
            }
            this.splitLines.push(splitTmp[ii])
        }
        let match = /\S/
        let splitResult:ResultFormat[] = []
        let parent:ResultFormat|undefined;
        let previous:ResultFormat|undefined;
        let curLevel = -1;
        for(let ii = 0; ii < this.splitLines.length; ii++) {
            this.splitLines[ii]= this.splitLines[ii].trimEnd()
            let spaceNum = this.splitLines[ii].search(match)
            if (spaceNum == 0) {
                let newResult = new ResultFormat()
                newResult.level = 0;
                [newResult.name, newResult.value] = this.resultLineToNameValue(this.splitLines[ii])
                curLevel = 0;
                parent = newResult
                previous = newResult
                splitResult.push(newResult)
            }else {
                if (spaceNum == curLevel) {
                    let newResult = new ResultFormat()
                    newResult.level = spaceNum;
                    [newResult.name, newResult.value] = this.resultLineToNameValue(this.splitLines[ii])
                    newResult.parent = parent;
                    previous = newResult;
                    parent?.childs.push(newResult)
                }else if (spaceNum > curLevel) {
                    let newResult = new ResultFormat()
                    newResult.level = spaceNum;
                    [newResult.name, newResult.value] = this.resultLineToNameValue(this.splitLines[ii])
                    newResult.parent = previous
                    parent = previous;
                    previous = newResult;
                    parent?.childs.push(newResult);
                    curLevel = spaceNum;

                }else {
                    let newResult = new ResultFormat()
                    newResult.level = spaceNum;   
                    [newResult.name, newResult.value] = this.resultLineToNameValue(this.splitLines[ii])
                    parent = parent?.parent
                    previous = newResult;
                    parent?.childs.push(newResult)       
                    curLevel = spaceNum       
                }
            }
        }
        this.lineFormatOut = splitResult;
        return splitResult;
    }

    splitResultTableWithSeparator() {
        let splitTmp = this.outputStr.split('\r\n')

        // logger.info(splitTmp)

        for (let ii=0; ii < splitTmp.length; ii++) {
            this.splitLines.push(splitTmp[ii])
            if (splitTmp[ii].indexOf(this.seperator) != -1) {
                this.splitLinePos.push(this.splitLines.length -1)
            }
        }

        if (this.splitLinePos.length == 0) {
            logger.info('no split line --------');
            return -1
        }
        let startLine = 0
        let endLine = 0
        let endMax = 0;
        for (let ii = 0; ii <this.splitLinePos.length; ii++) {
            // check the seperator line -1 
            let lineNum = this.splitLinePos[ii] 
            let matchRes = this.splitLines[lineNum].matchAll(/ /g)
            if (lineNum -1 < 0) {
                logger.error('invalid split line')
                return -1;
            }
            let space:SpacePos[] = [];
            for (let v of matchRes) {
                if (v.index) {
                    let sp:SpacePos = {start:v.index,
                        end:v.index +1}
                    space.push(sp)
                }
            }
            logger.info(space)
            let headerColumn = this.splitToColumnMultiline(startLine, lineNum-1, space)
            if (this.splitLinePos.length -1 > ii) {
                endMax  = this.splitLinePos[ii + 1] -1
            }else {
                endMax = this.splitLines.length
            }
            endLine = endMax;
            for (let jj = lineNum + 1; jj < endMax; jj++) {
                if (this.splitLines[jj].length == 0) {
                    endLine = jj;
                    break;
                }
            }
            for (let jj = lineNum + 1; jj < endLine; jj++) {
                let contentColumn = this.splitToColumn(this.splitLines[jj],space)                
                logger.info(headerColumn)
    
                let formatOut:ResultFormat = new ResultFormat()
                for (let jj = 0; jj< headerColumn.length; jj++) {
                    let child = new ResultFormat()
                    child.name = headerColumn[jj]
                    child.value = contentColumn[jj]
                    child.level = 0
                    formatOut.childs.push(child)
                }
                this.tableFormatOut.push(formatOut)    
            }
            startLine = lineNum + 2;
        } 
        return 0;

    }

    splitResultTableCsvFormat(minSplit:number = 3) {
        let splitTmp = this.outputStr.split('\r\n')

        // logger.info(splitTmp)

        for (let ii=0; ii < splitTmp.length; ii++) {
            if (splitTmp[ii].trim().length === 0) {
                continue
            }
            this.splitLines.push(splitTmp[ii])
        }

        if (this.splitLines.length <= 1) {
            logger.info('no valid output');
            return -1
        } 

    
        let headerColumn = this.splitLines[0].split(',')
        if (headerColumn.length < minSplit) {
            logger.error(`splitResultTableCsvFormat: invalid header column ${this.splitLines[0]}`)
            return -1
        }
        for (let ii = 1; ii < this.splitLines.length; ii++) {
            let contentColumn:string[] = []
            // csv output use " " to include multiple "," 
            if (this.splitLines[ii].indexOf(`"`) != -1) {
                let fromP = 0
                do {
                    let regRet = /".+?"/.exec(this.splitLines[ii].substring(fromP))
                    if (regRet) {
                        contentColumn.push(...this.splitLines[ii].substring(fromP, regRet.index -1).split(','))
                        contentColumn.push(regRet[0])
                        fromP += regRet.index + regRet[0].length + 1
                    }else {
                        contentColumn.push(...this.splitLines[ii].substring(fromP).split(','))
                        break
                    }
                    
                }while(this.splitLines[ii].indexOf(`"`, fromP))

            }else {
                contentColumn = this.splitLines[ii].split(',')
            }


            if (contentColumn.length != headerColumn.length) {
                logger.error(`splitResultTableCsvFormat content ${this.splitLines[ii]} invalid`)
                continue
            }
    
            let formatOut:ResultFormat = new ResultFormat()
            for (let jj = 0; jj< headerColumn.length; jj++) {
                let child = new ResultFormat()
                child.name = headerColumn[jj]
                child.value = contentColumn[jj]
                child.level = 0
                formatOut.childs.push(child)
            }
            this.tableFormatOut.push(formatOut)    
        }

        return 0;

    }
    // jezhang>show sessions 
    // "*" indicates this session.
    //                                                                            Auto
    // ID  User          Login                       Notifications   Pager      Logout
    // --- ------------- --------------------------- --------------- -------- --------
    //  1  e7support     telnet from 192.168.37.52   Alarm/Event/TCA enabled   enabled
    //     (debug)       at 1972/08/24 21:05:20                                       
    //     auth: local
    // *2  e7support     telnet from 192.168.37.52   Alarm/Event/TCA enabled   enabled
    //     (debug)       at 1972/08/24 21:09:10                                       
    //     auth: local
    
    // 2 sessions found.    
    
    // use the first column to seperate the result
    splitResultTableWithSeparatorAndMustCol(colNum: number) {
        let splitTmp = this.outputStr.split('\r\n')

        // logger.info(splitTmp)

        for (let ii=0; ii < splitTmp.length; ii++) {
            this.splitLines.push(splitTmp[ii])
            if (splitTmp[ii].indexOf(this.seperator) != -1) {
                this.splitLinePos.push(this.splitLines.length -1)
            }
        }

        if (this.splitLinePos.length == 0) {
            logger.info('no split line --------');
            return -1
        }
        let startLine = 0
        let endLine = 0
        let endMax = 0;
        for (let ii = 0; ii <this.splitLinePos.length; ii++) {
            // check the seperator line -1 
            let lineNum = this.splitLinePos[ii] 
            let matchRes = this.splitLines[lineNum].matchAll(/ /g)
            if (lineNum -1 < 0) {
                logger.error('invalid split line')
                return -1;
            }
            let space:SpacePos[] = [];
            for (let v of matchRes) {
                if (v.index) {
                    let sp:SpacePos = {start:v.index,
                        end:v.index +1}
                    space.push(sp)
                }
            }
            logger.info(space)
            let headerColumn = this.splitToColumnMultiline(startLine, lineNum-1, space)
            if (this.splitLinePos.length -1 > ii) {
                endMax  = this.splitLinePos[ii + 1] -1
            }else {
                endMax = this.splitLines.length
            }
            endLine = endMax;
            for (let jj = lineNum + 1; jj < endMax; jj++) {
                if (this.splitLines[jj].length == 0) {
                    endLine = jj;
                    break;
                }
            }

            let joinColumn:string[] = []
            let isStart = true
            for (let jj = 0; jj < headerColumn.length; jj++) {
                joinColumn.push('')
            }
            for (let jj = lineNum + 1; jj < endLine; jj++) {
                let contentColumn = this.splitToColumn(this.splitLines[jj],space)                
                
                // new record find, need add previsou record to the table
                if (contentColumn[colNum].trim().length > 0) {
                    if (isStart) {
                        isStart = false
                    }else {
                        let formatOut:ResultFormat = new ResultFormat()
                        for (let zz = 0; zz< headerColumn.length; zz++) {
                            let child = new ResultFormat()
                            child.name = headerColumn[zz]
                            child.value = joinColumn[zz]
                            child.level = 0
                            formatOut.childs.push(child)
                            joinColumn[zz] = ''
                        }
                        this.tableFormatOut.push(formatOut)    
                    }
                }

                for (let zz = 0; zz < headerColumn.length; zz++) {
                    joinColumn[zz] += contentColumn[zz].trim()
                }
            }
            // Add the last one
            if (joinColumn[colNum] && joinColumn[colNum].length > 0) {
                let formatOut:ResultFormat = new ResultFormat()
                for (let zz = 0; zz< headerColumn.length; zz++) {
                    let child = new ResultFormat()
                    child.name = headerColumn[zz]
                    child.value = joinColumn[zz]
                    child.level = 0
                    formatOut.childs.push(child)
                    joinColumn[zz] = ''
                }
                this.tableFormatOut.push(formatOut)   

            }
            startLine = lineNum + 2;
        } 
        return 0;

    }
    splitResultTable() {
        let splitTmp = this.outputStr.split('\r\n')

        // logger.info(splitTmp)

        for (let ii=0; ii < splitTmp.length; ii++) {
            this.splitLines.push(splitTmp[ii])
            if (splitTmp[ii].indexOf(this.seperator) != -1) {
                this.splitLinePos.push(this.splitLines.length -1)
            }
        }

        if (this.splitLinePos.length == 0) {
            logger.info('no split line --------');
            return -1
        }
        let startLine = 0
        let endLine = 0;
        let endMax = 0;

        for (let ii = 0; ii <this.splitLinePos.length; ii++) {
            // check the seperator line -1 
            let lineNum = this.splitLinePos[ii] 
            if (lineNum -1 < 0) { 
                logger.error('splitResultTable invalid split');
                return -1;

            }
            let headerSpace = this.findSpace(this.splitLines[lineNum -1])
            
            let contentSpace = this.findSpace(this.splitLines[lineNum +1])

            logger.info(headerSpace)
            logger.info(contentSpace)
            let mergeSpace = this.mergeSpace(headerSpace, contentSpace)
            logger.info(mergeSpace)
            let headerColumn = this.splitToColumnMultiline(startLine, lineNum-1, mergeSpace)
            if (this.splitLinePos.length -1 > ii) {
                endMax  = this.splitLinePos[ii + 1] -1
            }else {
                endMax = this.splitLines.length
            }
            endLine = endMax;
            for (let jj = lineNum + 1; jj < endMax; jj++) {
                if (this.splitLines[jj].length == 0) {
                    endLine = jj;
                    break;
                }
            }

            for (let jj = lineNum + 1; jj < endLine; jj++) {
                let contentColumn = this.splitToColumn(this.splitLines[jj],mergeSpace)
                this.headerCol.push(headerColumn)
                this.contentCol.push(contentColumn)
                logger.info(headerColumn)
                let formatOut:ResultFormat = new ResultFormat()
                for (let jj = 0; jj< headerColumn.length; jj++) {
                    let child = new ResultFormat()
                    child.name = headerColumn[jj]
                    child.value = contentColumn[jj]
                    child.level = 0
                    formatOut.childs.push(child)
                }
                this.tableFormatOut.push(formatOut)
            }
            startLine = lineNum + 2;
        } 
        return 0;
    }

    getTableFormatOut():ResultFormat[] {
        return this.tableFormatOut;
    }

    getLineFormatOut():ResultFormat[] {
        return this.lineFormatOut;
    }

    splitResult(resOut:string, format:CliResFormatMode, addition:any=undefined) {
        this.splitLines=[];
        this.splitLinePos = []
        this.headerCol = []
        this.contentCol = []
        this.outputStr = resOut;
        
        
        switch(format) {
            case CliResFormatMode.CliResFormatTable:
                this.tableFormatOut =[]
                this.splitResultTable();
                break;
            case CliResFormatMode.CliResFormatLine:
                this.lineFormatOut = []
                let splitRes = this.splitResultLine();
                
                this.printResultLineFormat(splitRes)
                break;
            case CliResFormatMode.CliResFormatTableWithSeparator:
                this.tableFormatOut = []
                if (addition === undefined) {
                    this.splitResultTableWithSeparator()
                }else {
                    let col = addition as unknown as number
                    this.splitResultTableWithSeparatorAndMustCol(col)
                }
                break;
            case CliResFormatMode.CliResFormatLineExaWithColon: {
                this.lineFormatOut = []
                let splitRes = this.splitResultExaLineWithColon();
                this.printResultLineFormat(splitRes)
             }
                break;
            case CliResFormatMode.CliResFormatTableCsv:
                this.tableFormatOut = []
                this.splitResultTableCsvFormat()
                break
            
        }
    }


    parseContentByColumnNum(parseResult:string, columnNum:number):DiagTable|number {
        let parseStrList = parseResult.split('\r\n')
        let posListEachLine =[]
        for (let ii = 0; ii < parseStrList.length; ii++) {
            let line = parseStrList[ii]
            if (line.trim() === '') {
                continue
            }
            let lineStrList = line
            let spacePos = this.findSpace(line)
            if (spacePos.length + 1 < columnNum) {
                logger.error(`parseContentByColumnNum: spacePos Number ${spacePos.length} less than ${columnNum} ${line}`)
                return -1

            }
            posListEachLine.push(spacePos)
        }
        let mergeSpace = []
        // 1 merge the each line Pos 2 use top "columnNum" for the result
        if (parseStrList.length < 2) {
            mergeSpace = posListEachLine[0]
        }else {
            mergeSpace = posListEachLine[0]
            for (let ii = 1 ; ii < posListEachLine.length; ii++) {
                mergeSpace = this.mergeSpace(mergeSpace, posListEachLine[ii])
            }
        }

        if (mergeSpace.length + 1 < columnNum) {
            logger.error(`parseContentByColumnNum: Merge Number ${mergeSpace.length} less than ${columnNum}`)
            return -1
        }
        
        let topNPos:SpacePos[] = []
        if (mergeSpace.length === columnNum) {
            topNPos = mergeSpace

        }else {
            topNPos = mergeSpace.sort((a, b)=>{return (a.end - a.start) - (b.end - b.start)}).slice(0, columnNum)
            topNPos = topNPos.sort((a, b)=>{return (a.start - b.start)})
        }
        let tableResult:DiagTable = {rows:[], columnName:[]}
        for (let line of parseStrList) {
            if (line.trim() === '') {
                continue
            }
            let startPos = 0
            let row:DiagTableRow = []
            for (let pos of topNPos) {
                let item:DiagTableItem ={value:''}
                item.value = line.substring(startPos, pos.start).trim()
                startPos = pos.end
                row.push(item)
            }
            let item:DiagTableItem ={value:''}
            item.value = line.substring(startPos).trim()
            row.push(item)
            tableResult.rows.push(row)
        }

        return tableResult
    }   

}