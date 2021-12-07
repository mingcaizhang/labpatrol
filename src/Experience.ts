let map1 = new Map<number, string>()
map1.set(1, "abc")
console.log(map1)

console.log(map1.size)
console.log(map1.keys())
console.log(map1.keys().next())
console.log(map1.keys().next())
for (let key of map1.keys()) {
    console.log(key);                  
}
for (let entry of map1.values()) {
    
}
console.log([...map1.keys()][0])

let stringList = ['a', 'b', 'c']
let stringOut = stringList.join('')
console.log(stringOut)


type NumStrMap = Map<number, string>


let numStr:NumStrMap = new Map<number, string>();


numStr.get(1)