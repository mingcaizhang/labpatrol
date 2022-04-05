export class DiagNode {
    data:string = ''
    children: DiagNode[] = []

    constructor(data:string) {
        this.data = data
        this.children = []
    }

    getData() :string{
        return this.data
    }


	getChildren(): DiagNode[] {
        return this.children
    }	
    
    go(data:string): DiagNode | null {
        for (let child of this.children) {
            if (child.data.indexOf(data) != -1) {
                return child
            }
        }
        return null
    }

		
	add(node:DiagNode) {
		this.children.push(node)
    }

	findChildWithContent(data:string): DiagNode[]{
		let matchnodes:DiagNode[] = []
		for (let child of this.children) {
            if (child.data.trim().indexOf(data) === 0) {
                matchnodes.push(child)
            }
        }
		return matchnodes
    }

	isNodeHasContent(data:string):boolean {
        if (this.data.indexOf(data) != -1) {
            return true
        }else {
            return false
        }
    }

	printnode(level:number) {
        console.log(' '.repeat(level) + this.data)
        for (let child of this.children) {
            child.printnode(level + 1)
        }
    }
}

export class DiagTree {
    head:DiagNode = new DiagNode('header')
    constructor() {

    }

    linkToHead(node:DiagNode) {
        this.head.add(node)
    }

    insert(paths:string[], data:string):boolean {
        let cur = this.head
        for (let step of paths) {
            let goNext = cur.go(step)
            if (goNext === null) {
                return false
            }else {
                cur = goNext
            }
        }
        cur.add(new DiagNode(data))
        return true
    }

    search(paths:string[]):DiagNode|null {
        let cur = this.head
        for (let step of paths) {
            let curNext = cur.go(step) 
            if (curNext === null) {
                return null
            }
            else {
                cur = curNext
            }   
        }
        return cur
    }

    treePrint() {
        this.head.printnode(0)
    }

}
