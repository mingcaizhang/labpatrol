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

const path = require('path');
console.log(Object.getOwnPropertyNames(console));

console.log(Object.getOwnPropertyDescriptor(console,'log')?.value('log pritn'));

// ['debug', 'log', 'warn', 'error'].forEach((methodName) => {
//     const originalLoggingMethod = console[methodName];
//     console[methodName] = (firstArgument, ...otherArguments) => {
//         const originalPrepareStackTrace = Error.prepareStackTrace;
//         Error.prepareStackTrace = (_, stack) => stack;
//         const callee = new Error().stack[1];
//         Error.prepareStackTrace = originalPrepareStackTrace;
//         const relativeFileName = path.relative(process.cwd(), callee.getFileName());
//         const prefix = `${relativeFileName}:${callee.getLineNumber()}:`;
//         if (typeof firstArgument === 'string') {
//             originalLoggingMethod(prefix + ' ' + firstArgument, ...otherArguments);
//         } else {
//             originalLoggingMethod(prefix, firstArgument, ...otherArguments);
//         }
//     };
// });

// Tests:
console.log('%s %d', 'hi', 42);
console.log({ a: 'foo', b: 'bar'});

let  map2 = new Map<{shelf:number, slot:number}, string>()
map2.set({shelf:1, slot:1}, 'card1')
map2.set({shelf:1, slot:2}, 'card2')
map2.set({shelf:1, slot:2}, 'card3')
console.log(map2)
console.log(map2.get({shelf:1, slot:1}))

