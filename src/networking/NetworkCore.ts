import Fastify from 'fastify';

class NetworkCore {
  static fastifyApp = Fastify();

  static async start() {
    try {
      await this.fastifyApp.listen(3000);
      console.log(`Server is running on port 3000`);
    } catch (err) {
      console.log(err);
    }
  }
}

export default NetworkCore;
