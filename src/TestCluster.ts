import * as cluster from 'cluster';
import { cpus } from 'os';
const numCPUs = cpus().length;
// @ts-ignore: Unreachable code error
if (cluster.isMaster) {
  console.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
     // @ts-ignore: Unreachable code error
    cluster.fork();
  }
 // @ts-ignore: Unreachable code error
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server


  console.log(`Worker ${process.pid} started`);
}